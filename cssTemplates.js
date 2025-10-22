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
        const cacheKey = `zorin_accent_${accentRgb}_${isDark}`;

        if (this._templateCache.has(cacheKey)) {
            return this._templateCache.get(cacheKey);
        }

        // Enhanced pastel for dark themes
        const displayColor = isDark ? this._enhancePastelForDark(accentRgb) : accentRgb;

        const css = `
/* Zorin Theme Accent Color */
@define-color accent_color ${displayColor};
@define-color accent_bg_color ${displayColor};

/* Switch widget */
switch:checked {
    background-color: ${displayColor};
    border-color: ${displayColor};
}

/* Selected items */
.selected,
*:selected {
    background-color: ${displayColor};
}
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
popover.menu {
    border-radius: ${borderRadius}px;
}

/* GTK4 Window decorations */
headerbar {
    border-radius: ${borderRadius}px ${borderRadius}px 0 0;
}
`;

        this._templateCache.set(cacheKey, css);
        return css;
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
