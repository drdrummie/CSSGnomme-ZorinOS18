/**
 * themeUtils.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * Theme detection and wallpaper utilities
 */

import { Constants } from "./constants.js";

/* themeUtils.js
 *
 * Color mathematics and CSS utilities for CSSGnomme
 * Adapted from Open Bar extension with CSSGnomme integration
 */

export class ThemeUtils {
    // ===== COLOR MATHEMATICS =====

    /**
     * HSP brightness calculation for perceived brightness
     * @param {number|Array} r - Red value (0-255) or [r,g,b] array
     * @param {number} g - Green value (0-255)
     * @param {number} b - Blue value (0-255)
     * @returns {number} HSP brightness value
     */
    static getHSP(r, g, b) {
        if (Array.isArray(r)) {
            [r, g, b] = r.map(c => parseInt(c));
        }
        // HSP equation for perceived brightness
        return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    }

    /**
     * Determine if background is dark based on HSP threshold
     */
    static getBgDark(r, g, b) {
        let hsp = this.getHSP(r, g, b);
        return hsp <= Constants.HSP_DARK_THRESHOLD;
    }

    /**
     * Mix two colors by a factor
     * @param {number} startColor - Start color component (0-255)
     * @param {number} endColor - End color component (0-255)
     * @param {number} factor - Mix factor (-1 to 1)
     * @returns {number} Mixed color component
     */
    static colorMix(startColor, endColor, factor) {
        let color = startColor + factor * (endColor - startColor);
        return Math.max(0, Math.min(255, parseInt(color)));
    }

    /**
     * Create lighter/darker shade of color
     * @param {Array} color - [r, g, b] array
     * @param {number} factor - Shade factor (positive = lighter, negative = darker)
     * @returns {Array} Shaded color [r, g, b]
     */
    static colorShade(color, factor) {
        const [r, g, b] = color.map(c => parseInt(c));

        if (factor > 0) {
            // Lighten: mix with white
            return [this.colorMix(r, 255, factor), this.colorMix(g, 255, factor), this.colorMix(b, 255, factor)];
        } else {
            // Darken: reduce intensity
            const darkFactor = 1 + factor; // Convert to 0-1 range
            return [Math.round(r * darkFactor), Math.round(g * darkFactor), Math.round(b * darkFactor)];
        }
    }

    /**
     * Calculate contrast ratio between two colors
     */
    static contrastRatio(color1, color2) {
        const relativeLuminance = color => {
            const [r, g, b] = color.map(val => {
                val /= 255;
                return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };

        const luminance1 = relativeLuminance(color1);
        const luminance2 = relativeLuminance(color2);
        const lighter = Math.max(luminance1, luminance2);
        const darker = Math.min(luminance1, luminance2);

        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Generate auto foreground color based on background
     */
    static getAutoFgColor(bgColor, alpha = 1.0) {
        const [r, g, b] = bgColor.map(c => parseInt(c));
        const isDark = this.getBgDark(r, g, b);

        if (isDark) {
            return [250, 250, 250, alpha]; // Light text on dark bg
        } else {
            return [5, 5, 5, alpha]; // Dark text on light bg
        }
    }

    /**
     * Generate auto highlight/hover color
     */
    static getAutoHighlightColor(bgColor, intensity = null) {
        // Use constant default if not provided
        if (intensity === null) {
            intensity = Constants.AUTO_HIGHLIGHT_INTENSITY;
        }

        const [r, g, b] = bgColor.map(c => parseInt(c));
        const isDark = this.getBgDark(r, g, b);

        if (isDark) {
            // Lighten dark backgrounds
            return this.colorShade([r, g, b], intensity);
        } else {
            // Darken light backgrounds
            return this.colorShade([r, g, b], -intensity);
        }
    }

    // ===== COLOR FORMAT CONVERSIONS =====

    /**
     * Convert RGB array to hex string
     */
    static rgbToHex(r, g, b) {
        if (Array.isArray(r)) {
            [r, g, b] = r.map(c => parseInt(c));
        }
        return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
    }

    /**
     * Convert hex to RGB array
     */
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
    }

    /**
     * Parse CSS rgba string to RGB array
     * Converts 'rgba(46, 52, 64, 0.8)' to [46, 52, 64, 0.8]
     */
    static parseRgbaString(rgbaStr) {
        const match = rgbaStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;

        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] ? parseFloat(match[4]) : 1.0];
    }

    /**
     * Create CSS rgba string with clamped RGB values (0-255)
     */
    static rgbaToCss(r, g, b, a = 1.0) {
        if (Array.isArray(r)) {
            if (r.length === 4) {
                [r, g, b, a] = r;
            } else {
                [r, g, b] = r;
            }
        }
        // Clamp RGB values to valid 0-255 range
        r = Math.max(0, Math.min(255, Math.round(r)));
        g = Math.max(0, Math.min(255, Math.round(g)));
        b = Math.max(0, Math.min(255, Math.round(b)));
        // Clamp alpha to 0-1 range
        a = Math.max(0, Math.min(1, a));

        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    /**
     * Unified color parser - handles hex, rgb(), rgba(), and array formats
     * @param {string|Array} input - Color in any supported format
     * @returns {Object|null} {r, g, b, a, format} or null if invalid
     */
    static parseColor(input) {
        // Handle null/undefined
        if (!input) return null;

        // Array input [r, g, b] or [r, g, b, a]
        if (Array.isArray(input)) {
            if (input.length < 3) return null;
            return {
                r: parseInt(input[0]),
                g: parseInt(input[1]),
                b: parseInt(input[2]),
                a: input[3] !== undefined ? parseFloat(input[3]) : 1.0,
                format: "array"
            };
        }

        // String input
        if (typeof input !== "string") return null;

        // Hex format #RRGGBB or #RGB
        if (input.startsWith("#")) {
            const rgb = this.hexToRgb(input);
            return rgb
                ? {
                      r: rgb[0],
                      g: rgb[1],
                      b: rgb[2],
                      a: 1.0,
                      format: "hex"
                  }
                : null;
        }

        // RGBA/RGB format
        const rgbaMatch = input.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]),
                g: parseInt(rgbaMatch[2]),
                b: parseInt(rgbaMatch[3]),
                a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1.0,
                format: "css"
            };
        }

        return null;
    }

    /**
     * Convert color to requested output format
     * @param {string|Array} input - Color in any format
     * @param {string} outputFormat - 'hex', 'css', 'array', 'object'
     * @param {number} alphaOverride - Optional alpha override (0.0-1.0)
     * @returns {string|Array|Object|null} Color in requested format
     */
    static convertColor(input, outputFormat = "css", alphaOverride = null) {
        const parsed = this.parseColor(input);
        if (!parsed) return null;

        const finalAlpha = alphaOverride !== null ? alphaOverride : parsed.a;

        switch (outputFormat) {
            case "hex":
                // Hex doesn't support alpha
                return this.rgbToHex(parsed.r, parsed.g, parsed.b);

            case "css":
                return this.rgbaToCss(parsed.r, parsed.g, parsed.b, finalAlpha);

            case "array":
                return [parsed.r, parsed.g, parsed.b, finalAlpha];

            case "object":
                return { r: parsed.r, g: parsed.g, b: parsed.b, a: finalAlpha };

            default:
                return null;
        }
    }

    /**
     * Validate if color string/array is valid
     * @param {string|Array} color - Color to validate
     * @returns {boolean} True if valid color format
     */
    static isValidColor(color) {
        return this.parseColor(color) !== null;
    }

    // ===== CSS GENERATION HELPERS =====

    /**
     * Generate border-radius CSS with individual corners
     */
    static generateRadiusStyle(radius, corners = {}) {
        const { topLeft = true, topRight = true, bottomLeft = true, bottomRight = true } = corners;

        const tl = topLeft ? radius : 0;
        const tr = topRight ? radius : 0;
        const bl = bottomLeft ? radius : 0;
        const br = bottomRight ? radius : 0;

        return `border-radius: ${tl}px ${tr}px ${br}px ${bl}px;`;
    }

    /**
     * Generate box-shadow with glow effect
     */
    static generateGlowShadow(color, intensity = 0.5, spread = 2) {
        const [r, g, b] = Array.isArray(color) ? color : this.hexToRgb(color);
        return `box-shadow: 0 0 ${spread * 2}px ${spread}px rgba(${r}, ${g}, ${b}, ${intensity});`;
    }

    /**
     * Generate layered shadow for depth
     */
    static generateLayeredShadow(color, layers = 3) {
        const [r, g, b] = Array.isArray(color) ? color : [0, 0, 0];
        const shadows = [];

        for (let i = 1; i <= layers; i++) {
            const alpha = 0.3 / i;
            const offset = i * 2;
            const blur = i * 4;
            shadows.push(`0 ${offset}px ${blur}px rgba(${r}, ${g}, ${b}, ${alpha})`);
        }

        return `box-shadow: ${shadows.join(", ")};`;
    }

    // ===== VALIDATION UTILITIES =====

    /**
     * Validate color contrast meets WCAG guidelines
     */
    static validateContrast(fgColor, bgColor, level = "AA") {
        const ratio = this.contrastRatio(fgColor, bgColor);
        const minRatio = Constants.MIN_CONTRAST_RATIO[level] || Constants.MIN_CONTRAST_RATIO.AA;
        return ratio >= minRatio;
    }

    /**
     * Ensure minimum contrast by adjusting foreground
     */
    static ensureContrast(fgColor, bgColor, minRatio = null) {
        // Use constant default if not provided
        if (minRatio === null) {
            minRatio = Constants.MIN_CONTRAST_RATIO.AA;
        }

        let adjustedFg = [...fgColor];
        let ratio = this.contrastRatio(adjustedFg, bgColor);

        if (ratio >= minRatio) return adjustedFg;

        const isDarkBg = this.getBgDark(...bgColor);
        const direction = isDarkBg ? 1 : -1; // Lighten on dark, darken on light

        for (
            let adjustment = Constants.CONTRAST_ADJUSTMENT_STEP;
            adjustment <= 1;
            adjustment += Constants.CONTRAST_ADJUSTMENT_STEP
        ) {
            adjustedFg = this.colorShade(fgColor, direction * adjustment);
            ratio = this.contrastRatio(adjustedFg, bgColor);

            if (ratio >= minRatio) return adjustedFg;
        }

        // Fallback to high contrast
        return isDarkBg ? [255, 255, 255] : [0, 0, 0];
    }

    /**
     * Generate complementary color
     */
    static getComplementaryColor(color) {
        const [r, g, b] = Array.isArray(color) ? color : this.hexToRgb(color);
        return [255 - r, 255 - g, 255 - b];
    }

    /**
     * Convert RGB to HSL
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {Array} [h, s, l] where h is 0-360, s and l are 0-100
     */
    static rgbToHsl(r, g, b) {
        if (Array.isArray(r)) {
            [r, g, b] = r;
        }

        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h,
            s,
            l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r:
                    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                    break;
                case g:
                    h = ((b - r) / d + 2) / 6;
                    break;
                case b:
                    h = ((r - g) / d + 4) / 6;
                    break;
            }
        }

        return [h * 360, s * 100, l * 100];
    }

    /**
     * Convert HSL to RGB
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {Array} [r, g, b] where each is 0-255
     */
    static hslToRgb(h, s, l) {
        if (Array.isArray(h)) {
            [h, s, l] = h;
        }

        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * Enhance pastel colors for dark themes
     * Increases saturation and reduces lightness to make colors more vibrant
     * @param {Array} rgb - [r, g, b] array
     * @param {number} saturationBoost - How much to increase saturation (0-1, default 0.3)
     * @param {number} lightnessReduction - How much to reduce lightness (0-1, default 0.25)
     * @returns {Array} Enhanced [r, g, b] array
     */
    static enhancePastelColor(rgb, saturationBoost = 0.3, lightnessReduction = 0.25) {
        const [r, g, b] = rgb;
        const [h, s, l] = this.rgbToHsl(r, g, b);

        // Only enhance if lightness is high (pastel) and saturation is moderate
        if (l > 65 && s > 20) {
            // Boost saturation (but cap at 100)
            const newS = Math.min(100, s + saturationBoost * 100);

            // Reduce lightness to make color more vivid
            const newL = Math.max(35, l - lightnessReduction * 100);

            return this.hslToRgb(h, newS, newL);
        }

        // Return original if not pastel
        return [r, g, b];
    }

    /**
     * Smart color palette generator
     */
    static generateColorPalette(baseColor, count = 5) {
        const [r, g, b] = Array.isArray(baseColor) ? baseColor : this.hexToRgb(baseColor);
        const palette = [];

        for (let i = 0; i < count; i++) {
            const factor = (i - Math.floor(count / 2)) * 0.2;
            palette.push(this.colorShade([r, g, b], factor));
        }

        return palette;
    }
}
