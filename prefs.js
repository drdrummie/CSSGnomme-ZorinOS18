/** CSS Gnomme Preferences */

import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";
import Gdk from "gi://Gdk";
import GLib from "gi://GLib";

import { ExtensionPreferences, gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { ColorPalette } from "./colorPalette.js";
import { ThemeUtils } from "./themeUtils.js";
import { GlobalSignalsHandler } from "./signalHandler.js";

/**
 * Discover installed GTK themes from standard locations
 * @returns {string[]} Array of theme names
 */
function _discoverInstalledThemes() {
    const themes = new Set();

    // Standard theme locations
    const themeDirs = [
        GLib.get_home_dir() + "/.themes",
        GLib.get_home_dir() + "/.local/share/themes",
        "/usr/share/themes"
    ];

    themeDirs.forEach(dir => {
        try {
            const dirFile = Gio.File.new_for_path(dir);
            if (!dirFile.query_exists(null)) {
                return;
            }

            const enumerator = dirFile.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    const themeName = info.get_name();

                    // Skip hidden directories and our overlay
                    if (themeName.startsWith(".") || themeName === "CSSGnomme") {
                        continue;
                    }

                    // Check if theme has GTK 3 or GTK 4 support
                    const themePath = dir + "/" + themeName;

                    // Check for GTK CSS files with actual content (> 100 bytes)
                    const gtk3Path = themePath + "/gtk-3.0/gtk.css";
                    const gtk4Path = themePath + "/gtk-4.0/gtk.css";

                    let hasValidGtk3 = false;
                    let hasValidGtk4 = false;

                    // GTK 3 check - file must exist and be > 100 bytes
                    if (GLib.file_test(gtk3Path, GLib.FileTest.EXISTS)) {
                        try {
                            const gtk3File = Gio.File.new_for_path(gtk3Path);
                            const info = gtk3File.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
                            const size = info.get_size();
                            hasValidGtk3 = size > 100; // Must have actual CSS content
                        } catch (e) {
                            // Invalid file, skip
                        }
                    }

                    // GTK 4 check - file must exist and be > 100 bytes
                    if (GLib.file_test(gtk4Path, GLib.FileTest.EXISTS)) {
                        try {
                            const gtk4File = Gio.File.new_for_path(gtk4Path);
                            const info = gtk4File.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null);
                            const size = info.get_size();
                            hasValidGtk4 = size > 100; // Must have actual CSS content
                        } catch (e) {
                            // Invalid file, skip
                        }
                    }

                    // Only add themes with valid GTK CSS files
                    if (hasValidGtk3 || hasValidGtk4) {
                        themes.add(themeName);
                    }
                }
            }
            enumerator.close(null);
        } catch (e) {
            log(`Error scanning theme directory ${dir}: ${e.message}`);
        }
    });

    // Convert Set to sorted Array
    const themeArray = Array.from(themes).sort();

    // Ensure Adwaita is first if it exists
    const adwaitaIndex = themeArray.indexOf("Adwaita");
    if (adwaitaIndex > 0) {
        themeArray.splice(adwaitaIndex, 1);
        themeArray.unshift("Adwaita");
    }

    return themeArray;
}

/**
 * Check if Zorin Menu extension is installed and enabled
 * @returns {boolean} True if Zorin Menu is available
 */
function _isZorinMenuAvailable() {
    try {
        // Check if extension is in enabled-extensions list
        const shellSettings = new Gio.Settings({ schema_id: "org.gnome.shell" });
        const enabledExtensions = shellSettings.get_strv("enabled-extensions");
        return enabledExtensions.includes("zorin-menu@zorinos.com");
    } catch (e) {
        // If org.gnome.shell schema not accessible (unlikely in prefs context)
        return false;
    }
}

export default class CSSGnommePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // GlobalSignalsHandler for automatic signal tracking and cleanup
        const signalsHandler = new GlobalSignalsHandler();

        // Track interface settings separately (different Settings object)
        let interfaceSettings = null;

        // Track UI element signals for cleanup (prevent memory leaks)
        let comboRowSignalId = null;

        // Guard flag to prevent signal feedback loops
        let blockSignals = false;

        // Set window size to accommodate all tabs comfortably
        window.set_default_size(900, 800);

        // === THEME OVERLAY PAGE (FIRST) ===
        const overlayPage = new Adw.PreferencesPage({
            title: _("Theme Overlay"),
            icon_name: "applications-graphics-symbolic"
        });

        // Theme Integration Group
        const themeIntegrationGroup = new Adw.PreferencesGroup({
            title: _("Theme Integration"),
            description: _("CSS Gnomme creates a dynamic overlay theme that sits on top of your current theme")
        });

        // Enable overlay theme switch
        const enableOverlayRow = new Adw.ActionRow({
            title: _("Enable Overlay Theme"),
            subtitle: _("Activate CSS Gnomme overlay with custom styling and color extraction")
        });
        const enableOverlaySwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        settings.bind("enable-overlay-theme", enableOverlaySwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        enableOverlayRow.add_suffix(enableOverlaySwitch);
        enableOverlayRow.activatable_widget = enableOverlaySwitch;
        themeIntegrationGroup.add(enableOverlayRow);

        // Source theme selector dropdown
        const sourceThemeRow = new Adw.ComboRow({
            title: _("Base Theme"),
            subtitle: _("Select the theme to use as foundation for overlay")
        });

        /**
         * Filter themes based on auto-switch and color-scheme settings
         * When auto-switch is ON:
         * - Extension.js automatically switches between theme variants on Dark/Light toggle
         * - Dropdown shows only themes matching current appearance (-Dark or -Light suffix)
         * When auto-switch is OFF:
         * - User manually selects theme from full list
         * - All themes shown in dropdown
         * @returns {Array} Filtered theme list
         */
        const getFilteredThemes = () => {
            const allThemes = _discoverInstalledThemes();
            const autoSwitch = settings.get_boolean("auto-switch-color-scheme");

            // If auto-switch OFF, show all themes (user has full control)
            if (!autoSwitch) {
                return allThemes;
            }

            // Get system color-scheme preference
            let interfaceSettings;
            try {
                interfaceSettings = new Gio.Settings({ schema: "org.gnome.desktop.interface" });
            } catch (e) {
                // Fallback if can't read settings - show all themes
                log("[CSSGnomme:Prefs] Could not read color-scheme, showing all themes");
                return allThemes;
            }

            const colorScheme = interfaceSettings.get_string("color-scheme");
            const prefersDark = colorScheme === "prefer-dark";

            // Filter: Only show themes with explicit -Dark or -Light suffix
            // Case-insensitive matching at the END of theme name
            const filtered = allThemes.filter(themeName => {
                const lowerName = themeName.toLowerCase();

                // Check if theme has explicit -Dark or -Light suffix
                const hasDarkSuffix = lowerName.endsWith("-dark");
                const hasLightSuffix = lowerName.endsWith("-light");

                // Only accept themes with explicit suffix
                if (!hasDarkSuffix && !hasLightSuffix) {
                    return false; // Skip themes without suffix (e.g., "Fluent-round-grey", "Adwaita")
                }

                // Show -Dark themes in dark mode, -Light themes in light mode
                if (prefersDark) {
                    return hasDarkSuffix;
                } else {
                    return hasLightSuffix;
                }
            });

            // Fallback: if filter results in empty list, show all themes
            if (filtered.length === 0) {
                log("[CSSGnomme:Prefs] Filter resulted in empty list, showing all themes");
                return allThemes;
            }

            return filtered;
        };

        // Populate dropdown with filtered themes
        const themeList = new Gtk.StringList();
        let availableThemes = getFilteredThemes();
        const currentSourceTheme = settings.get_string("overlay-source-theme") || "Adwaita";
        let selectedIndex = 0;

        availableThemes.forEach((themeName, index) => {
            themeList.append(themeName);
            if (themeName === currentSourceTheme) {
                selectedIndex = index;
            }
        });

        sourceThemeRow.set_model(themeList);
        sourceThemeRow.set_selected(selectedIndex);

        // Connect source theme change - use closure-safe theme retrieval
        // Track signal ID for cleanup on window close
        comboRowSignalId = sourceThemeRow.connect("notify::selected", () => {
            // GUARD: Prevent signal feedback loop during programmatic updates
            if (blockSignals) {
                log("[CSSGnomme:Prefs] ComboRow signal blocked (programmatic update)");
                return;
            }

            const selectedIndex = sourceThemeRow.get_selected();
            const model = sourceThemeRow.get_model();
            const selectedTheme = model.get_string(selectedIndex);
            if (selectedTheme) {
                log(`[CSSGnomme:Prefs] User selected theme: ${selectedTheme}`);
                // Block signals to prevent triggering our own handler
                blockSignals = true;
                settings.set_string("overlay-source-theme", selectedTheme);
                blockSignals = false;
            }
        });

        // Refresh dropdown when auto-switch or color-scheme changes
        const refreshDropdown = () => {
            // Block signals during programmatic update
            blockSignals = true;

            // Save current selection
            const currentSelection = settings.get_string("overlay-source-theme");

            // Create completely new model (don't reuse themeList)
            const newThemeList = new Gtk.StringList();
            availableThemes = getFilteredThemes();
            let newSelectedIndex = 0;

            availableThemes.forEach((themeName, index) => {
                newThemeList.append(themeName);
                if (themeName === currentSelection) {
                    newSelectedIndex = index;
                }
            });

            // Set new model and selection
            sourceThemeRow.set_model(newThemeList);
            sourceThemeRow.set_selected(newSelectedIndex);

            // Unblock signals after update complete
            blockSignals = false;
        };

        // Monitor auto-switch toggle using GlobalSignalsHandler
        signalsHandler.add([settings, "changed::auto-switch-color-scheme", refreshDropdown]);

        // Monitor system color-scheme changes (for live updates while prefs open)
        // Keep interfaceSettings alive by storing it outside try block
        try {
            interfaceSettings = new Gio.Settings({ schema: "org.gnome.desktop.interface" });
            signalsHandler.add([
                interfaceSettings,
                "changed::color-scheme",
                () => {
                    // Don't interfere if auto-switch is enabled (extension.js handles theme switching)
                    if (settings.get_boolean("auto-switch-color-scheme")) {
                        log("[CSSGnomme:Prefs] Auto-switch enabled, skipping dropdown refresh");
                        return;
                    }

                    log("[CSSGnomme:Prefs] Color-scheme changed, refreshing dropdown");
                    refreshDropdown();
                }
            ]);
        } catch (e) {
            log(`[CSSGnomme:Prefs] Warning: Could not monitor color-scheme changes: ${e}`);
        }

        // Monitor external changes to overlay-source-theme (e.g., from extension.js via "Apply Overlay" button)
        signalsHandler.add([
            settings,
            "changed::overlay-source-theme",
            () => {
                // GUARD: If signal is blocked, we triggered this change ourselves
                if (blockSignals) {
                    log("[CSSGnomme:Prefs] Theme change signal blocked (originated from us)");
                    return;
                }

                const newTheme = settings.get_string("overlay-source-theme") || "Adwaita";
                log(`[CSSGnomme:Prefs] External theme change detected: ${newTheme}`);

                // Block signals during update
                blockSignals = true;

                // Rebuild dropdown to ensure new theme is in the list (in case filter changed)
                refreshDropdown();

                // After rebuild, find and select the new theme
                const model = sourceThemeRow.get_model();
                for (let i = 0; i < model.get_n_items(); i++) {
                    if (model.get_string(i) === newTheme) {
                        sourceThemeRow.set_selected(i);
                        // DON'T call notify() - it triggers our handler!
                        break;
                    }
                }

                // Unblock signals
                blockSignals = false;
            }
        ]);

        themeIntegrationGroup.add(sourceThemeRow);

        // Overlay status display
        const statusRow = new Adw.ActionRow({
            title: _("Overlay Status"),
            subtitle: _("Checking...")
        });

        // Update status based on settings
        const updateStatus = () => {
            const enabled = settings.get_boolean("enable-overlay-theme");
            const sourceTheme = settings.get_string("overlay-source-theme");

            if (enabled) {
                statusRow.subtitle = _(`Active - Using ${sourceTheme} as base`);
            } else {
                statusRow.subtitle = _("Inactive - Enable overlay to apply custom theme");
            }
        };

        updateStatus();
        signalsHandler.add(
            [settings, "changed::enable-overlay-theme", updateStatus],
            [settings, "changed::overlay-source-theme", updateStatus]
        );

        themeIntegrationGroup.add(statusRow);

        // Auto-detect radius
        const autoDetectRadiusRow = new Adw.ActionRow({
            title: _("Auto-detect theme border radius"),
            subtitle: _("Automatically detect and use border-radius from current theme")
        });
        const autoDetectRadiusSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("auto-detect-radius", autoDetectRadiusSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        autoDetectRadiusRow.add_suffix(autoDetectRadiusSwitch);
        autoDetectRadiusRow.set_activatable_widget(autoDetectRadiusSwitch);
        themeIntegrationGroup.add(autoDetectRadiusRow);

        overlayPage.add(themeIntegrationGroup);

        // Automatic Color Extraction Group
        const colorExtractionGroup = new Adw.PreferencesGroup({
            title: _("Automatic Color Extraction") //,
            //description: _("Extract colors from your wallpaper and apply them automatically")
        });

        // Auto-extract on wallpaper change
        const autoExtractRow = new Adw.ActionRow({
            title: _("Auto-detect colors on wallpaper change"),
            subtitle: _("Automatically extract and apply colors when you change your desktop background")
        });
        const autoExtractSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        settings.bind("auto-color-extraction", autoExtractSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        autoExtractRow.add_suffix(autoExtractSwitch);
        autoExtractRow.activatable_widget = autoExtractSwitch;
        colorExtractionGroup.add(autoExtractRow);

        // Manual extract button
        const extractButtonRow = new Adw.ActionRow({
            title: _("Extract Colors Now"),
            subtitle: _("Manually trigger color extraction from current wallpaper")
        });
        const extractButton = new Gtk.Button({
            label: _("Extract from Wallpaper"),
            valign: Gtk.Align.CENTER,
            css_classes: ["suggested-action"]
        });
        extractButton.connect("clicked", () => {
            // Trigger extraction via settings toggle (DRY - avoid duplicate logic)
            // Extension will handle extraction and show notification
            settings.set_boolean("trigger-color-extraction", !settings.get_boolean("trigger-color-extraction"));
        });
        extractButtonRow.add_suffix(extractButton);
        colorExtractionGroup.add(extractButtonRow);

        overlayPage.add(colorExtractionGroup);

        // Manual Controls Group
        const manualControlGroup = new Adw.PreferencesGroup({
            title: _("Manual Controls") //,
            // description: _("Manually trigger overlay updates or rebuild from scratch")
        });

        // Apply changes now button
        const applyButtonRow = new Adw.ActionRow({
            title: _("Apply Changes Now"),
            subtitle: _("Manually update overlay theme (auto-update has 2s delay)")
        });

        const applyButton = new Gtk.Button({
            label: _("Apply"),
            valign: Gtk.Align.CENTER,
            css_classes: ["suggested-action"]
        });

        applyButton.connect("clicked", () => {
            log("[CSSGnomme Prefs] Apply Changes button clicked");

            // Get current state for logging
            const currentTrigger = settings.get_boolean("manual-apply-trigger");
            log(`[CSSGnomme Prefs] Toggling manual-apply-trigger: ${currentTrigger} → ${!currentTrigger}`);

            // Trigger manual apply via settings toggle
            settings.set_boolean("manual-apply-trigger", !currentTrigger);

            log("[CSSGnomme Prefs] Manual apply trigger set, overlay theme will update");

            // Show confirmation
            const messageDialog = new Gtk.MessageDialog({
                transient_for: window,
                modal: true,
                buttons: Gtk.ButtonsType.OK,
                text: _("Overlay Update Triggered"),
                secondary_text: _("The theme overlay has been updated with your current settings.")
            });
            messageDialog.connect("response", () => messageDialog.destroy());
            messageDialog.show();
        });

        applyButtonRow.add_suffix(applyButton);
        applyButtonRow.activatable_widget = applyButton;
        manualControlGroup.add(applyButtonRow);

        // Recreate overlay button
        const recreateButtonRow = new Adw.ActionRow({
            title: _("Recreate Overlay") //,
            // subtitle: _("Delete and recreate entire overlay (useful if base theme changed)")
        });

        const recreateButton = new Gtk.Button({
            label: _("Recreate"),
            valign: Gtk.Align.CENTER,
            css_classes: ["destructive-action"]
        });

        recreateButton.connect("clicked", () => {
            log("[CSSGnomme Prefs] Recreate Overlay button clicked");

            // Toggle trigger key - extension.js will handle recreation
            const current = settings.get_boolean("trigger-recreate-overlay");
            settings.set_boolean("trigger-recreate-overlay", !current);

            log(`[CSSGnomme Prefs] Recreate trigger toggled: ${current} -> ${!current}`);

            const messageDialog = new Gtk.MessageDialog({
                transient_for: window,
                modal: true,
                buttons: Gtk.ButtonsType.OK,
                text: _("Overlay Recreation Triggered"),
                secondary_text: _("The theme overlay is being completely rebuilt from the selected base theme.")
            });
            messageDialog.connect("response", () => messageDialog.destroy());
            messageDialog.show();
        });

        recreateButtonRow.add_suffix(recreateButton);
        recreateButtonRow.activatable_widget = recreateButton;
        manualControlGroup.add(recreateButtonRow);

        overlayPage.add(manualControlGroup);

        window.add(overlayPage);

        // === TRANSPARENCY SETTINGS PAGE ===
        const transparencyPage = new Adw.PreferencesPage({
            title: _("Color Settings"),
            icon_name: "preferences-desktop-theme-symbolic"
        });

        // Basic transparency controls group
        const basicTransparencyGroup = new Adw.PreferencesGroup({
            title: _("Basic Transparency Controls")
        });

        // Panel opacity
        const panelOpacityRow = new Adw.ActionRow({
            title: _("Panel Opacity"),
            subtitle: _("Adjust the transparency of the main panel (0.0 = fully transparent, 1.0 = fully opaque)")
        });

        const panelOpacitySpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("panel-opacity", panelOpacitySpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        panelOpacityRow.add_suffix(panelOpacitySpinButton);
        basicTransparencyGroup.add(panelOpacityRow);

        // Menu opacity
        const menuOpacityRow = new Adw.ActionRow({
            title: _("Menu Opacity"),
            subtitle: _("Adjust the transparency of popup menus (0.0 = fully transparent, 1.0 = fully opaque)")
        });

        const menuOpacitySpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("menu-opacity", menuOpacitySpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        menuOpacityRow.add_suffix(menuOpacitySpinButton);
        basicTransparencyGroup.add(menuOpacityRow);

        // Zorin Theme Tint Strength (only affects Zorin themes like ZorinBlue, ZorinGreen, etc.)
        const tintStrengthRow = new Adw.ActionRow({
            title: _("Zorin Theme Tint Strength (%)"),
            subtitle: _(
                "Removes color tint from Zorin theme backgrounds (0% = fully neutral grey, 100% = original colored backgrounds). Only works with Zorin themes (ZorinBlue-Dark, ZorinGreen-Light, etc.). Other themes are unaffected."
            )
        });

        const tintStrengthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 5,
                page_increment: 10
            }),
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        settings.bind("zorin-tint-strength", tintStrengthSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        tintStrengthRow.add_suffix(tintStrengthSpinButton);
        basicTransparencyGroup.add(tintStrengthRow);

        transparencyPage.add(basicTransparencyGroup);

        // Panel options group
        const panelOptionsGroup = new Adw.PreferencesGroup({
            title: _("Panel Appearance")
        });

        // Panel margin (floating mode)
        const panelMarginRow = new Adw.ActionRow({
            title: _("Panel Margin"),
            subtitle: _(
                "Horizontal spacing from screen edges (0 = pinned to edges, >0 = floating panel with modern appearance)"
            )
        });
        const panelMarginSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 32,
                step_increment: 4,
                page_increment: 8
            }),
            valign: Gtk.Align.CENTER
        });
        settings.bind("panel-margin", panelMarginSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        panelMarginRow.add_suffix(panelMarginSpinButton);
        panelOptionsGroup.add(panelMarginRow);

        // Override panel color
        const overridePanelColorRow = new Adw.ActionRow({
            title: _("Override panel color"),
            subtitle: _("Use custom color for panel background instead of theme color")
        });
        const overridePanelColorSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("override-panel-color", overridePanelColorSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        overridePanelColorRow.add_suffix(overridePanelColorSwitch);
        overridePanelColorRow.set_activatable_widget(overridePanelColorSwitch);
        panelOptionsGroup.add(overridePanelColorRow);

        // Choose override panel color
        const choosePanelColorRow = new Adw.ActionRow({
            title: _("Choose override panel color"),
            subtitle: _("Select background color for panel when override is enabled")
        });
        const panelColorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true
        });
        // Custom binding for RGBA to string conversion
        const panelColorValue = settings.get_string("choose-override-panel-color");
        if (panelColorValue) {
            const rgba = new Gdk.RGBA();
            rgba.parse(panelColorValue);
            panelColorButton.set_rgba(rgba);
        }
        signalsHandler.add([
            panelColorButton,
            "color-set",
            () => {
                const rgba = panelColorButton.get_rgba();
                settings.set_string("choose-override-panel-color", rgba.to_string());
            }
        ]);

        // Listen for external changes (e.g., from color extraction)
        signalsHandler.add([
            settings,
            "changed::choose-override-panel-color",
            () => {
                const newValue = settings.get_string("choose-override-panel-color");
                if (newValue) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newValue);
                    panelColorButton.set_rgba(rgba);
                }
            }
        ]);

        choosePanelColorRow.add_suffix(panelColorButton);
        panelOptionsGroup.add(choosePanelColorRow);

        // Override popup color
        const overridePopupColorRow = new Adw.ActionRow({
            title: _("Override popup color"),
            subtitle: _("Use custom color for popup menu backgrounds")
        });
        const overridePopupColorSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("override-popup-color", overridePopupColorSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        overridePopupColorRow.add_suffix(overridePopupColorSwitch);
        overridePopupColorRow.set_activatable_widget(overridePopupColorSwitch);
        panelOptionsGroup.add(overridePopupColorRow);

        // Choose override popup color
        const choosePopupColorRow = new Adw.ActionRow({
            title: _("Choose override popup color"),
            subtitle: _("Select background color for popup menus when override is enabled")
        });
        const popupColorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true
        });
        // Custom binding for RGBA to string conversion
        const popupColorValue = settings.get_string("choose-override-popup-color");
        if (popupColorValue) {
            const rgba = new Gdk.RGBA();
            rgba.parse(popupColorValue);
            popupColorButton.set_rgba(rgba);
        }
        signalsHandler.add([
            popupColorButton,
            "color-set",
            () => {
                const rgba = popupColorButton.get_rgba();
                settings.set_string("choose-override-popup-color", rgba.to_string());
            }
        ]);

        // Listen for external changes (e.g., from color extraction)
        signalsHandler.add([
            settings,
            "changed::choose-override-popup-color",
            () => {
                const newValue = settings.get_string("choose-override-popup-color");
                if (newValue) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newValue);
                    popupColorButton.set_rgba(rgba);
                }
            }
        ]);

        choosePopupColorRow.add_suffix(popupColorButton);
        panelOptionsGroup.add(choosePopupColorRow);

        // Border radius
        const borderRadiusRow = new Adw.ActionRow({
            title: _("Border Radius"),
            subtitle: _("Rounded corners for panels and menus (0-25px)")
        });
        const borderRadiusSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 25,
                step_increment: 1,
                page_increment: 5
            }),
            valign: Gtk.Align.CENTER
        });
        settings.bind("border-radius", borderRadiusSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        borderRadiusRow.add_suffix(borderRadiusSpinButton);
        panelOptionsGroup.add(borderRadiusRow);

        // Apply panel radius - COMMENTED OUT (automatic behavior based on panel-margin)
        // When panel-margin > 0, border-radius is automatically applied (floating mode)
        // When panel-margin = 0, border-radius is disabled (flat pinned panel looks better)
        // Keeping code for future reference in case manual override control is needed
        /*
        const applyPanelRadiusRow = new Adw.ActionRow({
            title: _("Apply border radius to main panel"),
            subtitle: _("Enable rounded corners on taskbar for modern appearance")
        });
        const applyPanelRadiusSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("apply-panel-radius", applyPanelRadiusSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        applyPanelRadiusRow.add_suffix(applyPanelRadiusSwitch);
        applyPanelRadiusRow.set_activatable_widget(applyPanelRadiusSwitch);
        panelOptionsGroup.add(applyPanelRadiusRow);
        */

        transparencyPage.add(panelOptionsGroup);

        window.add(transparencyPage);

        // === BLUR EFFECTS PAGE ===
        const blurPage = new Adw.PreferencesPage({
            title: _("Blur Effects"),
            icon_name: "preferences-desktop-effects-symbolic"
        });

        // Custom blur settings group
        const customBlurGroup = new Adw.PreferencesGroup({
            title: _("Custom Blur and Border Settings")
        });

        // Blur radius
        const blurRadiusRow = new Adw.ActionRow({
            title: _("Blur radius"),
            subtitle: _("Controls the intensity of the blur effect")
        });
        const blurRadiusSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 50,
                step_increment: 1,
                page_increment: 5
            }),
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-radius", blurRadiusSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurRadiusRow.add_suffix(blurRadiusSpinButton);
        customBlurGroup.add(blurRadiusRow);

        // Blur saturate
        const blurSaturateRow = new Adw.ActionRow({
            title: _("Saturation multiplier"),
            subtitle: _("Adjusts color vibrancy in the blurred background")
        });
        const blurSaturateSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.4,
                upper: 2.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-saturate", blurSaturateSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurSaturateRow.add_suffix(blurSaturateSpinButton);
        customBlurGroup.add(blurSaturateRow);

        // Blur contrast
        const blurContrastRow = new Adw.ActionRow({
            title: _("Contrast multiplier"),
            subtitle: _("Controls the difference between light and dark areas")
        });
        const blurContrastSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.4,
                upper: 2.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-contrast", blurContrastSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurContrastRow.add_suffix(blurContrastSpinButton);
        customBlurGroup.add(blurContrastRow);

        // Blur brightness
        const blurBrightnessRow = new Adw.ActionRow({
            title: _("Brightness multiplier"),
            subtitle: _("Modifies the overall lightness of the blurred layer")
        });
        const blurBrightnessSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.4,
                upper: 2.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-brightness", blurBrightnessSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurBrightnessRow.add_suffix(blurBrightnessSpinButton);
        customBlurGroup.add(blurBrightnessRow);

        // Blur background
        const blurBackgroundRow = new Adw.ActionRow({
            title: _("Background color/tint"),
            subtitle: _("Adds a tint overlay to the blur effect")
        });
        const blurBackgroundButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true
        });
        // Custom binding for RGBA to string conversion
        const blurBackgroundValue = settings.get_string("blur-background");
        if (blurBackgroundValue) {
            const rgba = new Gdk.RGBA();
            rgba.parse(blurBackgroundValue);
            blurBackgroundButton.set_rgba(rgba);
        }
        signalsHandler.add([
            blurBackgroundButton,
            "color-set",
            () => {
                const rgba = blurBackgroundButton.get_rgba();
                settings.set_string("blur-background", rgba.to_string());
            }
        ]);

        // Listen for external changes (e.g., from color extraction)
        signalsHandler.add([
            settings,
            "changed::blur-background",
            () => {
                const newValue = settings.get_string("blur-background");
                if (newValue) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newValue);
                    blurBackgroundButton.set_rgba(rgba);
                }
            }
        ]);

        blurBackgroundRow.add_suffix(blurBackgroundButton);
        customBlurGroup.add(blurBackgroundRow);

        // Blur border color
        const blurBorderColorRow = new Adw.ActionRow({
            title: _("Border color"),
            subtitle: _("Sets the color of the subtle border framing the blurred elements")
        });
        const blurBorderColorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true
        });
        // Custom binding for RGBA to string conversion
        const blurBorderColorValue = settings.get_string("blur-border-color");
        if (blurBorderColorValue) {
            const rgba = new Gdk.RGBA();
            rgba.parse(blurBorderColorValue);
            blurBorderColorButton.set_rgba(rgba);
        }
        signalsHandler.add([
            blurBorderColorButton,
            "color-set",
            () => {
                const rgba = blurBorderColorButton.get_rgba();
                settings.set_string("blur-border-color", rgba.to_string());
            }
        ]);

        // Listen for external changes (e.g., from color extraction)
        signalsHandler.add([
            settings,
            "changed::blur-border-color",
            () => {
                const newValue = settings.get_string("blur-border-color");
                if (newValue) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newValue);
                    blurBorderColorButton.set_rgba(rgba);
                }
            }
        ]);

        blurBorderColorRow.add_suffix(blurBorderColorButton);
        customBlurGroup.add(blurBorderColorRow);

        // Blur border width
        const blurBorderWidthRow = new Adw.ActionRow({
            title: _("Border width"),
            subtitle: _("Defines the thickness of the border around blurred elements")
        });
        const blurBorderWidthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 5,
                step_increment: 1,
                page_increment: 1
            }),
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-border-width", blurBorderWidthSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurBorderWidthRow.add_suffix(blurBorderWidthSpinButton);
        customBlurGroup.add(blurBorderWidthRow);

        // Blur opacity
        const blurOpacityRow = new Adw.ActionRow({
            title: _("Blur opacity"),
            subtitle: _(
                "Controls the transparency of the entire blur layer (0.0 = invisible blur, 1.0 = full blur effect)"
            )
        });
        const blurOpacitySpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("blur-opacity", blurOpacitySpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        blurOpacityRow.add_suffix(blurOpacitySpinButton);
        customBlurGroup.add(blurOpacityRow);

        blurPage.add(customBlurGroup);

        // Shadow Effects Group
        const shadowEffectsGroup = new Adw.PreferencesGroup({
            title: _("Shadow Effects")
        });

        // Shadow strength (outer glow spread control)
        const shadowStrengthRow = new Adw.ActionRow({
            title: _("Shadow strength"),
            subtitle: _("Controls outer glow spread around panels and menus (0.0 = no shadow, 0.8 = wide halo)")
        });
        const shadowStrengthSpinButton = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 0.8,
                step_increment: 0.01,
                page_increment: 0.1
            }),
            digits: 2,
            valign: Gtk.Align.CENTER
        });
        settings.bind("shadow-strength", shadowStrengthSpinButton, "value", Gio.SettingsBindFlags.DEFAULT);
        shadowStrengthRow.add_suffix(shadowStrengthSpinButton);
        shadowEffectsGroup.add(shadowStrengthRow);

        // Shadow color
        const shadowColorRow = new Adw.ActionRow({
            title: _("Shadow color"),
            subtitle: _("Sets the base color of shadows, automatically adjusted for light/dark themes")
        });
        const shadowColorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            use_alpha: true
        });
        // Custom binding for RGBA to string conversion
        const shadowColorValue = settings.get_string("shadow-color");
        if (shadowColorValue) {
            const rgba = new Gdk.RGBA();
            rgba.parse(shadowColorValue);
            shadowColorButton.set_rgba(rgba);
        }
        signalsHandler.add([
            shadowColorButton,
            "color-set",
            () => {
                const rgba = shadowColorButton.get_rgba();
                settings.set_string("shadow-color", rgba.to_string());
            }
        ]);

        // Listen for external changes (e.g., from theme switch or color extraction)
        signalsHandler.add([
            settings,
            "changed::shadow-color",
            () => {
                const newValue = settings.get_string("shadow-color");
                if (newValue) {
                    const rgba = new Gdk.RGBA();
                    rgba.parse(newValue);
                    shadowColorButton.set_rgba(rgba);
                }
            }
        ]);

        shadowColorRow.add_suffix(shadowColorButton);
        shadowEffectsGroup.add(shadowColorRow);

        blurPage.add(shadowEffectsGroup);
        window.add(blurPage);

        // === ADVANCED SETTINGS PAGE ===
        const advancedPage = new Adw.PreferencesPage({
            title: _("Advanced Settings"),
            icon_name: "preferences-other-symbolic"
        });

        // System tray indicator group
        const indicatorGroup = new Adw.PreferencesGroup({
            title: _("Interface Behavior")
        });

        // Hide tray icon
        const hideTrayIconRow = new Adw.ActionRow({
            title: _("Hide system tray indicator"),
            subtitle: _("Hide the transparency control icon from the system tray")
        });
        const hideTrayIconSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("hide-tray-icon", hideTrayIconSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        hideTrayIconRow.add_suffix(hideTrayIconSwitch);
        hideTrayIconRow.set_activatable_widget(hideTrayIconSwitch);
        indicatorGroup.add(hideTrayIconRow);

        // Enable notifications
        const notificationsRow = new Adw.ActionRow({
            title: _("Enable notifications"),
            subtitle: _("Show desktop notifications for theme changes, color extraction, and extension events")
        });
        const notificationsSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("notifications-enabled", notificationsSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        notificationsRow.add_suffix(notificationsSwitch);
        notificationsRow.set_activatable_widget(notificationsSwitch);
        indicatorGroup.add(notificationsRow);

        // Zorin OS Integration switch (moved from Theme Overlay page)
        const zorinIntegrationRow = new Adw.ActionRow({
            title: _("Enable Zorin OS Integration"),
            subtitle: _(
                "Syncs panel settings with Zorin Taskbar (margin, border radius, opacity). For Fluent-based themes, adds Zorin-style floating panel enhancements and modern aesthetics."
            )
        });
        const zorinIntegrationSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        settings.bind("enable-zorin-integration", zorinIntegrationSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        zorinIntegrationRow.add_suffix(zorinIntegrationSwitch);
        zorinIntegrationRow.activatable_widget = zorinIntegrationSwitch;
        indicatorGroup.add(zorinIntegrationRow);

        // Zorin Menu Layout Control (power user feature - not exposed in Zorin Appearance)
        const zorinMenuAvailable = _isZorinMenuAvailable();
        const zorinMenuLayoutRow = new Adw.ComboRow({
            title: _("Zorin Menu Layout Style"),
            subtitle: zorinMenuAvailable
                ? _(
                      "Standard Zorin (categories+apps+sidebar), Mint Style (hover), Grid View, Apps Only, or Shortcuts Only"
                  )
                : _("⚠️ Zorin Menu extension not installed or not enabled. Enable it first to use this feature.")
        });

        // Layout options - SHORT names like sourceThemeRow (long labels don't fit in ComboRow!)
        const layoutOptions = new Gtk.StringList();
        layoutOptions.append("ALL"); // Standard Zorin layout
        layoutOptions.append("MINT"); // Linux Mint style
        layoutOptions.append("APP_GRID"); // Grid view
        layoutOptions.append("APPS_ONLY"); // Apps list only
        layoutOptions.append("SYSTEM_ONLY"); // Shortcuts only

        zorinMenuLayoutRow.set_model(layoutOptions);

        // Set current value from settings
        const currentLayout = settings.get_string("zorin-menu-layout");
        const layoutEnums = ["ALL", "MINT", "APP_GRID", "APPS_ONLY", "SYSTEM_ONLY"];
        const layoutIndex = layoutEnums.indexOf(currentLayout);
        if (layoutIndex >= 0) {
            zorinMenuLayoutRow.set_selected(layoutIndex);
        }

        // Disable row if Zorin Menu not available
        zorinMenuLayoutRow.set_sensitive(zorinMenuAvailable);

        // Connect change signal - sync to Zorin Menu GSettings
        zorinMenuLayoutRow.connect("notify::selected", () => {
            const selectedLayout = layoutEnums[zorinMenuLayoutRow.get_selected()];

            // Save to CSSGnomme settings
            settings.set_string("zorin-menu-layout", selectedLayout);

            // Sync to Zorin Menu extension (if available)
            if (zorinMenuAvailable) {
                try {
                    const zorinMenuSettings = new Gio.Settings({
                        schema_id: "org.gnome.shell.extensions.zorin-menu"
                    });
                    zorinMenuSettings.set_string("layout", selectedLayout);
                    log(`[CSSGnomme:Prefs] Zorin Menu layout set to: ${selectedLayout}`);
                } catch (e) {
                    log(`[CSSGnomme:Prefs] Error setting Zorin Menu layout: ${e.message}`);
                }
            }
        });

        indicatorGroup.add(zorinMenuLayoutRow);

        // === ICON THEME OVERRIDE (moved from Theme Overlay page) ===
        // Toggle: Icon Theme Override
        const manualIconRow = new Adw.ActionRow({
            title: _("Icon Theme Override"),
            subtitle: _("Select icon theme independently from GTK theme (useful if theme icons missing)")
        });
        const manualIconSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("manual-icon-theme-override", manualIconSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        manualIconRow.add_suffix(manualIconSwitch);
        manualIconRow.activatable_widget = manualIconSwitch;
        indicatorGroup.add(manualIconRow);

        // Dropdown: Icon Theme Selection
        const iconThemeRow = new Adw.ComboRow({
            title: _("Icon Theme"),
            subtitle: _(
                "Select icon theme for overlay (requires icon theme override enabled and manual overlay re-creation)"
            )
        });

        /**
         * Discover installed icon themes from standard locations
         * @returns {string[]} Array of icon theme names
         */
        function _discoverInstalledIconThemes() {
            const iconThemes = new Set();
            const iconDirs = [
                GLib.get_home_dir() + "/.icons",
                GLib.get_home_dir() + "/.local/share/icons",
                "/usr/share/icons"
            ];

            iconDirs.forEach(dir => {
                try {
                    const dirFile = Gio.File.new_for_path(dir);
                    if (!dirFile.query_exists(null)) return;

                    const enumerator = dirFile.enumerate_children(
                        "standard::name,standard::type",
                        Gio.FileQueryInfoFlags.NONE,
                        null
                    );

                    let info;
                    while ((info = enumerator.next_file(null)) !== null) {
                        if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                            const themeName = info.get_name();

                            // Skip hidden directories and system reserved names
                            if (themeName.startsWith(".") || themeName === "default") {
                                continue;
                            }

                            // Verify index.theme exists (required for valid icon theme)
                            const indexPath = `${dir}/${themeName}/index.theme`;
                            if (GLib.file_test(indexPath, GLib.FileTest.EXISTS)) {
                                iconThemes.add(themeName);
                            }
                        }
                    }
                    enumerator.close(null);
                } catch (e) {
                    log(`[CSSGnomme:Prefs] Error scanning icon directory ${dir}: ${e.message}`);
                }
            });

            // Convert Set to sorted Array
            const iconArray = Array.from(iconThemes).sort();

            // Ensure Adwaita is first if it exists (system fallback)
            const adwaitaIndex = iconArray.indexOf("Adwaita");
            if (adwaitaIndex > 0) {
                iconArray.splice(adwaitaIndex, 1);
                iconArray.unshift("Adwaita");
            }

            return iconArray;
        }

        // Populate icon theme dropdown
        const iconStringList = new Gtk.StringList();
        const iconThemes = _discoverInstalledIconThemes();
        let selectedIconIndex = 0;

        const savedIconTheme = settings.get_string("selected-icon-theme");
        iconThemes.forEach((theme, index) => {
            iconStringList.append(theme);
            if (savedIconTheme && theme === savedIconTheme) {
                selectedIconIndex = index;
            }
        });

        iconThemeRow.model = iconStringList;
        iconThemeRow.set_selected(selectedIconIndex);

        // Sensitivity binding - disabled when manual override OFF
        iconThemeRow.sensitive = settings.get_boolean("manual-icon-theme-override");
        signalsHandler.add([
            settings,
            "changed::manual-icon-theme-override",
            () => {
                iconThemeRow.sensitive = settings.get_boolean("manual-icon-theme-override");
            }
        ]);

        // Save icon theme selection
        const iconThemeSignalId = iconThemeRow.connect("notify::selected", () => {
            if (blockSignals) return;

            const idx = iconThemeRow.get_selected();
            if (idx !== Gtk.INVALID_LIST_POSITION && idx < iconThemes.length) {
                const selectedIconTheme = iconThemes[idx];
                settings.set_string("selected-icon-theme", selectedIconTheme);
                log(`[CSSGnomme:Prefs] Icon theme changed to: ${selectedIconTheme}`);
            }
        });

        indicatorGroup.add(iconThemeRow);

        advancedPage.add(indicatorGroup);

        // Automation Group (Theme Auto-Switching + Full Auto Mode)
        const automationGroup = new Adw.PreferencesGroup({
            title: _("Automation")
        });

        // Auto-switch theme variant switch
        const autoSwitchColorSchemeRow = new Adw.ActionRow({
            title: _("Auto-switch between Light/Dark variants"),
            subtitle: _(
                "Monitors Quick Settings Dark/Light toggle and automatically switches to matching theme variant (e.g., ZorinPurple-Light ↔ ZorinPurple-Dark). Also filters dropdown to show only matching themes."
            )
        });
        const autoSwitchColorSchemeSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER
        });
        settings.bind("auto-switch-color-scheme", autoSwitchColorSchemeSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        autoSwitchColorSchemeRow.add_suffix(autoSwitchColorSchemeSwitch);
        autoSwitchColorSchemeRow.activatable_widget = autoSwitchColorSchemeSwitch;
        automationGroup.add(autoSwitchColorSchemeRow);

        // Full Auto Mode switch
        const fullAutoModeRow = new Adw.ActionRow({
            title: _("Full Auto Mode"),
            subtitle: _(
                "Experimental: Wallpaper extraction controls ALL colors including blur effects (border, background, shadow). When disabled, theme controls blur effects while wallpaper controls panel/popup."
            )
        });
        const fullAutoModeSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("full-auto-mode", fullAutoModeSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        fullAutoModeRow.add_suffix(fullAutoModeSwitch);
        fullAutoModeRow.set_activatable_widget(fullAutoModeSwitch);
        automationGroup.add(fullAutoModeRow);

        advancedPage.add(automationGroup);

        // Debugging group
        const debuggingGroup = new Adw.PreferencesGroup({
            title: _("Debugging")
        });

        // Debug logging
        const debugLoggingRow = new Adw.ActionRow({
            title: _("Enable debug logging"),
            subtitle: _("Enable detailed logging for troubleshooting extension issues")
        });
        const debugLoggingSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind("debug-logging", debugLoggingSwitch, "active", Gio.SettingsBindFlags.DEFAULT);
        debugLoggingRow.add_suffix(debugLoggingSwitch);
        debugLoggingRow.set_activatable_widget(debugLoggingSwitch);
        debuggingGroup.add(debugLoggingRow);

        advancedPage.add(debuggingGroup);
        window.add(advancedPage);

        // === ABOUT PAGE ===
        const aboutPage = new Adw.PreferencesPage({
            title: _("About"),
            icon_name: "help-about-symbolic"
        });

        const aboutGroup = new Adw.PreferencesGroup({
            title: _("CSS Gnommé - Dynamic GTK Theme Overlay for Zorin OS")
        });

        // Version + Author info (compact)
        const versionAuthorRow = new Adw.ActionRow({
            title: _("Version") + ": v2.5.3 | " + _("Author") + ": drdrummie",
            subtitle: _(
                "Developed for Zorin OS 18+ (GNOME Shell 46+), inspired by Cinnamon CSS Panels and gnome Open Bar extensions."
            )
        });
        aboutGroup.add(versionAuthorRow);

        aboutPage.add(aboutGroup);

        // How It Works Group
        const howItWorksGroup = new Adw.PreferencesGroup({
            title: _("How It Works")
        });

        // Overlay system explanation
        const overlayExplanationRow = new Adw.ActionRow({
            title: _("Overlay Theme System"),
            subtitle: _(
                "Creates a dynamic overlay at ~/.themes/CSSGnomme/ that sits on top of your current theme via @import. Fully reversible, doesn't modify original theme files."
            )
        });
        howItWorksGroup.add(overlayExplanationRow);

        // Color extraction explanation
        const colorExtractionRow = new Adw.ActionRow({
            title: _("Automatic Color Extraction"),
            subtitle: _(
                "Analyzes wallpaper using K-means clustering, extracts dominant and accent colors, applies darker variants to panels and brighter variants to menus. Triggers on wallpaper change or manually."
            )
        });
        howItWorksGroup.add(colorExtractionRow);

        // Blur effects explanation
        const blurEffectsRow = new Adw.ActionRow({
            title: _("Advanced Blur Effects"),
            subtitle: _(
                "Uses CSS backdrop-filter for frosted glass appearance. All settings (radius, saturate, contrast, brightness) dynamically read from preferences. Applies to menus, Alt+Tab, and shell elements."
            )
        });
        howItWorksGroup.add(blurEffectsRow);

        // Zorin Integration explanation
        const aboutZorinIntegrationRow = new Adw.ActionRow({
            title: _("Zorin OS Integration"),
            subtitle: _(
                "Enhanced styling for Zorin Taskbar and panels. Note: Window Preview uses inline JavaScript styles that override CSS."
            )
        });
        howItWorksGroup.add(aboutZorinIntegrationRow);

        // What gets styled
        const styledElementsRow = new Adw.ActionRow({
            title: _("What Gets Styled"),
            subtitle: _(
                "GNOME Shell panel, Zorin taskbar, popup menus, Alt+Tab switcher, Quick Settings, notifications, OSD, and Dash. GTK3/GTK4 apps inherit base theme with optional overrides."
            )
        });
        howItWorksGroup.add(styledElementsRow);

        // Known Limitations (consolidated)
        const knownLimitationsRow = new Adw.ActionRow({
            title: _("Known Limitations"),
            subtitle: _(
                "Theme switching: Flicker on theme refresh. Window Preview: Zorin Taskbar uses inline JavaScript styles that override CSS. Wayland: Shell restart requires logout. Performance: Heavy blur (radius > 40px) may impact older GPUs."
            )
        });
        howItWorksGroup.add(knownLimitationsRow);

        aboutPage.add(howItWorksGroup);

        window.add(aboutPage);

        // Cleanup settings connections when preferences window closes
        // Prevents memory leak from accumulated signal handlers on repeated prefs opens
        window.connect("close-request", () => {
            log("[CSSGnomme:Prefs] Window closing - cleaning up signals");

            // Disconnect ComboRow signal (UI element)
            if (comboRowSignalId !== null) {
                try {
                    sourceThemeRow.disconnect(comboRowSignalId);
                    comboRowSignalId = null;
                    log("[CSSGnomme:Prefs] ComboRow signal disconnected");
                } catch (e) {
                    log(`[CSSGnomme:Prefs] Error disconnecting ComboRow: ${e.message}`);
                }
            }

            // Disconnect all tracked signals using GlobalSignalsHandler
            log(`[CSSGnomme:Prefs] Disconnecting ${signalsHandler.getSignalCount()} signal handlers`);
            signalsHandler.destroy();

            // Dispose interfaceSettings (prefs.js owns this instance, extension.js has its own)
            if (interfaceSettings) {
                try {
                    // GNOME Review Guidelines: run_dispose() necessary in preferences process
                    // to immediately free GSettings when ColorPalette.ensureSupportedColorScheme()
                    // is called standalone (outside Extension lifecycle)
                    interfaceSettings.run_dispose();
                    interfaceSettings = null;
                    log("[CSSGnomme:Prefs] interfaceSettings disposed");
                } catch (e) {
                    log(`[CSSGnomme:Prefs] Error disposing interfaceSettings: ${e.message}`);
                }
            }

            log("[CSSGnomme:Prefs] Cleanup complete");
            return false; // Don't prevent window close
        });
    }
}
