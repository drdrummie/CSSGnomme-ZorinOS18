/**
 * CSS Gnomme Extension for Zorin OS 18 / GNOME Shell 46+ - drdrummie
 *
 * Component Lifecycle Strategy (v2.1+)
 * =====================================
 *
 * GNOME 46 Extension class is a SINGLETON (never destroyed by GNOME Shell).
 * Components use RECREATION pattern adapted from GNOME 43:
 *
 * - enable(): Create fresh instances of ColorPalette, ZorinStyler, OverlayManager
 * - disable(): Call destroy() on components and nullify references
 *
 * WHY Recreation Over Singleton?
 * - Simpler: No need for complex cleanup()/reinit() methods in components
 * - Cleaner: Guaranteed fresh state on each enable, no stale references
 * - Proven: GNOME 43 successfully uses this pattern (global variable + recreation)
 * - Performance: ~50ms overhead negligible for enable/disable (infrequent operation)
 *
 * Settings (_settings, _interfaceSettings, _shellSettings) remain SINGLETON:
 * - GSettings shared across components, never destroyed
 * - Signal connections managed separately (disconnect on disable, reconnect on enable)
 *
 * Future Optimization (v2.2+):
 * - Can switch to singleton component pattern if performance bottleneck identified
 * - Would require implementing cleanup()/reinit() methods in all components
 * - Current approach prioritizes simplicity and clean state over micro-optimization
 */

import GObject from "gi://GObject";
import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import { Extension, gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";

import * as ZorinStyler from "./ZorinStyler.js";
import { ThemeUtils } from "./themeUtils.js";
import { ColorPalette } from "./colorPalette.js";
import { OverlayThemeManager } from "./overlayThemeManager.js";
import { Constants } from "./constants.js";
import { LogLevel, Logger } from "./loggingUtils.js";
import { GlobalSignalsHandler } from "./signalHandler.js";

/**
 * Panel Indicator class - manages tray icon and menu
 */
const CSSGnommeIndicator = GObject.registerClass(
    class CSSGnommeIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, "CSSGnomme");

            this._extension = extension;
            this._settings = extension._settings;
            this._logger = extension._logger.createChild("Indicator");

            // Track menu items for signal cleanup
            this._overlayToggleItem = null;
            this._applyOverlayItem = null;
            this._menuSignalId = null;
            this._menuItemSignals = [];

            this._createPanelButton();
            this._createMenu();

            this._logger.info("Indicator initialized");
        }

        _createPanelButton() {
            this._icon = new St.Icon({
                icon_name: "preferences-desktop-theme-symbolic",
                style_class: "system-status-icon"
            });
            this.add_child(this._icon);

            // Check visibility - default to VISIBLE if setting not available
            try {
                const hideIcon = this._settings.get_boolean("hide-tray-icon");
                this.visible = !hideIcon;
                this._logger.debug(`Tray icon visibility: ${this.visible} (hide-tray-icon: ${hideIcon})`);
            } catch (e) {
                this._logger.warn(`Failed to read hide-tray-icon setting: ${e.message}, defaulting to VISIBLE`);
                this.visible = true;
            }
        }

        _createMenu() {
            let extractColorsItem = new PopupMenu.PopupMenuItem(_("Extract Colors from Background"));
            const extractSignalId = extractColorsItem.connect("activate", () => {
                this._extension._extractAndApplyColors(true); // Force bypass cache for manual extraction
            });
            this._menuItemSignals.push({ item: extractColorsItem, id: extractSignalId });
            this.menu.addMenuItem(extractColorsItem);

            // Overlay theme toggle (converted to standard item with state indicator for consistent height)
            const overlayState = this._settings.get_boolean("enable-overlay-theme");
            this._overlayToggleItem = new PopupMenu.PopupMenuItem(
                _("Enable GTK Theme Overlay") +
                    (overlayState ? Constants.UI_INDICATORS.enabled : Constants.UI_INDICATORS.disabled)
            );
            const toggleSignalId = this._overlayToggleItem.connect("activate", () => {
                const currentState = this._settings.get_boolean("enable-overlay-theme");
                this._settings.set_boolean("enable-overlay-theme", !currentState);
            });
            this._menuItemSignals.push({ item: this._overlayToggleItem, id: toggleSignalId });
            this.menu.addMenuItem(this._overlayToggleItem);

            this._applyOverlayItem = new PopupMenu.PopupMenuItem(_("Apply Overlay Changes"));
            const applySignalId = this._applyOverlayItem.connect("activate", () => {
                this._extension._applyOverlayChanges();
            });
            this._menuItemSignals.push({ item: this._applyOverlayItem, id: applySignalId });
            this.menu.addMenuItem(this._applyOverlayItem);

            // Update overlay toggle text and apply button sensitivity when state changes
            // Store signal ID for proper cleanup
            this._menuSignalId = this._settings.connect("changed::enable-overlay-theme", () => {
                if (!this._overlayToggleItem || !this._applyOverlayItem) return;
                const newState = this._settings.get_boolean("enable-overlay-theme");
                this._overlayToggleItem.label.text =
                    _("Enable GTK Theme Overlay") +
                    (newState ? Constants.UI_INDICATORS.enabled : Constants.UI_INDICATORS.disabled);
                this._applyOverlayItem.setSensitive(newState);
            });
            this._applyOverlayItem.setSensitive(this._settings.get_boolean("enable-overlay-theme"));

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let settingsItem = new PopupMenu.PopupMenuItem(_("Open Settings"));
            const settingsSignalId = settingsItem.connect("activate", () => {
                this._extension.openPreferences();
            });
            this._menuItemSignals.push({ item: settingsItem, id: settingsSignalId });
            this.menu.addMenuItem(settingsItem);
        }

        updateVisibility() {
            this.visible = !this._settings.get_boolean("hide-tray-icon");
        }

        destroy() {
            // Disconnect menu item signals to prevent memory leaks
            if (this._menuItemSignals && this._menuItemSignals.length > 0) {
                this._menuItemSignals.forEach(({ item, id }) => {
                    if (item && id) {
                        try {
                            item.disconnect(id);
                        } catch (e) {
                            // Already disconnected - ignore
                        }
                    }
                });
                this._menuItemSignals = [];
            }

            // Disconnect settings signal to prevent dangling pointer errors
            if (this._menuSignalId && this._settings) {
                this._settings.disconnect(this._menuSignalId);
                this._menuSignalId = null;
            }

            // Nullify menu item references
            this._overlayToggleItem = null;
            this._applyOverlayItem = null;

            super.destroy();
        }
    }
);

/**
 * Main extension class
 */
export default class CSSGnommeExtension extends Extension {
    constructor(metadata) {
        super(metadata);

        // Initialize instance variables
        this._indicator = null;
        this._settings = null;
        this._signalsHandler = null; // GlobalSignalsHandler for all signal connections
        this._menuItemConnections = [];
        this._isEnabled = false;
        this._logger = null;

        // Wallpaper monitoring (g43 style - extension owns bgSettings + signals)
        this._bgSettings = null;

        // ColorPalette handles caching internally - no need to track here
        this._lastColorScheme = null;
        this._lastColorSchemeTime = null;

        // Throttle tracking for rapid color-scheme changes
        this._lastColorSchemeChange = null;

        // Overlay recreation Promise tracking (for awaiting completion)
        this._overlayRecreationPromise = null;

        // Component references (initialized once, not recreated on enable/disable)
        this._zorinStyler = null;
        this._colorPalette = null;
        this._overlayManager = null;
        this._interfaceSettings = null;
        this._shellSettings = null;
        this._updateOverlayTimer = null;

        // Timer for debouncing user settings updates (prevents UI freezes)
        this._userSettingsUpdateTimer = null;

        // Guard flag for overlay recreation (prevents concurrent operations)
        this._overlayRecreationInProgress = false;
    }

    enable() {
        if (this._isEnabled) return;
        this._isEnabled = true;

        // Initialize settings (once per GNOME session, never destroyed)
        if (!this._settings) {
            this._settings = this.getSettings("org.gnome.shell.extensions.cssgnomme");
            this._logger = new Logger("Extension", this._settings);
            this._signalsHandler = new GlobalSignalsHandler();
            this._initializeDefaults();

            // Initialize interface settings FIRST (needed by ColorPalette for color-scheme detection)
            this._interfaceSettings = new Gio.Settings({ schema_id: "org.gnome.desktop.interface" });

            // Initialize shell theme settings (for user-theme extension)
            try {
                this._shellSettings = new Gio.Settings({ schema: "org.gnome.shell.extensions.user-theme" });
                this._logger.debug("Shell theme settings initialized successfully");
            } catch (e) {
                this._logger.warn("User-theme extension not available, shell theme support disabled: " + e.message);
                this._shellSettings = null;
            }
        }

        // Log on EVERY enable (not just first time)
        this._logger.always("Extension initializing components...");

        // Initialize components
        this._initializeComponents();

        // GNOME 43 pattern: Recreate components on EACH enable (destroyed on disable)
        this._zorinStyler = new ZorinStyler.ZorinStyler(this._settings, this._logger.createChild("ZorinStyler"));
        this._colorPalette = new ColorPalette(
            this._logger.createChild("ColorPalette"),
            this._settings,
            this._interfaceSettings
        );
        this._overlayManager = new OverlayThemeManager("CSSGnomme", this._logger.createChild("OverlayTheme"));

        // Initial sync of Zorin Taskbar settings (if connected)
        const initialOpacity = this._settings.get_double("panel-opacity");
        const initialMargin = this._settings.get_int("panel-margin");
        const initialRadius = this._settings.get_int("border-radius");
        this._zorinStyler.updateOpacity(initialOpacity);
        this._zorinStyler.syncPanelMargin(initialMargin);
        this._zorinStyler.syncBorderRadius(initialRadius);

        // Initial sync of Zorin Menu layout (if connected)
        const initialMenuLayout = this._settings.get_string("zorin-menu-layout");
        this._zorinStyler.syncMenuLayout(initialMenuLayout);

        // Connect settings on EACH enable (disconnected on disable)
        this._connectSettings();

        // Create panel indicator (always recreate on enable, destroyed on disable)
        if (!this._indicator) {
            this._logger.debug("Creating panel indicator...");
            this._indicator = new CSSGnommeIndicator(this);
            this._logger.debug(`Adding indicator to status area with uuid: ${this.uuid}`);
            Main.panel.addToStatusArea(this.uuid, this._indicator);
            this._logger.info("Panel indicator added to status area");
        } else {
            this._logger.debug("Panel indicator already exists, skipping creation");
        }

        this._logger.always("Extension enabling...");

        // Enable overlay theme if configured (can be toggled multiple times)
        if (this._settings.get_boolean("enable-overlay-theme")) {
            this._enableOverlayTheme();
        }

        // Setup wallpaper monitoring if configured (can be toggled multiple times)
        if (this._settings.get_boolean("auto-color-extraction")) {
            this._setupWallpaperMonitoring();
        }

        // Setup color-scheme monitoring if configured (handles Dark/Light toggle)
        if (this._settings.get_boolean("auto-switch-color-scheme")) {
            this._setupColorSchemeMonitoring();
        }

        this._logger.always("Extension enabled successfully");
    }

    /**
     * Initializes components directly in the class (future expansion point)
     */
    _initializeComponents() {
        // Future components can be initialized here
    }

    disable() {
        this._logger?.always("Extension disabling...");

        // Cleanup temporary features (can be re-enabled)
        this._cleanupWallpaperMonitoring();
        this._cleanupColorSchemeMonitoring();

        if (this._settings?.get_boolean("enable-overlay-theme")) {
            this._disableOverlayTheme();
        }

        if (this._updateOverlayTimer) {
            GLib.source_remove(this._updateOverlayTimer);
            this._updateOverlayTimer = null;
        }

        // Clear user settings update timer
        if (this._userSettingsUpdateTimer) {
            GLib.source_remove(this._userSettingsUpdateTimer);
            this._userSettingsUpdateTimer = null;
        }

        // Disconnect all settings signal handlers (prevent memory leaks)
        if (this._signalsHandler) {
            this._logger?.debug(`Disconnecting ${this._signalsHandler.getSignalCount()} signal handlers`);
            this._signalsHandler.destroy();
            this._signalsHandler = new GlobalSignalsHandler(); // Recreate for next enable()
        }

        // Remove panel indicator (will be re-added on enable)
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        // GNOME 43 pattern: DESTROY all components (will be recreated on next enable)
        if (this._colorPalette) {
            this._logger?.debug("Destroying ColorPalette instance");
            this._colorPalette.destroy();
            this._colorPalette = null; // ← NULLIFY to force recreation
        }

        if (this._overlayManager) {
            this._logger?.debug("Cleaning up OverlayThemeManager");
            // OverlayThemeManager has no explicit destroy, but nullify for recreation
            this._overlayManager = null;
        }

        if (this._zorinStyler) {
            this._logger?.debug("Cleaning up ZorinStyler");
            this._zorinStyler = null;
        }

        // Cleanup logger signals (but keep instance - shared across enable/disable)
        if (this._logger) {
            this._logger.debug("Cleaning up Logger signals");
            this._logger.cleanup(); // Use cleanup() instead of destroy() to preserve instance
        }

        // Keep ONLY settings instances for next enable()
        // _settings, _interfaceSettings, _shellSettings, _logger - NEVER destroyed
        // _zorinStyler, _colorPalette, _overlayManager - RECREATED on each enable()

        this._isEnabled = false;
        this._logger?.always("Extension disabled successfully");
    }

    _initializeDefaults() {
        if (!this._settings.get_boolean("initialized")) {
            log("[CSSGnomme:Extension:INFO] Initializing default settings");

            // === BATCH SETTINGS MODE - CRITICAL! ===
            // 26+ settings → without batch: 26 callbacks (massive callback storm!)
            // With delay/apply: 26 settings → 1 callback
            this._settings.delay();

            this._settings.set_double("panel-opacity", 0.6);
            this._settings.set_double("menu-opacity", 0.8);
            this._settings.set_boolean("override-panel-color", false);
            this._settings.set_string("choose-override-panel-color", "rgba(46, 52, 64, 0.8)");
            this._settings.set_boolean("override-popup-color", false);
            this._settings.set_string("choose-override-popup-color", "rgba(255, 255, 255, 0.9)");
            this._settings.set_int("border-radius", 12);
            this._settings.set_int("panel-margin", 8); // Floating panel default (0 = pinned)
            this._settings.set_boolean("apply-panel-radius", false);
            this._settings.set_boolean("auto-detect-radius", true);
            this._settings.set_int("blur-radius", 22);
            this._settings.set_double("blur-saturate", 0.95);
            this._settings.set_double("blur-contrast", 0.75);
            this._settings.set_double("blur-brightness", 0.65);
            this._settings.set_string("blur-background", "rgba(0, 0, 0, 0.3)");
            this._settings.set_string("blur-border-color", "rgba(255, 255, 255, 0.15)");
            this._settings.set_int("blur-border-width", 1);
            this._settings.set_double("shadow-strength", 0.4);
            this._settings.set_double("blur-opacity", 0.8);
            this._settings.set_boolean("enable-alttab-styling", false);
            this._settings.set_boolean("hide-tray-icon", false);
            this._settings.set_boolean("notifications-enabled", true);
            this._settings.set_boolean("auto-switch-color-scheme", true);
            this._settings.set_boolean("auto-color-extraction", true); // Enable wallpaper monitoring by default
            this._settings.set_boolean("initialized", true);

            // Apply all 26 settings at once - single callback!
            this._settings.apply();
            log("[CSSGnomme:Extension:INFO] Default settings initialized");
        }
    }

    _connectSettings() {
        const cssAffectingSettings = [
            "menu-opacity",
            "border-radius",
            "apply-panel-radius", // Controls whether border-radius is applied to #panel in CSS
            "auto-detect-radius",
            "blur-radius",
            "blur-saturate",
            "blur-contrast",
            "blur-brightness",
            "blur-background",
            "blur-border-color",
            "blur-border-width",
            "shadow-strength",
            "shadow-color",
            "blur-opacity",
            "override-panel-color",
            "choose-override-panel-color",
            "override-popup-color",
            "choose-override-popup-color"
        ];

        // Build signal definitions for CSS affecting settings
        const cssSignalDefs = cssAffectingSettings.map(setting => [
            this._settings,
            `changed::${setting}`,
            () => this._onCssSettingChanged(setting)
        ]);

        // Add all signals at once using GlobalSignalsHandler
        this._signalsHandler.add(
            ...cssSignalDefs,
            [
                this._settings,
                "changed::panel-opacity",
                () => {
                    const opacity = this._settings.get_double("panel-opacity");
                    this._zorinStyler.updateOpacity(opacity);
                    this._onCssSettingChanged("panel-opacity");
                }
            ],
            [
                this._settings,
                "changed::panel-margin",
                () => {
                    const margin = this._settings.get_int("panel-margin");
                    this._zorinStyler.syncPanelMargin(margin);
                    this._onCssSettingChanged("panel-margin");
                }
            ],
            [
                this._settings,
                "changed::border-radius",
                () => {
                    const radius = this._settings.get_int("border-radius");
                    this._zorinStyler.syncBorderRadius(radius);
                    this._onCssSettingChanged("border-radius");
                }
            ],
            [
                this._settings,
                "changed::zorin-menu-layout",
                () => {
                    const layout = this._settings.get_string("zorin-menu-layout");
                    this._zorinStyler.syncMenuLayout(layout);
                    this._logger.info(`Zorin Menu layout changed to: ${layout}`);
                }
            ],
            [
                this._settings,
                "changed::hide-tray-icon",
                () => {
                    if (this._indicator) this._indicator.updateVisibility();
                }
            ],
            [
                this._settings,
                "changed::enable-zorin-integration",
                () => {
                    const enabled = this._settings.get_boolean("enable-zorin-integration");
                    this._logger.info(`Zorin Integration changed to: ${enabled}`);
                    // Recreate overlay to apply/remove Fluent enhancements
                    if (this._settings.get_boolean("enable-overlay-theme")) {
                        this._recreateOverlayTheme();
                    }
                }
            ],
            [
                this._settings,
                "changed::zorin-tint-strength",
                () => {
                    const strength = this._settings.get_int("zorin-tint-strength");
                    this._logger.info(`Zorin tint strength changed to: ${strength}%`);
                    // Recreate overlay to apply new tint strength (affects base-theme.css generation)
                    if (this._settings.get_boolean("enable-overlay-theme")) {
                        this._recreateOverlayTheme();
                    }
                }
            ],
            [
                this._settings,
                "changed::enable-overlay-theme",
                () => {
                    const enabled = this._settings.get_boolean("enable-overlay-theme");
                    enabled ? this._enableOverlayTheme() : this._disableOverlayTheme();
                }
            ],
            [
                this._settings,
                "changed::overlay-source-theme",
                () => {
                    const sourceTheme = this._settings.get_string("overlay-source-theme");
                    this._logger.info(`Overlay source theme changed to: ${sourceTheme}`);

                    // Recreate overlay when source theme changes in prefs dropdown
                    const overlayEnabled = this._settings.get_boolean("enable-overlay-theme");
                    if (overlayEnabled) {
                        this._logger.info("Source theme changed - recreating overlay...");
                        this._recreateOverlayTheme();
                    } else {
                        this._logger.info("Overlay disabled - source theme change queued for next enable");
                    }

                    // Auto-detect border-radius from selected theme if enabled
                    if (this._settings.get_boolean("auto-detect-radius") && sourceTheme) {
                        this._detectAndApplyBorderRadius(sourceTheme);
                    }

                    // Extract colors from wallpaper if auto-extraction enabled
                    if (this._settings.get_boolean("auto-color-extraction")) {
                        this._logger.info("Auto-extracting colors from wallpaper");
                        this._handleColorSchemeChange("theme-source-change");
                    }
                }
            ],
            [
                this._settings,
                "changed::manual-apply-trigger",
                () => {
                    this._applyOverlayChanges();
                }
            ],
            [
                this._settings,
                "changed::trigger-color-extraction",
                () => {
                    // Guard: Skip if extension not fully enabled
                    if (!this._isEnabled || !this._logger) return;

                    this._logger.info("Manual color extraction triggered from preferences - FORCED");
                    this._handleColorSchemeChange("preference-trigger", true); // Force extraction
                }
            ],
            [
                this._settings,
                "changed::trigger-recreate-overlay",
                () => {
                    // Guard: Skip if extension not fully enabled
                    if (!this._isEnabled || !this._logger) return;

                    this._recreateOverlayTheme();
                }
            ],
            [
                this._settings,
                "changed::auto-color-extraction",
                () => {
                    // Guard: Skip if extension not fully enabled (called from prefs.js during init)
                    if (!this._isEnabled || !this._logger) return;

                    const enabled = this._settings.get_boolean("auto-color-extraction");
                    this._logger.info(`Auto color extraction ${enabled ? "enabled" : "disabled"}`);
                    enabled ? this._setupWallpaperMonitoring() : this._cleanupWallpaperMonitoring();
                }
            ],
            [
                this._settings,
                "changed::debug-logging",
                () => {
                    const enabled = this._settings.get_boolean("debug-logging");
                    this._logger.always(`Debug logging ${enabled ? "enabled" : "disabled"}`);
                }
            ],
            [
                this._settings,
                "changed::enable-alttab-styling",
                () => {
                    if (!this._isEnabled) return;
                    const enabled = this._settings.get_boolean("enable-alttab-styling");
                    this._logger.info(`Alt-Tab styling changed to: ${enabled}`);
                }
            ],
            [
                this._settings,
                "changed::auto-switch-color-scheme",
                () => {
                    // Guard: Skip if extension not fully enabled (called from prefs.js during init)
                    if (!this._isEnabled || !this._logger || !this._interfaceSettings) return;

                    const enabled = this._settings.get_boolean("auto-switch-color-scheme");
                    this._logger.info(`Auto theme variant switching ${enabled ? "enabled" : "disabled"}`);

                    if (enabled) {
                        // Setup color-scheme monitoring
                        this._setupColorSchemeMonitoring();

                        // Sync color-scheme with current theme
                        const sourceTheme = this._settings.get_string("overlay-source-theme");
                        if (sourceTheme) {
                            const isDarkTheme = sourceTheme.toLowerCase().includes("dark");
                            const newScheme = isDarkTheme ? "prefer-dark" : "default";
                            this._interfaceSettings.set_string("color-scheme", newScheme);
                            this._logger.info(`Synced color-scheme to: ${newScheme} (based on theme: ${sourceTheme})`);
                        }
                    } else {
                        // Cleanup monitoring when disabled
                        this._cleanupColorSchemeMonitoring();
                    }
                }
            ]
        );
    }

    /**
     * Generic handler for CSS-affecting settings
     * Automatically schedules overlay update if overlay is enabled
     * @private
     * @param {string} settingName - Name of the changed setting
     */
    _onCssSettingChanged(settingName) {
        if (!this._isEnabled) return;
        this._logger.debug(`CSS setting changed: ${settingName}`);
        if (this._settings.get_boolean("enable-overlay-theme")) {
            this._scheduleOverlayUpdate("user-settings");
        }
    }

    /**
     * Centralized handler for color-scheme and wallpaper changes
     * Prevents duplicate regenerations by queuing operations
     * @param {string} triggerReason - Reason for activation (e.g., 'wallpaper-change', 'color-scheme-switch')
     * @param {boolean} forceExtraction - Skip cache check and force fresh extraction
     */
    _handleColorSchemeChange(triggerReason, forceExtraction = false) {
        if (!this._isEnabled) return;

        const now = Date.now();

        // Throttle rapid triggers (e.g., wallpaper slideshow, multiple monitors)
        // UNLESS forceExtraction is true (manual button click)
        if (!forceExtraction && this._lastColorSchemeChange && now - this._lastColorSchemeChange < 1000) {
            this._logger.debug(`Throttling color-scheme change: ${triggerReason} (< 1s since last)`);
            return;
        }
        this._lastColorSchemeChange = now;

        this._logger.info(`Color scheme change triggered by: ${triggerReason}${forceExtraction ? " (FORCED)" : ""}`);

        // Queue color extraction if auto-extraction enabled OR forced
        const autoExtractionEnabled = this._settings.get_boolean("auto-color-extraction");
        this._logger.debug(`Auto-extraction check: enabled=${autoExtractionEnabled}, forced=${forceExtraction}`);

        if (autoExtractionEnabled || forceExtraction) {
            this._extractAndApplyColors(forceExtraction);
        } else {
            // FIX: Apply theme-based default colors when auto-extraction disabled
            // This ensures panel colors refresh after Dark↔Light theme toggle
            this._logger.info(`Auto-extraction disabled - applying theme-based default colors`);
            this._setDefaultPanelColors();
        }

        // Note: Overlay recreation is handled by overlay-source-theme setting callback
        // when auto-switching changes the theme variant
    }

    /**
     * Extract colors from background and apply to settings
     * OPTIMIZATION: Skips extraction if wallpaper hasn't changed (unless forced)
     * @param {boolean} forceExtraction - Skip cache check and force fresh extraction
     */
    _extractAndApplyColors(forceExtraction = false) {
        try {
            // ColorPalette has internal cache with keys: (uri + preferLight)
            // Let it handle caching - we just call it on every trigger
            // Cache will return instantly if colors already extracted for this (wallpaper + mode)

            if (forceExtraction) {
                this._logger.info(`Force extraction requested - bypassing ColorPalette cache`);
            }

            // Extract colors using gtk-theme suffix as primary detection method
            // ColorPalette.extractFromCurrentBackground() will:
            // 1. Detect current color-scheme (prefer-dark / default)
            // 2. Check correct wallpaper key (picture-uri-dark / picture-uri)
            // 3. Check cache for (uri + preferLight) combination
            // 4. Return cached colors if available, or extract if needed
            const colorScheme = this._colorPalette.extractFromCurrentBackground(forceExtraction);

            if (colorScheme) {
                this._colorPalette.applyColorsToSettings(this._settings, colorScheme);

                // Show notification
                this._notify("CSSGnomme", _("Colors extracted and applied from background image"));

                this._logger.info("Color extraction successful", {
                    accent: colorScheme.accent,
                    background: colorScheme.background
                });
            } else {
                this._notify("CSSGnomme", _("No background image found or unable to extract colors"));
                this._logger.info("Color extraction failed - no background image");
            }
        } catch (error) {
            this._logger.error("Error extracting colors", error.toString());
            this._notify("CSSGnomme", _("Error extracting colors: ") + error.message);
        }
    }

    /**
     * Setup wallpaper monitoring for auto color extraction
     * SHARED: Keep in sync with g43-extension.js _setupWallpaperMonitoring()
     * GNOME 46 Fix: Extension owns bgSettings + signals directly (not delegated to ColorPalette)
     */
    /**
     * Setup color-scheme monitoring for auto theme variant switching
     */
    _setupColorSchemeMonitoring() {
        // Check if already monitoring
        if (!this._interfaceSettings) {
            this._logger.warn("Interface settings not available, cannot setup color-scheme monitoring");
            return;
        }

        try {
            // Add color-scheme change signal to global handler
            this._signalsHandler.add([
                this._interfaceSettings,
                "changed::color-scheme",
                async () => {
                    const colorScheme = this._interfaceSettings.get_string("color-scheme");
                    const preferDark = colorScheme === "prefer-dark";
                    const currentTheme = this._settings.get_string("overlay-source-theme");

                    // OPTIMIZATION: Skip redundant triggers within 5s window
                    const now = Date.now();
                    if (
                        this._lastColorScheme === colorScheme &&
                        this._lastColorSchemeTime &&
                        now - this._lastColorSchemeTime < 5000
                    ) {
                        this._logger.debug(
                            `Skipping redundant color-scheme trigger: ${colorScheme} (within 5s window)`
                        );
                        return;
                    }
                    this._lastColorScheme = colorScheme;
                    this._lastColorSchemeTime = now;

                    this._logger.info(`Color-scheme changed to: ${colorScheme} (current theme: ${currentTheme})`);

                    // Find matching theme variant
                    const matchingVariant = this._findMatchingThemeVariant(currentTheme, preferDark);

                    if (matchingVariant && matchingVariant !== currentTheme) {
                        this._logger.info(`Auto-switching theme variant: ${currentTheme} → ${matchingVariant}`);

                        // SUSPEND auto-color-extraction during theme recreation to avoid duplicate processing
                        const autoExtractEnabled = this._settings.get_boolean("auto-color-extraction");
                        if (autoExtractEnabled) {
                            this._settings.set_boolean("auto-color-extraction", false);
                            this._logger.debug("Temporarily suspended auto-color-extraction for theme switch");
                        }

                        try {
                            // Switch to matching variant (triggers overlay recreation via callback)
                            this._settings.set_string("overlay-source-theme", matchingVariant);

                            // Wait for overlay recreation to ACTUALLY complete (via Promise)
                            // No more fixed 500ms delay - waits exactly as long as needed!
                            await this._overlayRecreationPromise;
                            this._logger.debug("Overlay recreation completed, proceeding with color extraction");
                        } finally {
                            // RESTORE auto-extraction after theme switch completes
                            if (autoExtractEnabled) {
                                this._settings.set_boolean("auto-color-extraction", true);
                                this._logger.debug("Restored auto-color-extraction after theme switch");
                            }
                        }

                        // NOW extract colors OR apply theme defaults (single pass after theme switch complete)
                        this._handleColorSchemeChange("color-scheme-complete");
                    } else if (!matchingVariant) {
                        this._logger.info(
                            `No matching ${preferDark ? "dark" : "light"} variant found for ${currentTheme}`
                        );
                        // Still handle color extraction for non-variant-switching themes
                        this._handleColorSchemeChange("color-scheme-switch");
                    } else {
                        this._logger.debug(`Theme ${currentTheme} already matches color-scheme preference`);
                        // Handle color extraction for already-matched themes
                        this._handleColorSchemeChange("color-scheme-switch");
                    }
                }
            ]);

            this._logger.info("Color-scheme monitoring active");
        } catch (error) {
            this._logger.error("Failed to setup color-scheme monitoring", error.toString());
        }
    }

    /**
     * Cleanup color-scheme monitoring
     * Signals are automatically cleaned by GlobalSignalsHandler.destroy()
     */
    _cleanupColorSchemeMonitoring() {
        // No-op: GlobalSignalsHandler handles signal cleanup in disable()
        this._logger?.debug("Color-scheme monitoring cleanup (handled by GlobalSignalsHandler)");
    }

    /**
     * Setup wallpaper monitoring
     */
    _setupWallpaperMonitoring() {
        if (this._bgSettings) {
            return; // Already setup
        }

        try {
            this._logger.info("Setting up wallpaper monitoring for auto color extraction");

            // Get background settings
            this._bgSettings = new Gio.Settings({
                schema_id: "org.gnome.desktop.background"
            });

            // Monitor wallpaper changes using GlobalSignalsHandler
            this._signalsHandler.add(
                [
                    this._bgSettings,
                    "changed::picture-uri",
                    () => {
                        this._logger.info("Wallpaper changed (light mode)");
                        this._handleColorSchemeChange("wallpaper-change-light");
                    }
                ],
                [
                    this._bgSettings,
                    "changed::picture-uri-dark",
                    () => {
                        this._logger.info("Wallpaper changed (dark mode)");
                        this._handleColorSchemeChange("wallpaper-change-dark");
                    }
                ]
            );

            this._logger.info("Wallpaper monitoring active");
        } catch (error) {
            this._logger.error("Error setting up wallpaper monitoring: " + error.message);
        }
    }

    /**
     * Cleanup wallpaper monitoring
     * Signals are automatically cleaned by GlobalSignalsHandler.destroy()
     */
    _cleanupWallpaperMonitoring() {
        if (this._bgSettings) {
            this._logger.debug("Cleaning up wallpaper monitoring");
            // GNOME Review Guidelines: run_dispose() necessary to immediately free GSettings
            // for org.gnome.desktop.background to prevent stale callbacks during extension reload
            this._bgSettings.run_dispose();
            this._bgSettings = null;
        }
    }

    /**
     * Show desktop notification (respects notifications-enabled setting)
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     */
    _notify(title, message) {
        // Guard against calls before settings initialized
        if (!this._settings) {
            return;
        }

        // Check if notifications are enabled
        if (!this._settings.get_boolean("notifications-enabled")) {
            this._logger.debug(`Notification suppressed (disabled): ${title} - ${message}`);
            return;
        }

        try {
            Main.notify(title, message);
        } catch (error) {
            this._logger.error(`Failed to show notification: ${error.message}`);
        }
    }

    /**
     * Open extension preferences window
     */
    _openPreferences() {
        try {
            this.openPreferences();
        } catch (error) {
            this._logger.error("Failed to open preferences", error.toString());
        }
    }

    /**
     * Reset extension settings to defaults
     */
    _resetToDefaults() {
        this._logger.info("Resetting to defaults");
        // Future: Implement reset logic if needed
    }

    /**
     * Set default panel/popup colors based on theme brightness
     * Uses fallback colors from Constants when wallpaper extraction is disabled or fails
     * @private
     */
    _setDefaultPanelColors() {
        try {
            // Determine if current theme is dark or light
            const sourceTheme = this._settings.get_string("overlay-source-theme");
            const sourcePath = this._overlayManager.discoverSourceTheme(sourceTheme);

            if (!sourcePath) {
                this._logger.warn("Cannot determine theme brightness, using dark theme defaults");
                // Fallback to dark theme colors
                const panelColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.darkPanel, 0.8);
                const popupColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.darkPopup, 0.9);

                this._settings.set_string("choose-override-panel-color", panelColor);
                this._settings.set_string("choose-override-popup-color", popupColor);
                return;
            }

            // Detect theme brightness
            const isLightTheme = this._overlayManager._isLightTheme(sourcePath);

            // Set appropriate default colors based on theme brightness
            if (isLightTheme) {
                const panelColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.lightPanel, 0.8);
                const popupColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.lightPopup, 0.9);
                this._settings.set_string("choose-override-panel-color", panelColor);
                this._settings.set_string("choose-override-popup-color", popupColor);
                this._logger.info("Applied light theme default colors from constants");
            } else {
                const panelColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.darkPanel, 0.8);
                const popupColor = ThemeUtils.rgbaToCss(...Constants.FALLBACK_COLORS.darkPopup, 0.9);
                this._settings.set_string("choose-override-panel-color", panelColor);
                this._settings.set_string("choose-override-popup-color", popupColor);
                this._logger.info("Applied dark theme default colors from constants");
            }
        } catch (error) {
            this._logger.error("Error setting default panel colors", error.toString());
        }
    }

    /**
     * Find matching Dark/Light theme variant
     * @param {string} currentTheme - Current theme name
     * @param {boolean} preferDark - Whether to prefer dark variant
     * @returns {string|null} Matching theme name or null if not found
     */
    _findMatchingThemeVariant(currentTheme, preferDark) {
        // Pattern: base-(Dark|Light)-modifiers
        const pattern = /^(.+)-(Dark|Light)((?:-\w+)*)$/i;
        const match = currentTheme.match(pattern);

        if (!match) {
            this._logger.debug(`Theme ${currentTheme} doesn't follow Dark/Light variant pattern`);
            return null;
        }

        const [, baseName, currentVariant, trailingModifiers] = match;
        const isDark = currentVariant.toLowerCase() === "dark";

        // Already matches preference
        if (isDark === preferDark) {
            this._logger.debug(`Theme ${currentTheme} already matches color-scheme preference`);
            return currentTheme;
        }

        // Build target variant name
        const targetVariant = preferDark ? "Dark" : "Light";
        const targetTheme = `${baseName}-${targetVariant}${trailingModifiers}`;

        // Verify target theme exists using discoverSourceTheme
        const themePath = this._overlayManager.discoverSourceTheme(targetTheme);
        if (themePath) {
            this._logger.info(`Found matching variant: ${currentTheme} → ${targetTheme}`);
            return targetTheme;
        } else {
            this._logger.debug(`Target theme ${targetTheme} not found in installed themes`);
            return null;
        }
    }

    /**
     * Apply overlay theme changes (manual trigger)
     */
    _applyOverlayChanges() {
        if (!this._settings.get_boolean("enable-overlay-theme")) {
            this._notify("CSSGnomme", _("Overlay theme is not enabled"));
            return;
        }

        try {
            this._logger.info("Manually applying overlay changes");

            // Extract wallpaper colors if auto-extraction is enabled
            const autoExtract = this._settings.get_boolean("auto-color-extraction");
            if (autoExtract) {
                this._logger.info("Auto color extraction enabled, extracting from wallpaper");
                const colorScheme = this._colorPalette.extractFromCurrentBackground();
                if (colorScheme) {
                    this._colorPalette.applyColorsToSettings(this._settings, colorScheme);
                    this._logger.info("Applied wallpaper colors: panel and popup backgrounds");
                } else {
                    this._logger.info("No wallpaper found, applying theme-based default colors");
                    this._setDefaultPanelColors();
                }
            } else {
                this._logger.info("Auto color extraction disabled, applying theme-based default colors");
                this._setDefaultPanelColors();
            }

            // Update overlay CSS with accent color detection
            if (this._overlayManager.updateOverlayCss(this._settings, true, this._interfaceSettings)) {
                this._overlayManager.refreshTheme(this._interfaceSettings);

                this._notify("CSSGnomme", _("Overlay theme updated successfully"));
                this._logger.info("Overlay manually updated and refreshed");
            } else {
                this._notify("CSSGnomme", _("Failed to update overlay theme"));
                this._logger.warn("Overlay update failed");
            }
        } catch (error) {
            this._logger.error("Error applying overlay changes", error.toString());
            this._notify("CSSGnomme", _("Error: ") + error.message);
        }
    }

    _enableOverlayTheme() {
        try {
            let sourceTheme = this._settings.get_string("overlay-source-theme");

            // If no source theme set, use current GTK theme
            if (!sourceTheme || sourceTheme === "") {
                sourceTheme = this._overlayManager.getCurrentTheme(this._interfaceSettings);
                this._settings.set_string("overlay-source-theme", sourceTheme);
                this._logger.info(`Using current theme as source: ${sourceTheme}`);
            }

            // Check if overlay already exists
            if (this._overlayManager.overlayExists()) {
                this._logger.info("Overlay already exists, activating");
                this._overlayManager.activateOverlay(this._interfaceSettings, this._settings);
            } else {
                this._logger.info(`Creating new overlay from: ${sourceTheme}`);

                if (this._overlayManager.createOverlayTheme(sourceTheme, this._settings, this._interfaceSettings)) {
                    this._overlayManager.activateOverlay(this._interfaceSettings, this._settings);
                    this._overlayManager.logOverlayInfo();

                    this._notify("CSS Gnomme", _("Overlay theme created and activated"));
                } else {
                    this._settings.set_boolean("enable-overlay-theme", false);
                    this._notify("CSS Gnomme", _("Failed to create overlay theme"));
                }
            }

            // ZorinStyler only handles Zorin Taskbar transparency (no CSS injection)
            this._logger.info("ZorinStyler manages Zorin Taskbar transparency only");
        } catch (error) {
            this._logger.error("Error enabling overlay theme", error.toString());
            this._settings.set_boolean("enable-overlay-theme", false);
            this._notify("CSS Gnomme", _("Error enabling overlay: ") + error.message);
        }
    }

    _disableOverlayTheme() {
        this._logger.info("Disabling overlay theme");

        try {
            // Restore original themes using overlayManager (reads from index.theme)
            const restored = this._overlayManager.restoreOriginalTheme(this._interfaceSettings, this._settings);

            if (restored) {
                this._logger.info("Overlay theme disabled successfully");
                this._notify("CSS Gnomme", _("Overlay theme disabled"));
            } else {
                this._logger.warn("Could not fully restore original themes");
            }
        } catch (error) {
            this._logger.error(`Failed to disable overlay: ${error}`);
            this._notify("CSS Gnomme", _("Error: ") + error.message);
        }
    }

    _recreateOverlayTheme() {
        // Guard against concurrent recreations
        if (this._overlayRecreationInProgress) {
            this._logger.debug("Overlay recreation already in progress, skipping duplicate request");
            return this._overlayRecreationPromise; // Return existing promise
        }

        this._overlayRecreationInProgress = true;

        // Create Promise that resolves when recreation completes
        this._overlayRecreationPromise = new Promise(resolve => {
            // Use GLib.idle_add to ensure recreation finishes before resolving
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                try {
                    this._performOverlayRecreation();
                    resolve(true);
                } catch (error) {
                    this._logger.error("Error in overlay recreation: " + error.toString());
                    resolve(false);
                } finally {
                    this._overlayRecreationInProgress = false;
                    this._overlayRecreationPromise = null;
                }
                return GLib.SOURCE_REMOVE;
            });
        });

        return this._overlayRecreationPromise;
    }

    /**
     * Perform overlay recreation (internal - called by _recreateOverlayTheme Promise)
     * @private
     */
    _performOverlayRecreation() {
        try {
            this._logger.info("Recreating overlay theme");

            // Use current colors from settings - color extraction handled by _handleColorSchemeChange
            this._logger.info("Using current colors from settings for overlay recreation");

            // Recreate overlay
            // Pass interfaceSettings to preserve original icon theme
            const success = this._overlayManager.recreateOverlay(this._settings, this._interfaceSettings);

            if (success) {
                // Auto-apply overlay if enabled (recreate → apply flow)
                // This ensures theme switches on dropdown change & dark/light toggle
                const overlayEnabled = this._settings.get_boolean("enable-overlay-theme");
                if (overlayEnabled) {
                    this._logger.info("Auto-applying overlay after recreate (overlay is enabled)");

                    // Apply overlay theme (set gtk-theme to CSSGnomme)
                    this._interfaceSettings.set_string("gtk-theme", this._overlayManager.overlayName);

                    // Force Shell theme reload using Main.loadTheme() API (instant, no flicker)
                    // Pattern from user-theme extension - direct API call instead of GSettings clear+set
                    if (this._shellSettings) {
                        try {
                            // Set shell theme name in GSettings (user-theme reads this)
                            this._shellSettings.set_string("name", this._overlayManager.overlayName);
                            this._logger.info("Shell theme GSettings updated to overlay");

                            // Force immediate reload using Main API (no cache delay)
                            Main.loadTheme();
                            this._logger.debug("Shell theme reloaded via Main.loadTheme() - instant refresh");
                        } catch (e) {
                            this._logger.error("Failed to reload shell theme: " + e.message);
                        }
                    } else {
                        this._logger.warn("Shell theme settings not available (user-theme extension not installed)");
                    }
                }
                // Get newly detected accent color to show in notification
                const borderColor = this._settings.get_string("blur-border-color");
                const match = borderColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                const colorHint = match ? ` (accent: rgb(${match[1]}, ${match[2]}, ${match[3]}))` : "";

                // Show appropriate status message
                const statusMsg = overlayEnabled
                    ? _("Overlay theme recreated and applied")
                    : _("Overlay theme recreated (enable to apply)");

                this._notify("CSSGnomme", statusMsg); // + colorHint);
            } else {
                this._notify("CSSGnomme", _("Failed to recreate overlay"));
                this._logger.warn("Overlay recreation returned false");
            }
        } catch (error) {
            this._logger.error("Error recreating overlay", error.toString());
            this._notify("CSSGnomme", _("Error: ") + error.message);
        }
    }

    /**
     * Auto-set shadow color based on theme brightness (light/dark)
     * @private
     * @param {string} sourceTheme - Name of the source theme
     */
    _autoSetShadowColor(sourceTheme) {
        try {
            const sourcePath = this._overlayManager.discoverSourceTheme(sourceTheme);
            if (!sourcePath) {
                this._logger.warn(`Cannot auto-set shadow color: theme ${sourceTheme} not found`);
                return;
            }

            const isLightTheme = this._overlayManager._isLightTheme(sourcePath);
            const defaultOpacity = this._settings.get_double("shadow-strength") || 0.7;
            const rgbValues = isLightTheme ? Constants.SHADOW_COLOR_RGB.light : Constants.SHADOW_COLOR_RGB.dark;
            const rgbaString = `rgba(${rgbValues.join(", ")}, ${defaultOpacity})`;

            this._settings.set_string("shadow-color", rgbaString);
            this._logger.info(`Auto-set shadow color to: ${rgbaString} (${isLightTheme ? "light" : "dark"} theme)`);
        } catch (e) {
            this._logger.error(`Error auto-setting shadow color: ${e.message}`);
            // Fallback to white shadow
            this._settings.set_string("shadow-color", Constants.DEFAULT_SHADOW_COLORS.light);
        }
    }

    /**
     * Detect and apply border-radius from theme
     * Called when overlay-source-theme changes and auto-detect-radius is enabled
     * @param {string} themeName - Name of the theme to analyze
     */
    _detectAndApplyBorderRadius(themeName) {
        if (!this._overlayManager) {
            this._logger.warn("OverlayManager not initialized, cannot detect border-radius");
            return;
        }

        this._logger.info(`Auto-detecting border-radius from theme: ${themeName}`);

        try {
            const detectedRadius = this._overlayManager.detectThemeBorderRadius(themeName);

            if (detectedRadius !== null) {
                const currentRadius = this._settings.get_int("border-radius");
                if (detectedRadius !== currentRadius) {
                    this._settings.set_int("border-radius", detectedRadius);
                    this._logger.info(`Border radius updated: ${currentRadius}px → ${detectedRadius}px`);
                    this._notify("CSS Gnomme", _(`Detected border-radius: ${detectedRadius}px from ${themeName}`));
                } else {
                    this._logger.info(`Border-radius already set to detected value: ${detectedRadius}px`);
                }
            } else {
                this._logger.info(`Could not detect border-radius from ${themeName}, keeping current value`);
            }
        } catch (error) {
            this._logger.error(`Failed to detect border-radius: ${error.message}`);
        }
    }

    /**
     * Setup overlay theme debounced auto-update
     * Note: Individual setting callbacks (_onCssSettingChanged, etc.) now handle
     * calling _scheduleOverlayUpdate(), so this method is no longer needed for
     * duplicate tracking. Keeping it for future expansion or non-tracked settings.
     * @private
     */
    _setupOverlayAutoUpdate() {
        if (!this._settings.get_boolean("overlay-auto-update")) {
            return;
        }

        // All overlay-affecting settings are now tracked in their respective callbacks
        // (_onCssSettingChanged for CSS properties, overlay-source-theme callback, etc.)
        // This prevents duplicate signal connections and ensures proper debouncing

        this._logger.info("Overlay auto-update configured (via setting callbacks)");
    }

    /**
     * Debounce user settings updates to prevent UI freezes during rapid changes
     * Uses 2-3 second delay as requested for smooth user experience
     * @private
     */
    _debounceUserSettingsUpdate() {
        // Guard: If timer already running, extend it instead of creating duplicate
        if (this._userSettingsUpdateTimer) {
            this._logger.debug("Debounce timer already active - extending delay");
            GLib.source_remove(this._userSettingsUpdateTimer);
            this._userSettingsUpdateTimer = null;
        }

        // Set new debounce timer (user settings context)
        this._userSettingsUpdateTimer = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            Constants.OVERLAY_UPDATE_DEBOUNCE.userSettings,
            () => {
                this._logger.info("Performing debounced overlay update [user-settings]...");
                this._userSettingsUpdateTimer = null;

                // Perform the actual update
                if (
                    this._overlayManager &&
                    this._overlayManager.updateOverlayCss(this._settings, false, this._interfaceSettings)
                ) {
                    // Use Main.loadTheme() for instant Shell theme reload (user-theme pattern)
                    if (this._shellSettings) {
                        try {
                            Main.loadTheme();
                            this._logger.debug("Shell theme reloaded via Main.loadTheme() after debounced CSS update");
                        } catch (e) {
                            this._logger.warn("Failed to reload shell theme after debounced CSS update: " + e.message);
                        }
                    }

                    this._overlayManager.refreshTheme(this._interfaceSettings);
                    this._logger.info("Debounced overlay updated successfully");
                } else {
                    this._logger.info("Debounced overlay update failed or manager not initialized");
                }

                return GLib.SOURCE_REMOVE;
            }
        );
    }

    /**
     * Schedule overlay update with optional debouncing for user settings
     * @param {string} triggerContext - Context that triggered the update
     */
    _scheduleOverlayUpdate(triggerContext = "generic") {
        // Guard: Don't schedule updates when extension is disabled
        if (!this._isEnabled) {
            this._logger.debug("Overlay update skipped - extension disabled");
            return;
        }

        if (!this._settings.get_boolean("enable-overlay-theme")) {
            this._logger.info("Overlay update skipped - overlay theme disabled");
            return;
        }

        // For user-settings changes, use debounce to prevent UI freezes
        if (triggerContext === "user-settings") {
            // Only log first call in debounce window to reduce log spam
            if (!this._userSettingsUpdateTimer) {
                this._logger.debug(`_scheduleOverlayUpdate called with trigger: ${triggerContext}`);
            }
            this._debounceUserSettingsUpdate();
            return;
        }

        // Log non-debounced updates
        this._logger.debug(`_scheduleOverlayUpdate called with trigger: ${triggerContext}`);

        this._logger.info(`Performing overlay update [${triggerContext}] (immediate)...`);

        // Perform update immediately (sync operations are fast)
        if (
            this._overlayManager &&
            this._overlayManager.updateOverlayCss(this._settings, false, this._interfaceSettings)
        ) {
            // Use Main.loadTheme() for instant Shell theme reload (user-theme pattern)
            if (this._shellSettings) {
                try {
                    Main.loadTheme();
                    this._logger.debug("Shell theme reloaded via Main.loadTheme() after CSS update");
                } catch (e) {
                    this._logger.warn("Failed to reload shell theme after CSS update: " + e.message);
                }
            }

            this._overlayManager.refreshTheme(this._interfaceSettings);
            this._logger.info("Overlay updated successfully");
        } else {
            this._logger.info("Overlay update failed or manager not initialized");
        }
    }
}
