/**
 * cssTemplates.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * CSS template generation for theme overlay
 */

import { Constants } from "./constants.js";
import { ThemeUtils } from "./themeUtils.js";

/* cssTemplates.js
 *
 * CSS Template Strings for CSSGnomme Theme Overlay Generation
 * Separated from overlayThemeManager.js for better organization and string pooling
 * OPTIMIZATION: Reusable templates reduce memory allocation during theme generation
 */

/**
 * CSS Template Generator
 * Provides reusable CSS template strings with parameter substitution
 * All templates are cached in memory for reuse across multiple theme generations
 */
export class CSSTemplates {
    /**
     * Initialize CSS template cache
     * Templates are compiled once and reused for performance
     */
    constructor() {
        // Cache compiled templates for reuse
        this._templateCache = new Map();
    }

    // ===== GTK THEME IMPORT TEMPLATES =====

    /**
     * Generate GTK theme import statement
     * @param {string} sourceThemePath - Path to source theme CSS
     * @param {boolean} isDark - Is dark variant
     * @returns {string} CSS import statement
     */
    getGtkImport(sourceThemePath, isDark) {
        const variant = isDark ? "dark" : "light";
        return `/* Base theme import - tint removed, original styles preserved */\n@import url('${sourceThemePath}');\n\n`;
    }

    /**
     * Generate GTK base CSS wrapper
     * @param {string} version - GTK version (gtk-3.0, gtk-4.0)
     * @param {string} modifiedCss - Modified CSS content
     * @returns {string} Complete CSS with header
     */
    getGtkBaseCssWrapper(version, modifiedCss) {
        return `/* CSSGnomme Overlay - ${version} Base Theme
 * Original theme CSS with Zorin tint colors removed
 * Preserves all other theme styling
 */

${modifiedCss}
`;
    }

    // ===== PANEL & POPUP COLOR OVERRIDES =====

    /**
     * Generate panel color override CSS
     * @param {string} panelColor - Panel color (rgba format)
     * @param {number} opacity - Panel opacity (0-1)
     * @param {boolean} applyRadius - Apply border radius
     * @param {number} borderRadius - Border radius value
     * @returns {string} Panel override CSS
     */
    getPanelColorOverride(panelColor, opacity, applyRadius, borderRadius) {
        // Cache key for this combination
        const cacheKey = `panel_${panelColor}_${opacity}_${applyRadius}_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const radiusRule = applyRadius ? `border-radius: ${borderRadius}px;` : "";

        const css = `
/* Panel Background Override */
.panel {
    background-color: ${panelColor} !important;
    ${radiusRule}
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    /**
     * Generate popup menu color override CSS
     * @param {string} popupColor - Popup color (rgba format)
     * @param {number} opacity - Popup opacity (0-1)
     * @param {boolean} applyRadius - Apply border radius
     * @param {number} borderRadius - Border radius value
     * @returns {string} Popup override CSS
     */
    getPopupColorOverride(popupColor, opacity, applyRadius, borderRadius) {
        const cacheKey = `popup_${popupColor}_${opacity}_${applyRadius}_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const radiusRule = applyRadius ? `border-radius: ${borderRadius}px;` : "";

        const css = `
/* Popup Menu Background Override */
.popup-menu,
.popup-menu-content {
    background-color: ${popupColor} !important;
    ${radiusRule}
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== BLUR EFFECTS =====

    /**
     * Generate backdrop-filter CSS only (for flexible usage)
     * @param {number} radius - Blur radius
     * @param {number} saturate - Saturation multiplier
     * @param {number} contrast - Contrast multiplier
     * @param {number} brightness - Brightness multiplier
     * @returns {string} Backdrop-filter CSS or empty string if disabled
     */
    getBackdropFilter(radius, saturate, contrast, brightness) {
        if (radius <= 0) return "";

        const cacheKey = `backdrop_${radius}_${saturate}_${contrast}_${brightness}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const css = `backdrop-filter: blur(${radius}px) saturate(${saturate}) contrast(${contrast}) brightness(${brightness}) !important;`;
        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== GNOME SHELL SPECIFIC =====

    /**
     * Generate Shell panel styling
     * @param {string} panelColor - Panel background color
     * @param {boolean} applyRadius - Apply border radius
     * @param {number} borderRadius - Border radius value
     * @returns {string} Shell panel CSS
     */
    getShellPanelStyle(panelColor, applyRadius, borderRadius) {
        const cacheKey = `shell_panel_${panelColor}_${applyRadius}_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const radiusRule = applyRadius ? `border-radius: ${borderRadius}px;` : "";

        const css = `
/* GNOME Shell Panel */
#panel {
    background-color: ${panelColor} !important;
    ${radiusRule}
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    /**
     * Generate Shell popup menu styling
     * @param {string} popupColor - Popup background color
     * @param {boolean} applyRadius - Apply border radius
     * @param {number} borderRadius - Border radius value
     * @returns {string} Shell popup CSS
     */
    getShellPopupStyle(popupColor, applyRadius, borderRadius) {
        const cacheKey = `shell_popup_${popupColor}_${applyRadius}_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const radiusRule = applyRadius ? `border-radius: ${borderRadius}px;` : "";

        const css = `
/* GNOME Shell Popup Menus */
.popup-menu-boxpointer,
.popup-menu-content,
.modal-dialog {
    background-color: ${popupColor} !important;
    ${radiusRule}
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== ZORIN ACCENT COLOR INTEGRATION =====

    /**
     * Generate Zorin accent color CSS
     * @param {string} accentRgb - Accent color in rgb() format
     * @param {boolean} isDark - Is dark theme
     * @returns {string} Accent color CSS
     */
    getZorinAccentStyle(accentRgb, isDark) {
        // Null guard: Skip Zorin accent CSS if no valid color detected
        // This handles neutral/grey themes (e.g., ZorinGrey-Dark) gracefully
        if (!accentRgb || accentRgb === null || accentRgb === "null") {
            return "/* Zorin accent color not detected - using theme defaults (neutral/grey theme) */\n";
        }

        const cacheKey = `zorin_accent_${accentRgb}_${isDark}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        // Enhanced pastel for dark themes
        const displayColor = isDark ? this._enhancePastelForDark(accentRgb) : accentRgb;
        // Generate foreground color with proper contrast
        const fgColor = isDark ? Constants.AUTO_TEXT_COLORS.lightHex : Constants.AUTO_TEXT_COLORS.darkHex; // Contrasting text color

        const css = `
/* Zorin Theme Accent Color Variables */
@define-color accent_color ${displayColor};
@define-color accent_bg_color ${displayColor};
@define-color accent_fg_color ${fgColor};

/* ===== MINIMAL MODE - ONLY CORE WIDGETS ===== */
/* Temporarily disabled hover/selection overrides for debugging */

/* Switch widget - track (container) */
switch:checked {
    background-color: ${displayColor};
    background-image: image(${displayColor});
    border-color: ${displayColor};
}

/* Switch slider - contrasting color for visibility */
switch:checked > slider {
    background-color: ${fgColor};
}

/* Checkboxes and Radio buttons - use accent color */
check:checked,
check:indeterminate,
radio:checked,
radio:indeterminate {
    background-color: ${displayColor};
    background-image: image(${displayColor});
    border-color: ${displayColor};
    color: ${fgColor};
    box-shadow: none;
}

/* Progress bars */
progressbar > trough > progress {
    background-color: ${displayColor};
}

/* ===== DISABLED FOR DEBUGGING (v2.5 testing) ===== */
/* Uncomment below to re-enable hover/selection styling */

/*
/ * Selected items in lists - subtle transparency (v2.5 Full Auto Mode) * /
row.activatable:selected,
.view:selected,
.view:selected:focus,
.view text:selected,
.view text:selected:focus,
textview text:selected,
textview text:selected:focus,
iconview:selected,
iconview:selected:focus,
flowbox > flowboxchild:selected,
.content-view .tile:selected {
    background-color: alpha(${displayColor}, 0.20);
    color: inherit;
}

/ * Links hover state * /
link:hover {
    color: ${displayColor};
}

/ * Spinbutton/Entry progress indicator * /
spinbutton > progress > trough > progress,
entry > progress > trough > progress {
    background-color: ${displayColor};
}
*/
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== GTK4 SPECIFIC OVERRIDES =====

    /**
     * Get GTK4-specific CSS overrides
     * @param {number} borderRadius - Border radius value
     * @returns {string} GTK4 override CSS
     */
    getGtk4Overrides(borderRadius) {
        const cacheKey = `gtk4_overrides_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const css = `
/* GTK4 Specific Overrides */
.card {
    background: @cssgnomme_popup_bg;
    border-radius: ${borderRadius}px;
}

window {
    border-radius: ${borderRadius}px;
}

window > box > box > box {
    border-radius: ${borderRadius}px;
}

/* GTK4 window decorations */
windowhandle,
windowcontrols {
    border-radius: ${borderRadius}px ${borderRadius}px 0 0;
}

/* Fix ComboRow dropdown popup border (Adwaita preferences) */
.menu.background {
    border: none;
    box-shadow: none;
    background: transparent;
}

.menu > arrow {
    border: none;
    background: transparent;
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== GTK OVERLAY CSS COMPONENTS =====

    /**
     * Generate GTK CSS variables section
     * @param {Object} colorSettings - Color settings from _extractColorSettings
     * @returns {string} CSS variables
     */
    getGtkCssVariables(colorSettings) {
        return `
/*** CSSGnomme CSS Variables ***/

@define-color cssgnomme_panel_bg ${colorSettings.panel.color};
@define-color cssgnomme_panel_fg ${colorSettings.panel.fgCss};
@define-color cssgnomme_panel_hover ${colorSettings.panel.hoverCss};
@define-color cssgnomme_panel_solid_bg ${colorSettings.panel.solidCss};

@define-color cssgnomme_popup_bg ${colorSettings.popup.color};
@define-color cssgnomme_popup_fg ${colorSettings.popup.fgCss};
@define-color cssgnomme_popup_hover ${colorSettings.popup.hoverCss};
`;
    }

    /**
     * Generate HeaderBar styling
     * @param {number} borderRadius - Border radius value
     * @returns {string} HeaderBar CSS
     */
    getGtkHeaderBarStyle(borderRadius) {
        return `
/* HeaderBar Styling - only top corners rounded (window continues below) */
headerbar {
    background: @cssgnomme_panel_solid_bg;
    color: @cssgnomme_panel_fg;
    border-radius: ${borderRadius}px ${borderRadius}px 0 0;
}

headerbar button {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.panelButton});
}

/* ===== DISABLED FOR DEBUGGING (v2.5 testing) ===== */
/* Temporarily removed to test theme default behavior */

/*
headerbar button:hover {
    background: @cssgnomme_panel_hover;
    border-radius: inherit;
}

/ * Window control buttons ONLY - remove theme shadow/outline effects * /
headerbar.titlebar button.titlebutton,
headerbar windowcontrols button,
headerbar .windowcontrols button {
    box-shadow: none !important;
    outline: none !important;
}

headerbar.titlebar button.titlebutton:hover,
headerbar windowcontrols button:hover,
headerbar .windowcontrols button:hover {
    box-shadow: none !important;
    outline: none !important;
    border-radius: inherit;
}

/ * Remove pseudo-elements that might create extra visual elements * /
headerbar.titlebar button.titlebutton::before,
headerbar.titlebar button.titlebutton::after,
headerbar windowcontrols button::before,
headerbar windowcontrols button::after {
    display: none !important;
    content: none !important;
}
*/
`;
    }

    /**
     * Generate Window styling (CSD decorations)
     * @param {number} borderRadius - Border radius value
     * @returns {string} Window CSS
     *
     * NOTE: Window border-radius limitations (2025-10-31)
     * =====================================================
     * We do NOT apply border-radius to window.background due to GTK3/GTK4 rendering
     * limitations that cause content overflow ("sharp corners bleeding outside rounded borders").
     *
     * ATTEMPTED WORKAROUNDS (all failed):
     * 1. overflow: hidden on window.background - Ignored by GTK4
     * 2. clip-path: inset(0 round Xpx) - Not respected by libadwaita
     * 3. Zorin pattern (.unified selectors) - No improvement
     * 4. scrolledwindow bottom-only radius - Insufficient clipping
     * 5. toolbarview child selectors - Only helps AdwToolbarView apps (Nautilus)
     * 6. box.vertical/horizontal clipping - Ignored
     *
     * ROOT CAUSE:
     * - GTK3: CSS border-radius works, but overflow:hidden unreliable for some widgets
     * - GTK4 + libadwaita: Hardcoded rendering in C code ignores CSS overrides
     * - Software Updates (gnome-software): Uses old layout without AdwToolbarView
     * - Modern apps (Nautilus): Use AdwToolbarView which auto-clips (works OK)
     *
     * VERIFICATION:
     * - Original Zorin themes: Same problem exists (not CSSGnomme bug)
     * - Fluent themes: Same problem exists
     * - GNOME Terminal (GTK3): Works perfectly with border-radius
     *
     * DECISION: Accept limitation, focus on what works:
     * - HeaderBar rounded top corners (works 100%)
     * - Panel, popups, Quick Settings (full control)
     * - GTK3 applications (full control)
     * - Modern libadwaita apps with AdwToolbarView (acceptable)
     *
     * See: docs/GTK4_LIBADWAITA_LIMITATIONS.md (if created)
     */
    getGtkWindowStyle(borderRadius) {
        return `
/* Window Styling - Client-Side Decorations */
window.csd,
window.csd decoration,
window.solid-csd decoration {
    border-radius: ${borderRadius}px;
}

/* Dialogs and floating windows */
dialog.background,
.dialog-vbox {
    border-radius: ${borderRadius}px;
}
`;
    }

    /**
     * Generate Popover/Menu styling
     * @param {number} borderRadius - Border radius value
     * @returns {string} Popover CSS
     */
    getGtkPopoverStyle(borderRadius) {
        return `
/* Popover/Menu Styling - Fixed transparent backgrounds (v2.4.1) */
popover.background,
popover.menu,
.popup-menu,
.menu.background {
    background-color: @cssgnomme_popup_bg;
    color: @cssgnomme_popup_fg;
    border-radius: ${borderRadius}px;
}

/* Note: Removed 'popover.background > contents { background: transparent; }'
 * which was causing invisible menus in Nautilus, Extension Manager, etc.
 * GTK4 handles content background automatically.
 */
`;
    }

    /**
     * Generate Tooltip styling
     * @param {number} borderRadius - Border radius value
     * @returns {string} Tooltip CSS
     */
    getGtkTooltipStyle(borderRadius) {
        return `
/* Tooltip Styling */
tooltip.background {
    background: @cssgnomme_popup_bg;
    color: @cssgnomme_popup_fg;
    border-radius: calc(${borderRadius}px * 0.5);
}
`;
    }

    /**
     * Generate Fluent theme titlebar fix (non-Zorin themes with Zorin integration)
     * @param {boolean} isZorinTheme - Is current theme a Zorin theme
     * @param {boolean} enableZorinIntegration - Is Zorin integration enabled
     * @returns {string} Fluent titlebar CSS or empty string
     */
    getFluentTitlebarFix(isZorinTheme, enableZorinIntegration) {
        if (isZorinTheme || !enableZorinIntegration) {
            return "";
        }

        return `
/* Fluent Theme: Window titlebar styling to match Zorin behavior when integration enabled */
/* IMPORTANT: This must be at the end to override Fluent's own headerbar rules */

/* Main titlebar/headerbar selectors - cover all window types */
.titlebar:not(headerbar),
headerbar,
window.csd > .titlebar:not(headerbar),
window.csd > headerbar,
window.solid-csd > .titlebar,
.solid-csd headerbar,
.default-decoration.titlebar:not(headerbar),
headerbar.default-decoration {
    background-color: @cssgnomme_panel_bg !important;
    background-image: none !important;
    color: @cssgnomme_panel_fg !important;
}

/* Backdrop state */
.titlebar:backdrop:not(headerbar),
headerbar:backdrop,
window.csd > .titlebar:backdrop:not(headerbar),
window.csd > headerbar:backdrop {
    background-color: @cssgnomme_panel_bg !important;
    background-image: none !important;
    color: @cssgnomme_panel_fg !important;
    opacity: 0.9;
}

/* Title and subtitle text */
.titlebar:not(headerbar) .title,
headerbar .title {
    color: @cssgnomme_panel_fg;
}

.titlebar:not(headerbar) .subtitle,
headerbar .subtitle {
    color: @cssgnomme_panel_fg;
    opacity: 0.7;
}
`;
    }

    /**
     * Generate complete GTK overlay CSS (imports + overrides)
     * @param {string} extensionName - Extension name
     * @param {string} timestamp - Generation timestamp
     * @param {string} version - GTK version (gtk-3.0, gtk-4.0)
     * @param {string} importSource - Import source path
     * @param {boolean} baseThemeExists - Does base-theme.css exist
     * @param {boolean} isDark - Is dark variant
     * @param {Object} colorSettings - Color settings from _extractColorSettings
     * @param {number} borderRadius - Border radius value
     * @param {Array|null} accentColor - Accent color [r, g, b] or null
     * @param {boolean} themeIsLight - Is theme light mode
     * @param {boolean} isZorinTheme - Is Zorin theme
     * @param {boolean} enableZorinIntegration - Enable Zorin integration
     * @returns {string} Complete GTK CSS
     */
    getGtkOverlayCss(
        extensionName,
        timestamp,
        version,
        importSource,
        baseThemeExists,
        isDark,
        colorSettings,
        borderRadius,
        accentColor,
        themeIsLight,
        isZorinTheme,
        enableZorinIntegration
    ) {
        const importNote = baseThemeExists
            ? "Modified base theme (tint removed)"
            : "Original theme (base-theme not found, using fallback)";

        return `/*
 * ${extensionName} Overlay Theme - ${isDark ? "Dark" : "Light"} Variant
 * Generated: ${timestamp}
 * Source: ${importNote}
 * GTK Version: ${version}
 */

/* Import ${baseThemeExists ? "modified base theme (tint removed)" : "original theme (fallback)"} */
@import url("${importSource}");

${this.getGtkCssVariables(colorSettings)}

/*** ${extensionName} Overrides ***/

${this.getGtkHeaderBarStyle(borderRadius)}

${this.getGtkWindowStyle(borderRadius)}

${this.getGtkPopoverStyle(borderRadius)}

${this.getGtkTooltipStyle(borderRadius)}

${version === "gtk-4.0" ? this.getGtk4Overrides(borderRadius) : ""}

${
    // Only generate Zorin accent CSS if:
    // 1. Accent color exists (not null/undefined)
    // 2. Array has 3 valid RGB values
    // This respects neutral/grey theme choice (no forced colors)
    accentColor && Array.isArray(accentColor) && accentColor.length === 3
        ? this.getZorinAccentStyle(`rgb(${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]})`, !themeIsLight)
        : "/* No valid accent color detected - using theme defaults */\n"
}

${this.getFluentTitlebarFix(isZorinTheme, enableZorinIntegration)}

/*** End ${extensionName} ***/
`;
    }

    // ===== SHADOW EFFECTS =====

    /**
     * Generate shadow effect CSS
     * @param {string} shadowColor - Shadow color
     * @param {number} strength - Shadow strength (0-1)
     * @returns {string} Shadow CSS
     */
    getShadowStyle(shadowColor, strength) {
        const cacheKey = `shadow_${shadowColor}_${strength}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const spread = Math.round(strength * Constants.SHADOW_SPREAD_MULTIPLIER);

        const css = `
/* Shadow Effects */
.panel,
.popup-menu {
    box-shadow: 0 2px ${spread}px ${shadowColor};
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    // ===== UTILITY METHODS =====

    /**
     * Clear template cache (for cleanup)
     */
    clearCache() {
        this._templateCache.clear();
    }

    /**
     * Get cache size for monitoring
     * @returns {number} Number of cached templates
     */
    getCacheSize() {
        return this._templateCache.size;
    }

    /**
     * Enhance pastel colors for dark themes
     * @private
     * @param {string} rgbColor - Color in rgb() format
     * @returns {string} Enhanced color
     */
    _enhancePastelForDark(rgbColor) {
        // Parse rgb(r, g, b) format
        const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return rgbColor;

        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);

        // Use ThemeUtils if available, otherwise simple boost
        try {
            const enhanced = ThemeUtils.enhancePastelColor([r, g, b], 0.3, 0.25);
            return `rgb(${enhanced[0]}, ${enhanced[1]}, ${enhanced[2]})`;
        } catch (e) {
            // Fallback: Simple saturation boost
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;

            if (delta === 0) return rgbColor;

            const boost = 1.3;
            const newR = Math.min(255, Math.round(r + (r - min) * boost * 0.3));
            const newG = Math.min(255, Math.round(g + (g - min) * boost * 0.3));
            const newB = Math.min(255, Math.round(b + (b - min) * boost * 0.3));

            return `rgb(${newR}, ${newG}, ${newB})`;
        }
    }

    /**
     * Generate complete CSS from multiple sections
     * @param {Object} sections - Object with section names as keys and CSS strings as values
     * @returns {string} Complete CSS document
     */
    assembleCss(sections) {
        const parts = [];

        // Add header
        parts.push(`/* CSSGnomme Dynamic Theme Overlay */\n/* Generated: ${new Date().toISOString()} */\n`);

        // Add each section with separator
        for (const [name, css] of Object.entries(sections)) {
            if (css && css.trim()) {
                parts.push(`\n/* ========== ${name.toUpperCase()} ========== */\n`);
                parts.push(css);
            }
        }

        return parts.join("\n");
    }

    // ===== GNOME SHELL COMPONENT CSS GENERATORS =====

    /**
     * Generate panel-specific CSS for GNOME Shell
     * This is a large CSS template that defines panel, panel buttons, and Zorin Taskbar styling
     *
     * @param {Object} vars - Complete variables object from _extractShellCssVars
     * @param {number} vars.borderRadius - Border radius in pixels
     * @param {number} vars.borderWidth - Border width in pixels
     * @param {boolean} vars.applyPanelRadius - Apply border radius to panel
     * @param {boolean} vars.enableZorinIntegration - Enable Zorin-specific styling
     * @param {boolean} vars.isZorinTheme - Is current theme a Zorin theme
     * @param {boolean} vars.isLightTheme - Is light theme mode
     * @param {string} vars.accentRgb - Accent color RGB (e.g., "59, 66, 82")
     * @param {string} vars.borderColor - Border color (rgba format)
     * @param {string} vars.hoverRgb - Hover state RGB
     * @param {number} vars.hoverOpacity - Hover state opacity
     * @param {number} vars.activeOpacity - Active state opacity
     * @param {string} vars.panelBackgroundCss - Panel background CSS rule
     * @param {string} vars.backdropFilter - Backdrop filter CSS rule
     * @param {string} vars.shadowColor - Shadow color (rgba format)
     * @param {number} vars.shadowPanelBlur - Panel shadow blur radius
     * @param {number} vars.shadowButtonBlur - Button shadow blur radius
     * @param {number} vars.shadowInsetBlur - Inset shadow blur radius
     * @param {number} vars.blurRadius - Blur radius in pixels
     * @param {number} vars.blurSaturate - Blur saturation multiplier
     * @param {number} vars.blurContrast - Blur contrast multiplier
     * @param {number} vars.blurBrightness - Blur brightness multiplier
     * @param {string} vars.blurBackgroundOverlay - Blur background overlay color
     * @returns {string} Panel CSS content
     */
    getPanelCss(vars) {
        const {
            borderRadius,
            borderWidth,
            applyPanelRadius,
            enableZorinIntegration,
            isZorinTheme,
            isLightTheme,
            accentRgb,
            borderColor,
            hoverRgb,
            hoverOpacity,
            activeOpacity,
            panelBackgroundCss,
            backdropFilter,
            shadowColor,
            shadowPanelBlur,
            shadowButtonBlur,
            shadowInsetBlur,
            blurRadius,
            blurSaturate,
            blurContrast,
            blurBrightness,
            blurBackgroundOverlay
        } = vars;

        return `
/* Panel - Using !important to override Zorin Taskbar inline styles */
#panel {
    ${panelBackgroundCss}
    ${
        applyPanelRadius
            ? `border-radius: ${borderRadius}px !important;`
            : "/* border-radius disabled by user preference */"
    }
    border: ${borderWidth}px solid ${borderColor} !important;
    backdrop-filter: blur(${blurRadius}px) saturate(${blurSaturate}) contrast(${blurContrast}) brightness(${blurBrightness}) !important;
    -webkit-backdrop-filter: blur(${blurRadius}px) saturate(${blurSaturate}) contrast(${blurContrast}) brightness(${blurBrightness}) !important;
    box-shadow: ${
        borderWidth > 0
            ? `0 3px ${shadowPanelBlur}px ${shadowColor}, inset 0 0 ${shadowInsetBlur}px ${blurBackgroundOverlay}`
            : `0 3px ${shadowPanelBlur}px ${shadowColor}`
    } !important;
}

#panel .panel-button {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.panelButton}) !important;
    transition: all 150ms ease-in-out !important;
}

/* Panel button hover - subtle background color change */
#panel .panel-button:hover {
    background-color: rgba(${hoverRgb}, ${hoverOpacity}) !important;
}

${
    isZorinTheme
        ? `
/* Zorin Theme: Clock display fix - hide parent hover, apply to inner .clock element */
#panel .panel-button.clock-display {
    border-radius: 0 !important;
}

#panel .panel-button.clock-display:hover {
    background-color: transparent !important;
}

#panel .panel-button.clock-display .clock {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.panelButton}) !important;
    transition: all 150ms ease-in-out !important;
}

#panel .panel-button.clock-display:hover .clock {
    background-color: rgba(${hoverRgb}, ${hoverOpacity}) !important;
}

/* Clock active/focus/checked state - stronger highlight on inner .clock */
#panel .panel-button.clock-display:active .clock,
#panel .panel-button.clock-display:focus .clock,
#panel .panel-button.clock-display:checked .clock {
    background-color: rgba(${hoverRgb}, ${activeOpacity}) !important;
}

/* Ensure parent stays transparent even when active/focus/checked */
#panel .panel-button.clock-display:active,
#panel .panel-button.clock-display:focus,
#panel .panel-button.clock-display:checked {
    background-color: transparent !important;
}
`
        : ""
}

/* Panel button active/checked - stronger background */
#panel .panel-button:active,
#panel .panel-button:focus,
#panel .panel-button:checked {
    background-color: rgba(${hoverRgb}, ${activeOpacity}) !important;
}

${
    isZorinTheme && isLightTheme
        ? `
/* Zorin Light Theme: Accent color for active/checked icons */
#panel .panel-button:active StIcon,
#panel .panel-button:focus StIcon,
#panel .panel-button:checked StIcon {
    color: rgb(${accentRgb}) !important;
}
`
        : ""
}

${
    enableZorinIntegration
        ? `
/* Zorin Taskbar specific enhancements - only if integration enabled */
.zorintaskbarMainPanel {
    ${panelBackgroundCss}
    ${backdropFilter}
    ${
        applyPanelRadius
            ? `border-radius: ${borderRadius}px !important;`
            : "/* border-radius disabled by user preference */"
    }
    border: ${borderWidth}px solid ${borderColor} !important;
    box-shadow: 0 2px ${shadowButtonBlur}px ${shadowColor} !important;
}

.zorintaskbarMainPanel .panel-button {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.panelButton}) !important;
    transition: all 150ms ease-in-out !important;
}

/* Zorin Taskbar button hover - subtle background color change */
.zorintaskbarMainPanel .panel-button:hover {
    background-color: rgba(${hoverRgb}, ${hoverOpacity}) !important;
}

${
    isZorinTheme
        ? `
/* Zorin Theme: Clock display fix - hide parent hover, apply to inner .clock element */
.zorintaskbarMainPanel .panel-button.clock-display {
    border-radius: 0 !important;
}

.zorintaskbarMainPanel .panel-button.clock-display:hover {
    background-color: transparent !important;
}

.zorintaskbarMainPanel .panel-button.clock-display .clock {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.panelButton}) !important;
    transition: all 150ms ease-in-out !important;
}

.zorintaskbarMainPanel .panel-button.clock-display:hover .clock {
    background-color: rgba(${hoverRgb}, ${hoverOpacity}) !important;
}

/* Clock active/focus/checked state - stronger highlight on inner .clock */
.zorintaskbarMainPanel .panel-button.clock-display:active .clock,
.zorintaskbarMainPanel .panel-button.clock-display:focus .clock,
.zorintaskbarMainPanel .panel-button.clock-display:checked .clock {
    background-color: rgba(${hoverRgb}, ${activeOpacity}) !important;
}

/* Ensure parent stays transparent even when active/focus/checked */
.zorintaskbarMainPanel .panel-button.clock-display:active,
.zorintaskbarMainPanel .panel-button.clock-display:focus,
.zorintaskbarMainPanel .panel-button.clock-display:checked {
    background-color: transparent !important;
}
`
        : ""
}

/* Zorin Taskbar button active/checked - stronger background */
.zorintaskbarMainPanel .panel-button:active,
.zorintaskbarMainPanel .panel-button:focus,
.zorintaskbarMainPanel .panel-button:checked {
    background-color: rgba(${hoverRgb}, ${activeOpacity}) !important;
}

${
    isZorinTheme && isLightTheme
        ? `
/* Zorin Light Theme: Accent color for active/checked icons in taskbar */
.zorintaskbarMainPanel .panel-button:active StIcon,
.zorintaskbarMainPanel .panel-button:focus StIcon,
.zorintaskbarMainPanel .panel-button:checked StIcon {
    color: rgb(${accentRgb}) !important;
}
`
        : ""
}
`
        : ""
}`;
    }

    /**
     * Generate popup/menu-specific CSS for GNOME Shell
     * This is a large CSS template that defines popup menus, quick settings, dash, notifications, OSD, app switcher
     *
     * @param {Object} vars - Complete variables object from _extractShellCssVars
     * @param {number} vars.borderRadius - Border radius in pixels
     * @param {number} vars.borderWidth - Border width in pixels
     * @param {boolean} vars.enableZorinIntegration - Enable Zorin-specific styling
     * @param {boolean} vars.isZorinTheme - Is current theme a Zorin theme
     * @param {string} vars.accentRgb - Accent color RGB
     * @param {string} vars.borderColor - Border color (rgba format)
     * @param {string} vars.blurBackgroundOverlay - Blur background overlay color
     * @param {string} vars.backdropFilter - Backdrop filter CSS rule
     * @param {string} vars.popupBackgroundCss - Popup background CSS rule
     * @param {string} vars.previewBackgroundCss - Preview background CSS rule
     * @param {string} vars.shadowColor - Shadow color (rgba format)
     * @param {number} vars.shadowPopupBlur - Popup shadow blur radius
     * @param {number} vars.shadowInsetBlur - Inset shadow blur radius
     * @param {boolean} vars.applyPanelRadius - Apply border radius (used for dash)
     * @returns {string} Popup/menu CSS content
     */
    getPopupCss(vars) {
        const {
            borderRadius,
            borderWidth,
            enableZorinIntegration,
            isZorinTheme,
            accentRgb,
            borderColor,
            blurBackgroundOverlay,
            backdropFilter,
            popupBackgroundCss,
            previewBackgroundCss,
            shadowColor,
            shadowPopupBlur,
            shadowInsetBlur
        } = vars;

        // Generate theme-aware shadow with conditional inset glow (glossy look only with border)
        const simpleShadow =
            vars.borderWidth > 0
                ? `box-shadow: 0 2px ${shadowPopupBlur}px ${shadowColor}, inset 0 0 ${shadowInsetBlur}px ${blurBackgroundOverlay} !important;`
                : `box-shadow: 0 2px ${shadowPopupBlur}px ${shadowColor} !important;`;

        return `
/* Popup Menus - outer wrapper (transparent, no visual styling) */
.popup-menu,
.app-menu,
.panel-menu {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
}

/* Quick Settings - wrapper only (no border here) - FORCE OVERRIDE */
.quick-settings.quick-settings,
.quick-settings-menu.quick-settings-menu,
#panel .quick-settings,
#panel .quick-settings-menu {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    border-radius: 0 !important;
}

/* Reset any pseudo-elements that might create ghost borders */
.popup-menu::before,
.popup-menu::after,
.quick-settings::before,
.quick-settings::after,
.quick-settings-menu::before,
.quick-settings-menu::after {
    display: none !important;
}

/* Popup menu content - actual visible container with border */
.popup-menu-content,
.popup-menu-box {
    ${popupBackgroundCss}
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid ${borderColor} !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: ${Constants.UI_PADDING.previewHeader.vertical}px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
}

/* Quick Settings grid - visible container with border */
.quick-settings-grid {
    ${popupBackgroundCss}
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid ${borderColor} !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: ${Constants.UI_PADDING.previewHeader.horizontal}px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
}

.popup-menu-item {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.popupItem}) !important;
    padding: 8px 12px !important;
    box-sizing: border-box !important;
}

${
    !isZorinTheme && enableZorinIntegration
        ? `
/* Fluent Theme Enhancement: Zorin-style menu improvements when integration enabled */

/* Visible separator line for better menu organization */
.popup-separator-menu-item {
    margin: 3px 0 !important;
    padding: 0 !important;
}

.popup-separator-menu-item .popup-separator-menu-item-separator {
    height: 1px !important;
    background-color: rgba(${accentRgb}, 0.2) !important;
    margin: 0 4px !important;
}

/* Enhanced menu item spacing and padding (Zorin-style) */
.popup-menu-item {
    padding: 7.5px 12px !important;
    border-radius: 8px !important;
    transition-duration: 150ms !important;
}

.popup-menu-item:ltr {
    padding-left: 8px !important;
}

.popup-menu-item:rtl {
    padding-right: 8px !important;
}

/* Sub-menu separators with proper margins */
.popup-sub-menu .popup-separator-menu-item {
    background-color: transparent !important;
}

.popup-sub-menu .popup-separator-menu-item:ltr {
    margin-right: 2.5em !important;
}

.popup-sub-menu .popup-separator-menu-item:rtl {
    margin-left: 2.5em !important;
}

.popup-sub-menu .popup-separator-menu-item .popup-separator-menu-item-separator {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.subtle}) !important;
}
`
        : ""
}

/* Overview - clean with accent border */
.overview-controls {
    border-radius: ${borderRadius}px;
}

/* Dash - strong accent border */
#dash {
    ${popupBackgroundCss}
    ${
        vars.applyPanelRadius
            ? `border-radius: ${borderRadius}px !important;`
            : "/* border-radius disabled by user preference */"
    }
    border: ${borderWidth}px solid rgba(${accentRgb}, 1.0) !important;
    box-shadow: 0 4px ${shadowPopupBlur}px ${shadowColor} !important;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    outline: none !important;
}

/* Reset dash pseudo-elements */
#dash::before,
#dash::after {
    display: none !important;
}

/* Dash content with padding */
#dash > * {
    padding: 8px;
}

/* Message Tray / Notifications - use popup background and transparency */
.message-list-section,
.message {
    ${popupBackgroundCss}
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid ${borderColor} !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: 12px !important;
    box-sizing: border-box !important;
}

/* OSD (Volume, Brightness popups) - strong accent */
.osd-window {
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid rgba(${accentRgb}, 1.0) !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: 16px !important;
    box-sizing: border-box !important;
    outline: none !important;
}

/* Running App Indicators - use accent color */
.app-well-app-running-dot {
    background-color: rgba(255, 255, 255, 0.5) !important;
}

StWidget.focused .app-well-app-running-dot${
            enableZorinIntegration
                ? `,
#zorintaskbarScrollview StWidget.focused .app-well-app-running-dot`
                : ""
        } {
    background-color: ${borderColor} !important;
}

${
    enableZorinIntegration
        ? `
/* Zorin Taskbar - Enhanced hover for app buttons (favorites and active apps) */
#zorintaskbarScrollview .app-well-app:hover .overview-icon {
    background-color: rgba(${accentRgb}, 0.3) !important;
    transition: background-color 150ms ease-out !important;
}

#zorintaskbarScrollview .app-well-app:active .overview-icon {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.active}) !important;
}

/* Zorin Menu - Add right padding to categories to prevent collision with slider */
.shortcuts-box {
    padding-right: 8px !important;
}

.popup-menu-item.category-menu-item {
    padding-right: 8px !important;
}

.vertical-separator {
    margin-right: 8px !important;
}
`
        : ""
}

/* GTK4/Adwaita - Fix ComboRow popup styling (preferences dropdown) */
.menu.background {
    border: none !important;
    box-shadow: none !important;
    background: none !important;
}

/* App Switcher (Alt+Tab) - Complete Styling */
.switcher-popup {
    padding: 0 !important;
    spacing: 24px !important;
}

.switcher-list {
    ${popupBackgroundCss}
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid ${borderColor} !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: 10px !important;
    box-sizing: border-box !important;
}

.switcher-list .switcher-list-item-container {
    spacing: 12px !important;
}

/* App Switcher item boxes - base state */
.switcher-list .item-box {
    background-color: transparent !important;
    border-radius: calc(${borderRadius}px * 0.75) !important;
    padding: 6px !important;
    spacing: 6px !important;
    border: 2px solid transparent !important;
    transition-duration: 150ms !important;
    text-align: center !important;
}

/* App Switcher item hover */
.switcher-list .item-box:hover {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.subtle}) !important;
}

/* App Switcher item selected/focused - use accent color */
.switcher-list .item-box:selected,
.switcher-list .item-box:focus {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.medium}) !important;
    border-color: ${borderColor} !important;
}

.switcher-list .item-box:selected:hover,
.switcher-list .item-box:focus:hover {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.strong}) !important;
}

/* App Switcher arrow indicator */
.switcher-arrow {
    border-color: rgba(255, 255, 255, 0.5) !important;
    color: rgba(255, 255, 255, 0.5) !important;
}

.switcher-arrow:highlighted {
    border-color: ${borderColor} !important;
    color: ${borderColor} !important;
}

/* Zorin Taskbar - Window Preview Tooltip (hover over taskbar app groups) */
.dash-label {
    ${previewBackgroundCss}
    border-radius: ${borderRadius}px !important;
    border: ${borderWidth}px solid ${borderColor} !important;
    ${simpleShadow}
    ${backdropFilter}
    padding: ${Constants.UI_PADDING.dashLabel.vertical}px ${Constants.UI_PADDING.dashLabel.horizontal}px !important;
    box-sizing: border-box !important;
}

/* Zorin Taskbar - Window Preview Container */
.preview-container {
    ${previewBackgroundCss}
    border-radius: ${borderRadius}px !important;
    ${simpleShadow}
    ${backdropFilter}
    /* No explicit border - Zorin Taskbar clips it due to fixed layout */
}

/* Zorin Taskbar - Window Preview Container states - override inline styles */
/* Zorin Taskbar uses inline setStyle() on focus/hover which overrides CSS */
/* We need to force our background with multiple state selectors */
.preview-container,
.preview-container:hover,
.preview-container:focus,
.preview-container:active,
.preview-container:selected {
    background-color: ${previewBackgroundCss.match(/rgba\([^)]+\)/)?.[0] || "rgba(36, 31, 49, 0.1)"} !important;
}

/* Zorin Taskbar - Window Preview Header Box */
.preview-header-box {
    border-radius: calc(${borderRadius}px * ${Constants.BORDER_RADIUS_SCALING.popupItem}) !important;
    padding: ${Constants.UI_PADDING.previewHeader.vertical}px ${
            Constants.UI_PADDING.previewHeader.horizontal
        }px !important;
    box-sizing: border-box !important;
}`;
    }

    /**
     * Generate Zorin-specific CSS enhancements
     * Currently provides minimal Zorin Menu category styling
     * Most Zorin-specific logic is integrated into panel and popup CSS
     *
     * @param {Object} vars - Variables object (not currently used, reserved for future)
     * @returns {string} Zorin-specific CSS content
     */
    getZorinCss(vars) {
        return `
/* Zorin Menu category arrow spacing to avoid scrollbar collision */
.apps-menu .popup-menu-item {
    padding-right: 20px !important;
}

/* Alternative: target the arrow icon specifically */
.apps-menu .popup-menu-item .popup-menu-icon:last-child {
    margin-right: 10px !important;
}
`;
    }

    /**
     * Generate Zorin OS gradient fixes for third-party Shell themes (Sprint 5.1)
     * Disables unwanted Zorin accent color gradient on Quick Settings, Calendar, Screenshot UI, etc.
     * @param {string} accentRgb - Accent color as "r, g, b" string
     * @returns {string} Gradient fix CSS
     */
    getShellZorinGradientFixes(accentRgb) {
        const cacheKey = `shell_zorin_gradient_${accentRgb}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const css = `
/* CSSGnomme: Zorin OS Gradient Fixes for Third-Party Shell Themes (Sprint 5.1) */
/* Fixes unwanted accent color gradient on Quick Settings, Calendar, Screenshot UI, etc. */
/* Community-verified solution: https://forum.zorin.com/t/dark-themes-with-blue-text-bug/39017/26 */

/* Quick Settings - Main Fix */
.quick-toggle:checked {
    transition-duration: 150ms;
    color: white;
    background-gradient-direction: none;
    box-shadow: none;
}

.quick-toggle:checked:hover,
.quick-toggle:checked:focus {
    box-shadow: 0 2px 4px rgba(${accentRgb}, 0.1);
}

.quick-toggle-menu .header .icon.active {
    color: white;
    background-gradient-direction: none;
}

/* Calendar - Today's date gradient fix */
.calendar .calendar-today {
    font-weight: 800;
    color: white !important;
    background-gradient-direction: none;
    box-shadow: 0 2px 4px rgba(${accentRgb}, 0.2);
}

.calendar .calendar-today:active,
.calendar .calendar-today:selected {
    background-gradient-direction: none;
    color: inherit;
    box-shadow: 0 2px 4px rgba(${accentRgb}, 0.2);
}

/* Screenshot UI - Button gradient fix */
.screenshot-ui-show-pointer-button:outlined,
.screenshot-ui-type-button:outlined,
.screenshot-ui-show-pointer-button:checked,
.screenshot-ui-type-button:checked {
    transition-duration: 150ms;
    color: white;
    background-gradient-direction: none;
    box-shadow: none;
}

/* General checked/active states */
#LookingGlassDialog > #Toolbar .lg-toolbar-button:checked,
.app-folder-dialog .folder-name-container .edit-folder-button:checked,
.button:checked,
.icon-button:checked {
    transition-duration: 150ms;
    color: white;
    background-gradient-direction: none;
    box-shadow: none;
}

#LookingGlassDialog > #Toolbar .flat.lg-toolbar-button:checked,
.app-folder-dialog .folder-name-container .flat.edit-folder-button:checked,
.flat.button:checked,
.flat.icon-button:checked {
    transition-duration: 150ms;
    color: white;
    background-gradient-direction: none;
    box-shadow: none;
}

.modal-dialog .modal-dialog-linked-button:checked,
.hotplug-notification-item:checked,
.notification-banner .notification-button:checked {
    transition-duration: 150ms;
    color: white;
    background-gradient-direction: none;
    box-shadow: none;
}

/* Page navigation hints */
.page-navigation-hint.next:ltr,
.page-navigation-hint.previous:rtl {
    background-gradient-start: rgba(18, 51, 84, 0.05);
    background-gradient-end: transparent;
    background-gradient-direction: none;
    border-radius: 24px 0px 0px 24px;
}

.page-navigation-hint.previous:ltr,
.page-navigation-hint.next:rtl {
    background-gradient-start: transparent;
    background-gradient-end: rgba(18, 51, 84, 0.05);
    background-gradient-direction: none;
    border-radius: 0px 24px 24px 0px;
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    /**
     * Generate Shell CSS for Quick Settings border-radius synchronization (v2.5)
     * Synchronizes Quick Settings toggle buttons and menus with user border-radius setting
     * Uses Constants.BORDER_RADIUS_SCALING for consistent proportions
     *
     * @param {number} borderRadius - User border-radius setting (0-25px)
     * @returns {string} Quick Settings border-radius CSS
     */
    getShellQuickSettingsCss(borderRadius) {
        if (!borderRadius || borderRadius <= 0) {
            return "";
        }

        const cacheKey = `shell_quick_settings_${borderRadius}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const toggleRadius = Math.round(borderRadius * Constants.BORDER_RADIUS_SCALING.quickToggle);
        const arrowRadius = Math.round(borderRadius * Constants.BORDER_RADIUS_SCALING.quickToggleArrow);

        const css = `
/* CSSGnomme: Quick Settings Border-Radius Sync (v2.5.1) */
/* Synchronizes Quick Settings elements with user border-radius setting */
/* HIGH SPECIFICITY: Overrides theme nested selectors (Fluent: 30-40pts, Zorin: 20pts) */
/* Investigation: docs/QUICK_SETTINGS_CSS_INVESTIGATION.md */

/* Compact height adjustment - Zorin 17 style (user-requested v2.5.1) */
.quick-settings-grid .quick-toggle,
.quick-menu-toggle,
.quick-menu-toggle .quick-toggle,
.quick-menu-toggle .quick-toggle-arrow {
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 !important;
}

/* Inner StBoxLayout carries the padding for proper arrow alignment */
.quick-settings-grid .quick-toggle > StBoxLayout,
.quick-menu-toggle .quick-toggle > StBoxLayout {
    padding: 0 12px !important;
}

/* Individual toggle buttons (WiFi, Bluetooth, Dark Mode, etc.) - Grid items */
/* Specificity: 20 points (.quick-settings-grid .quick-toggle) */
.quick-settings-grid .quick-toggle {
    border-radius: ${toggleRadius}px !important;
}

.quick-settings-grid .quick-toggle:hover,
.quick-settings-grid .quick-toggle:focus,
.quick-settings-grid .quick-toggle:checked {
    border-radius: ${toggleRadius}px !important;
}

/* Menu toggle buttons - PARTIAL RADIUS for seamless connection with arrow */
/* LTR: Toggle rounded on left, flat on right (connects to arrow on right side) */
/* Specificity: 30 points (.quick-menu-toggle .quick-toggle:ltr) */
.quick-menu-toggle .quick-toggle:ltr {
    border-radius: ${toggleRadius}px 0 0 ${toggleRadius}px !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 !important;
}

/* RTL: Toggle rounded on right, flat on left (connects to arrow on left side) */
.quick-menu-toggle .quick-toggle:rtl {
    border-radius: 0 ${toggleRadius}px ${toggleRadius}px 0 !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 !important;
}

/* CRITICAL: Override :last-child variants (standalone toggles - full radius) */
/* When toggle has no arrow (standalone), use full border-radius on all corners */
/* Specificity: 40 points - beats all theme selectors */
.quick-menu-toggle .quick-toggle:ltr:last-child {
    border-radius: ${toggleRadius}px !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 !important;
}

.quick-menu-toggle .quick-toggle:rtl:last-child {
    border-radius: ${toggleRadius}px !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 !important;
}

/* Arrow expand buttons - PARTIAL RADIUS for seamless connection with toggle */
/* LTR: Arrow rounded on right, flat on left (connects to toggle on left side) */
.quick-menu-toggle .quick-toggle-arrow:ltr {
    border-radius: 0 ${arrowRadius}px ${arrowRadius}px 0 !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 0.71575em !important; /* Keep horizontal padding for icon, remove vertical */
}

/* RTL: Arrow rounded on left, flat on right (connects to toggle on right side) */
.quick-menu-toggle .quick-toggle-arrow:rtl {
    border-radius: ${arrowRadius}px 0 0 ${arrowRadius}px !important;
    min-height: ${Constants.QUICK_SETTINGS_HEIGHT.baseHeight}px !important;
    padding: 0 0.71575em !important; /* Keep horizontal padding for icon, remove vertical */
}

/* Expanded menu panels (Volume, Brightness sliders) */
.quick-toggle-menu {
    border-radius: ${borderRadius}px !important;
}

/* Header row toggle buttons (top row circular buttons) */
.quick-settings-grid .header .quick-toggle {
    border-radius: ${toggleRadius}px !important;
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    /**
     * Generate Shell Fluent titlebar fix CSS (uses accentRgb, not CSS variables)
     * @param {string} accentRgb - Accent color as "r, g, b" string
     * @param {boolean} isLightTheme - Whether theme is light mode
     * @returns {string} Shell titlebar fix CSS
     */
    getShellFluentTitlebarFix(accentRgb, isLightTheme) {
        const cacheKey = `shell_fluent_titlebar_${accentRgb}_${isLightTheme}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        const css = `
/* CSSGnomme: Fluent Theme titlebar fix for Shell - added at end for highest specificity */

.titlebar:not(headerbar),
headerbar,
window.csd > .titlebar:not(headerbar),
window.csd > headerbar,
window.solid-csd > .titlebar,
.solid-csd headerbar,
.default-decoration.titlebar:not(headerbar),
headerbar.default-decoration {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.medium}) !important;
    background-image: none !important;
    color: ${isLightTheme ? "#2e3436" : "#eeeeec"} !important;
}

.titlebar:backdrop:not(headerbar),
headerbar:backdrop,
window.csd > .titlebar:backdrop:not(headerbar),
window.csd > headerbar:backdrop {
    background-color: rgba(${accentRgb}, ${Constants.ACCENT_HOVER_OPACITY.subtle}) !important;
    opacity: 0.9;
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
    }

    /**
     * Assemble complete Shell CSS from component parts
     * Combines panel, popup, and Zorin CSS with header and base theme import
     *
     * @param {Object} vars - Variables object containing metadata
     * @param {string} vars.timestamp - Generation timestamp
     * @param {string} panelCss - Panel CSS from getPanelCss()
     * @param {string} popupCss - Popup CSS from getPopupCss()
     * @param {string} zorinCss - Zorin CSS from getZorinCss()
     * @param {string} extensionName - Extension name for header comments
     * @returns {string} Complete Shell CSS document
     */
    assembleShellCss(vars, panelCss, popupCss, zorinCss, extensionName = "CSSGnomme") {
        const { timestamp } = vars;

        return `/*
 * ${extensionName} Shell Overlay
 * Generated: ${timestamp}
 * Source: Modified base theme (base-theme.css)
 */

/* Import modified base theme (tint removed, fixes applied) */
@import url("base-theme.css");

/*** ${extensionName} Dynamic Overrides ***/

${panelCss}

${popupCss}

${zorinCss}

/*** End ${extensionName} ***/
`;
    }

    // ===== PAD OSD CSS GENERATOR =====

    /**
     * Generate pad-osd.css with import + overrides
     * Pad OSD (On-Screen Display) is the tablet/stylus settings overlay
     *
     * @param {string} extensionName - Extension name for header comments
     * @param {string} sourcePath - Source theme path
     * @param {number} borderRadius - Border radius in pixels (0 = flat corners)
     * @returns {string} Complete pad-osd.css content
     */
    getPadOsdCss(extensionName, sourcePath, borderRadius) {
        const importPath = `${sourcePath}/gnome-shell/pad-osd.css`;
        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        return `/*
 * ${extensionName} Pad OSD Overlay
 * Generated: ${timestamp}
 * Source: ${importPath}
 */

/* Import original Pad OSD theme */
@import url("${importPath}");

/*** ${extensionName} Pad OSD Overrides ***/

.pad-osd-window {
    border-radius: ${borderRadius}px;
}

.pad-osd-button {
    border-radius: calc(${borderRadius}px * 0.6);
}

/*** End ${extensionName} ***/
`;
    }
}
