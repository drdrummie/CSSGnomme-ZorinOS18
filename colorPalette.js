/**
 * colorPalette.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * Wallpaper color extraction using K-means clustering
 */

import GLib from "gi://GLib";
import GdkPixbuf from "gi://GdkPixbuf";
import Gio from "gi://Gio";
import System from "system";

import { Constants } from "./constants.js";
import { ThemeUtils } from "./themeUtils.js";

/* colorPalette.js
 *
 * Background image color extraction for CSSGnomme
 * Adapted from Open Bar - extracts colors and applies to existing settings
 */

export class ColorPalette {
    /**
     * @param {Logger} logger - Logger instance for standardized logging
     * @param {Gio.Settings} extensionSettings - Optional extension settings for overlay source theme detection
     * @param {Gio.Settings} interfaceSettings - Optional interface settings (to avoid duplicate instances)
     */
    constructor(logger = null, extensionSettings = null, interfaceSettings = null) {
        this._logger = logger || {
            info: msg => log(`[ColorPalette:INFO] ${msg}`),
            warn: msg => log(`[ColorPalette:WARN] ${msg}`),
            error: msg => log(`[ColorPalette:ERROR] ${msg}`),
            debug: msg => log(`[ColorPalette:DEBUG] ${msg}`)
        };

        this._extensionSettings = extensionSettings;
        this._interfaceSettings = interfaceSettings;

        // Settings singleton caches (prevent duplicate instances)
        this._backgroundSettings = null;

        // Initialize cache for palette results
        this.cache = new Map();
        this.maxCacheSize = Constants.CACHE_LIMITS.colorPalette || 10;

        // Persistent cache configuration
        this._cachePath = `${GLib.get_user_cache_dir()}/cssgnomme/${Constants.CACHE_PERSISTENCE.cacheFileName}`;
        this._cacheSaveTimer = null;

        // MEMORY LEAK FIX: Track pending GC timers for cleanup
        this._pendingGcTimers = new Set();

        this._logger.debug("ColorPalette initialized with timer tracking");

        // Load persistent cache from disk (if exists)
        if (Constants.CACHE_PERSISTENCE.enabled) {
            this._loadPersistentCache();
        }
    }

    // ===== SETTINGS SINGLETON GETTERS =====

    /**
     * Get org.gnome.desktop.background Settings singleton
     * @returns {Gio.Settings} Background settings instance
     */
    _getBackgroundSettings() {
        if (!this._backgroundSettings) {
            try {
                this._backgroundSettings = new Gio.Settings({
                    schema: "org.gnome.desktop.background"
                });
            } catch (e) {
                this._logger.error(`Could not access background settings: ${e}`);
            }
        }
        return this._backgroundSettings;
    }

    // ===== COLOR SCHEME DETECTION =====

    /**
     * Get system color scheme preference
     * @returns {string} 'prefer-dark', 'prefer-light', or 'default'
     */
    getSystemColorScheme() {
        if (!this._interfaceSettings) {
            this._logger.info("Interface settings not available, using default");
            return "default";
        }

        try {
            const scheme = this._interfaceSettings.get_string("color-scheme");
            this._logger.info(`System color-scheme: ${scheme}`);
            return scheme;
        } catch (e) {
            this._logger.info(`Error reading color-scheme: ${e}`);
            return "default";
        }
    }

    /**
     * Determine if dark mode should be preferred for color extraction
     * Checks Quick Settings Dark/Light theme switch via gtk-theme suffix
     * @param {Gio.Settings} extensionSettings - Optional extension settings to check overlay source theme
     * @returns {boolean} True if should prefer dark colors, false for light
     */
    shouldPreferDarkColors(extensionSettings = null) {
        if (!this._interfaceSettings) {
            this._logger.info("Interface settings not available, defaulting to dark mode");
            return true;
        }

        try {
            // Primary: Check color-scheme (GNOME 42+ Quick Settings Dark/Light switch)
            // This reflects the CURRENT user preference, not the base theme
            const scheme = this.getSystemColorScheme();

            if (scheme === "prefer-dark") {
                this._logger.info(`Color extraction mode: dark (color-scheme: prefer-dark)`);
                return true;
            } else if (scheme === "prefer-light") {
                this._logger.info(`Color extraction mode: light (color-scheme: prefer-light)`);
                return false;
            }

            // Fallback: Check gtk-theme suffix if color-scheme is 'default'
            // If overlay is active, check the source theme from extension settings
            let gtkTheme = this._interfaceSettings.get_string("gtk-theme");

            if (gtkTheme === "CSSGnomme" && extensionSettings) {
                try {
                    gtkTheme = extensionSettings.get_string("overlay-source-theme");
                    this._logger.info(`Checking overlay source theme for fallback: ${gtkTheme}`);
                } catch (e) {
                    this._logger.info(`Could not read overlay source theme: ${e.message}`);
                }
            }

            if (gtkTheme.endsWith("-Dark")) {
                this._logger.info(`Color extraction mode: dark (gtk-theme: ${gtkTheme})`);
                return true;
            } else if (gtkTheme.endsWith("-Light")) {
                this._logger.info(`Color extraction mode: light (gtk-theme: ${gtkTheme})`);
                return false;
            }

            // Final fallback: Treat 'default' color-scheme as light mode (safer for readability)
            this._logger.info(`Color extraction mode: light (color-scheme: ${scheme}, no theme suffix)`);
            return false;
        } catch (e) {
            this._logger.info(`Error detecting color mode: ${e}, defaulting to dark`);
            return true;
        }
    }

    // ===== IMAGE COLOR EXTRACTION =====

    /**
     * Extract dominant colors from image file
     * MEMORY LEAK FIX: Uses new_from_stream_at_scale for efficient memory management
     * @param {string} pictureUri - URI to image file
     * @param {number} maxColors - Maximum colors to extract
     * @param {boolean} preferLight - If true, prefer light colors; if false, prefer dark colors. If null, uses system color-scheme.
     * @param {boolean} forceExtraction - If true, bypass cache and force re-extraction
     * @returns {Array} Array of RGB color arrays
     */
    extractColorsFromImage(pictureUri, maxColors = 8, preferLight = null, forceExtraction = false) {
        let pixbuf = null;
        let pictureFile = null;
        let inputStream = null;

        try {
            // MEMORY TRACKING: Log memory before wallpaper extraction
            const memBefore = this._getMemoryUsageMB();
            this._logger.info(`📊 Memory BEFORE wallpaper extraction: ${memBefore}MB`);

            // Auto-detect color scheme if not explicitly set
            if (preferLight === null) {
                preferLight = !this.shouldPreferDarkColors(this._extensionSettings);
            }

            // Create cache key with theme preference
            const cacheKey = `${pictureUri}:${preferLight ? "light" : "dark"}`;

            // Check cache first (unless force extraction requested)
            if (!forceExtraction && this.cache.has(cacheKey)) {
                this._logger.info(`📦 Cache HIT - reusing palette (cache size: ${this.cache.size})`);
                return this.cache.get(cacheKey);
            }

            // Log cache bypass reason
            if (forceExtraction && this.cache.has(cacheKey)) {
                this._logger.info(`🔄 Force extraction - bypassing cache (cache size: ${this.cache.size})`);
            }

            pictureFile = Gio.File.new_for_uri(pictureUri);

            if (!pictureFile.query_exists(null)) {
                this._logger.info(`Image file does not exist: ${pictureUri}`);
                return this.getDefaultPalette();
            }

            // MEMORY LEAK FIX: Use new_from_stream_at_scale instead of new_from_file
            // This loads and scales the image in ONE operation, using 5-10x less memory
            inputStream = pictureFile.read(null);
            const MAX_DIMENSION = Constants.COLOR_ANALYSIS_MAX_DIMENSION;

            pixbuf = GdkPixbuf.Pixbuf.new_from_stream_at_scale(
                inputStream, // Input stream
                MAX_DIMENSION, // Max width (-1 for preserve aspect)
                MAX_DIMENSION, // Max height (-1 for preserve aspect)
                true, // Preserve aspect ratio
                null // Cancellable (null = no cancellation)
            );

            if (!pixbuf) {
                this._logger.info(`Failed to load scaled image: ${pictureUri}`);
                return this.getDefaultPalette();
            }

            const pixbufSize = (pixbuf.get_width() * pixbuf.get_height() * pixbuf.get_n_channels()) / (1024 * 1024);
            this._logger.info(
                `🖼️  Loaded scaled pixbuf: ${pixbuf.get_width()}x${pixbuf.get_height()} = ${pixbufSize.toFixed(
                    1
                )}MB uncompressed`
            );

            // MEMORY LEAK FIX: Close stream immediately after loading pixbuf
            // Pixbuf is already loaded into memory, stream is no longer needed
            if (inputStream) {
                try {
                    inputStream.close(null);
                    this._logger.debug(`Closed input stream after pixbuf loading`);
                } catch (e) {
                    this._logger.debug(`Error closing input stream: ${e.message}`);
                }
                inputStream = null; // Mark as closed for finally block
            }

            // analyzePixbuf will dispose the pixbuf internally
            const palette = this.analyzePixbuf(pixbuf, maxColors, preferLight);
            pixbuf = null; // Mark as disposed by analyzePixbuf

            // Cache the result with theme-specific key
            this.cache.set(cacheKey, palette);
            if (this.cache.size > this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
                this._logger.debug(`♻️  Evicted oldest cache entry (size: ${this.cache.size}/${this.maxCacheSize})`);
            }

            // Schedule persistent cache save (debounced to prevent excessive disk I/O)
            this._schedulePersistentCacheSave();

            // MEMORY LEAK FIX: Force GC after pixbuf disposal to clean native memory
            // GdkPixbuf allocates uncompressed RGB data (even scaled 800x600 = ~2MB)
            // JavaScript GC doesn't clean native memory immediately without explicit trigger
            try {
                System.gc(); // Force garbage collection of native objects

                // Wait 100ms for GC to complete, then check memory (TRACKED)
                const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this._pendingGcTimers.delete(timerId); // Cleanup timer tracking
                    const memAfter = this._getMemoryUsageMB();
                    const delta = memAfter - memBefore;
                    this._logger.info(
                        `📊 Memory AFTER GC: ${memAfter}MB (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}MB)`
                    );
                    return GLib.SOURCE_REMOVE; // One-shot timeout
                });
                this._pendingGcTimers.add(timerId); // Track timer for cleanup

                this._logger.debug(
                    `♻️  Triggered GC after wallpaper extraction (freed ~${pixbufSize.toFixed(1)}MB pixbuf memory)`
                );
            } catch (e) {
                // GC not available in this GJS version - memory will accumulate
                this._logger.error(`⚠️  GC ERROR: ${e.message} - Memory leak will occur!`);
            }

            this._logger.info(`Extracted ${palette.length} ${preferLight ? "light" : "dark"} colors from image`);
            return palette;
        } catch (e) {
            this._logger.info(`Error extracting colors: ${e.message}`);

            // Cleanup on error if pixbuf wasn't disposed yet
            if (pixbuf) {
                try {
                    // GNOME Review Guidelines: run_dispose() necessary for GdkPixbuf objects
                    // after image loading to immediately free image data from memory (can be 10s of MB)
                    // GdkPixbuf doesn't automatically free image buffer on JS nullification
                    pixbuf.run_dispose();
                    this._logger.debug(`Disposed pixbuf on error path`);
                } catch (disposeError) {
                    this._logger.debug(`Error disposing pixbuf on error: ${disposeError.message}`);
                }
            }

            return this.getDefaultPalette();
        } finally {
            // Final cleanup for input stream and file reference
            // Note: inputStream should already be closed in try block, this is safety cleanup
            if (inputStream) {
                try {
                    // GNOME Review Guidelines: run_dispose() necessary for GInputStream objects
                    // to immediately close file handles and free buffers after image loading
                    inputStream.run_dispose();
                    this._logger.debug(`Disposed input stream in finally block`);
                } catch (e) {
                    this._logger.debug(`Error disposing input stream: ${e.message}`);
                }
                inputStream = null;
            }

            if (pictureFile) {
                try {
                    // GNOME Review Guidelines: run_dispose() necessary for Gio.File objects
                    // to immediately release file system handles after wallpaper parsing
                    pictureFile.run_dispose();
                } catch (e) {
                    this._logger.debug(`Error disposing picture file: ${e.message}`);
                }
                pictureFile = null;
            }

            // Ensure pixbuf is disposed (should already be done in analyzePixbuf)
            pixbuf = null;
        }
    }

    /**
     * Analyze pixbuf to extract dominant colors
     * MEMORY LEAK FIX: Dispose pixbuf after analysis to prevent accumulation
     * @param {GdkPixbuf.Pixbuf} pixbuf - Image pixbuf to analyze
     * @param {number} maxColors - Maximum number of colors to extract
     * @param {boolean} preferLight - If true, extract light colors; if false, extract dark colors
     * @returns {Array} Array of RGB color arrays
     */
    analyzePixbuf(pixbuf, maxColors, preferLight = false) {
        // Track if we created a resized pixbuf that needs disposal
        let needsDispose = false;
        let pixbufToDispose = null;

        // Resize large images for better performance
        const MAX_DIMENSION = Constants.COLOR_ANALYSIS_MAX_DIMENSION;
        if (pixbuf.get_width() > MAX_DIMENSION || pixbuf.get_height() > MAX_DIMENSION) {
            const scale = MAX_DIMENSION / Math.max(pixbuf.get_width(), pixbuf.get_height());
            const resizedPixbuf = pixbuf.scale_simple(
                Math.round(pixbuf.get_width() * scale),
                Math.round(pixbuf.get_height() * scale),
                GdkPixbuf.InterpType.BILINEAR
            );
            this._logger.info(
                `Resized image to ${resizedPixbuf.get_width()}x${resizedPixbuf.get_height()} for analysis`
            );

            // Dispose original pixbuf immediately as we have resized copy
            try {
                // GNOME Review Guidelines: run_dispose() necessary for original GdkPixbuf
                // after creating scaled copy - prevents memory leak when processing large images
                // (original can be 50MB+, scaled is ~2MB)
                pixbuf.run_dispose();
            } catch (e) {
                this._logger.debug(`Error disposing original pixbuf: ${e.message}`);
            }

            // Use resized pixbuf for analysis
            pixbuf = resizedPixbuf;
            pixbufToDispose = resizedPixbuf;
            needsDispose = true;
        } else {
            // No resize needed, but we still need to dispose the loaded pixbuf after analysis
            pixbufToDispose = pixbuf;
            needsDispose = true;
        }

        const width = pixbuf.get_width();
        const height = pixbuf.get_height();
        const nChannels = pixbuf.get_n_channels();
        const pixels = pixbuf.get_pixels();
        const hasAlpha = pixbuf.get_has_alpha();

        // Sample pixels (don't analyze every pixel for performance)
        const sampleRate = Math.max(1, Math.floor((width * height) / Constants.COLOR_ANALYSIS_TARGET_SAMPLES));
        const colorMap = new Map();

        let skippedTransparent = 0;
        let skippedBlackWhite = 0;
        let processedPixels = 0;

        // Define brightness thresholds based on theme preference
        const thresholds = Constants.COLOR_BRIGHTNESS_THRESHOLDS[preferLight ? "light" : "dark"];
        const brightnessMin = thresholds.min;
        const brightnessMax = thresholds.max;

        for (let y = 0; y < height; y += sampleRate) {
            for (let x = 0; x < width; x += sampleRate) {
                const offset = (y * width + x) * nChannels;
                const r = pixels[offset];
                const g = pixels[offset + 1];
                const b = pixels[offset + 2];
                const a = hasAlpha ? pixels[offset + 3] : 255;

                // Skip transparent pixels (alpha < 128)
                if (a < 128) {
                    skippedTransparent++;
                    continue;
                }

                // Calculate brightness
                const brightness = ThemeUtils.getHSP(r, g, b);

                // Skip colors outside desired brightness range
                if (brightness < brightnessMin || brightness > brightnessMax) {
                    skippedBlackWhite++;
                    continue;
                }

                // Skip grayscale/desaturated pixels (near black/white)
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;

                // Skip if too desaturated (grayscale threshold)
                if (delta < Constants.COLOR_MIN_SATURATION_DELTA) {
                    skippedBlackWhite++;
                    continue;
                }

                // Quantize color to reduce similar colors
                const colorKey = this.quantizeColor(r, g, b, Constants.COLOR_QUANTIZATION_STEP);
                colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
                processedPixels++;
            }
        }

        this._logger.info(
            `Analyzed ${processedPixels} pixels (${
                preferLight ? "light" : "dark"
            } mode), skipped ${skippedTransparent} transparent, ${skippedBlackWhite} out-of-range`
        );

        // Sort by frequency and get top colors
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxColors)
            .map(([colorKey]) => this.parseColorKey(colorKey));

        // MEMORY LEAK FIX: Dispose pixbuf after analysis
        if (needsDispose && pixbufToDispose) {
            try {
                // GNOME Review Guidelines: run_dispose() necessary for GdkPixbuf objects
                // after color analysis to immediately free image data (especially for large wallpapers)
                pixbufToDispose.run_dispose();
                this._logger.debug(`Disposed pixbuf after analysis (${width}x${height})`);
            } catch (e) {
                this._logger.debug(`Error disposing pixbuf: ${e.message}`);
            }
        }

        return sortedColors.length > 0 ? sortedColors : this.getDefaultPalette();
    }

    /**
     * Quantize color to reduce similar colors
     * Clamps values to valid RGB range (0-255) to prevent overflow
     */
    quantizeColor(r, g, b, step = 16) {
        const qr = Math.min(255, Math.round(r / step) * step);
        const qg = Math.min(255, Math.round(g / step) * step);
        const qb = Math.min(255, Math.round(b / step) * step);
        return `${qr},${qg},${qb}`;
    }

    /**
     * Parse color key back to RGB
     */
    parseColorKey(colorKey) {
        return colorKey.split(",").map(n => parseInt(n));
    }

    /**
     * Get default color palette fallback
     */
    getDefaultPalette() {
        return [
            [46, 52, 64], // Nord polar night
            [59, 66, 82],
            [67, 76, 94],
            [76, 86, 106],
            [136, 192, 208], // Nord frost
            [129, 161, 193]
        ];
    }

    // ===== SMART COLOR SELECTION =====

    /**
     * Get best accent color from palette
     * Prefers vibrant, saturated colors
     */
    getBestAccentColor(palette) {
        if (!palette || palette.length === 0) {
            return [136, 192, 208]; // Default Nord frost
        }

        let bestColor = palette[0];
        let bestScore = -1;

        for (const color of palette) {
            const [r, g, b] = color;

            // Calculate saturation
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            const saturation = max === 0 ? 0 : delta / max;

            // Calculate brightness
            const brightness = ThemeUtils.getHSP(r, g, b);

            // Prefer medium brightness with high saturation
            const brightnessScore = 1 - Math.abs(brightness - 140) / 140;
            const saturationScore = saturation;

            const score = brightnessScore * 0.4 + saturationScore * 0.6;

            if (score > bestScore) {
                bestScore = score;
                bestColor = color;
            }
        }

        return bestColor;
    }

    /**
     * Get best background color from palette
     */
    getBestBackgroundColor(palette, preferDark = false) {
        if (!palette || palette.length === 0) {
            return preferDark ? [46, 52, 64] : [236, 239, 244];
        }

        const targetBrightness = preferDark ? 60 : 200;
        let bestColor = palette[0];
        let bestDiff = Infinity;

        for (const color of palette) {
            const brightness = ThemeUtils.getHSP(...color);
            const diff = Math.abs(brightness - targetBrightness);

            if (diff < bestDiff) {
                bestDiff = diff;
                bestColor = color;
            }
        }

        return bestColor;
    }

    /**
     * Generate complementary color scheme
     */
    generateColorScheme(palette, colorScheme = "prefer-light") {
        const preferDark = colorScheme === "prefer-dark";

        // Select best colors from palette
        const accentColor = this.getBestAccentColor(palette);
        const bgColor = this.getBestBackgroundColor(palette, preferDark);

        // Adjust accent if needed for better visibility
        const contrastRatio = ThemeUtils.contrastRatio(accentColor, bgColor);
        let finalAccent = accentColor;

        if (contrastRatio < 3.0) {
            // Accent doesn't stand out enough, adjust it
            const isDarkBg = ThemeUtils.getBgDark(...bgColor);
            finalAccent = ThemeUtils.colorShade(accentColor, isDarkBg ? 0.3 : -0.3);
        }

        return {
            accent: finalAccent,
            background: bgColor,
            foreground: ThemeUtils.getAutoFgColor(bgColor),
            hover: ThemeUtils.getAutoHighlightColor(bgColor)
        };
    }

    // ===== THEME INTEGRATION =====

    /**
     * Apply extracted colors to CSSGnomme settings
     * Sets color values but does NOT automatically enable overrides
     * User must manually enable override-popup-color if they want to use extracted popup color
     *
     * Applies colors to:
     * - Panel/popup backgrounds (choose-override-panel-color, choose-override-popup-color)
     * - Blur effects (blur-background, shadow-color)
     *
     * NOTE: blur-border-color is NOT set by wallpaper extraction.
     * Theme extraction (detectAndApplyAccentColor in overlayThemeManager.js) controls
     * blur-border-color to preserve theme accent. This prevents wallpaper extraction
     * from overwriting theme-based border color.
     */
    applyColorsToSettings(settings, colorScheme) {
        try {
            // Detect theme brightness for optimal blur effects
            const isDarkTheme = ThemeUtils.getBgDark(...colorScheme.background);
            const accentColor = colorScheme.accent;

            // === BATCH SETTINGS MODE - Prevent callback storm ===
            // Multiple color settings trigger separate callbacks → debounce timer extended N times
            // Solution: delay() pauses callbacks, apply() triggers ONE callback for all changes
            // Pattern from zorin-taskbar (production-tested)
            settings.delay();

            // Enable panel override only - popup override remains manual
            settings.set_boolean("override-panel-color", true);
            // NOTE: override-popup-color is NOT auto-enabled - user must enable manually

            // Get panel opacity for proper alpha
            const panelOpacity = settings.get_double("panel-opacity") || 0.6;
            const menuOpacity = settings.get_double("menu-opacity") || 0.8;

            // Apply background color to panel
            const panelColor = ThemeUtils.rgbaToCss(...colorScheme.background, panelOpacity);
            settings.set_string("choose-override-panel-color", panelColor);

            // Apply accent or lighter variant to popup
            const popupColor = ThemeUtils.rgbaToCss(...colorScheme.accent, menuOpacity);
            settings.set_string("choose-override-popup-color", popupColor);

            // === BLUR EFFECTS COLORS - DISABLED (Theme extraction controls these) ===
            // NOTE: Commented out for standard mode - theme extraction controls blur effects
            // TODO: Re-enable for "Full Auto Mode" feature (wallpaper overrides all colors)

            // Log extracted accent for debugging
            this._logger.info(`Extracted wallpaper accent: RGB(${accentColor.join(", ")})`);
            this._logger.info(`Theme detected: ${isDarkTheme ? "DARK" : "LIGHT"}`);

            // Calculate border shade for background tint consistency
            const borderAccent = isDarkTheme
                ? ThemeUtils.colorShade(accentColor, 0.15) // Lighten 15% for dark themes
                : ThemeUtils.colorShade(accentColor, -0.1); // Darken 10% for light themes

            // Calculate shadow variant
            const shadowVariant = isDarkTheme
                ? ThemeUtils.colorShade(accentColor, -0.85) // 85% darker → deep shadow
                : ThemeUtils.colorShade(accentColor, 0.85); // 85% lighter → soft shadow

            // === FULL AUTO MODE - Wallpaper extraction controls blur effects ===
            const fullAutoMode = settings.get_boolean("full-auto-mode") || false;

            if (fullAutoMode) {
                // Full Auto Mode: wallpaper controls blur-border, blur-background, shadow-color
                this._logger.info(`FULL AUTO MODE: Applying wallpaper colors to blur effects`);

                // blur-border-color: Use accent color with theme-appropriate alpha
                const borderAlpha = isDarkTheme ? 0.6 : 0.8;
                const blurBorderColor = ThemeUtils.rgbaToCss(...accentColor, borderAlpha);
                settings.set_string("blur-border-color", blurBorderColor);

                // blur-background: Use lighter/darker variant for glossy effect
                const blurBackground = ThemeUtils.rgbaToCss(...borderAccent, 0.15);
                settings.set_string("blur-background", blurBackground);

                // shadow-color: Use deep/soft shadow variant
                const shadowColor = ThemeUtils.rgbaToCss(...shadowVariant, 1.0);
                settings.set_string("shadow-color", shadowColor);

                this._logger.info(`  Blur Border: ${blurBorderColor} (wallpaper accent)`);
                this._logger.info(`  Blur Background: ${blurBackground} (accent ${isDarkTheme ? "+15%" : "-10%"})`);
                this._logger.info(`  Shadow: ${shadowColor} (accent ${isDarkTheme ? "-85%" : "+85%"})`);
            } else {
                // Standard Mode: theme extraction controls blur effects
                this._logger.info(`STANDARD MODE: Blur effects controlled by theme extraction`);
                this._logger.info(
                    `  Wallpaper border accent (calculated, not applied): RGB(${borderAccent.join(", ")})`
                );
                this._logger.info(`  Shadow variant (calculated, not applied): RGB(${shadowVariant.join(", ")})`);
            }

            // === APPLY BATCH SETTINGS - Single callback for all changes ===
            settings.apply();

            this._logger.info(`Applied color scheme from wallpaper:`);
            this._logger.info(`  Panel: ${panelColor}`);
            this._logger.info(`  Popup: ${popupColor} (override not auto-enabled)`);
        } catch (e) {
            this._logger.error(`Error applying colors: ${e.message}`);
        }
    }

    /**
     * Monitor background changes
     * @param {Object} settings - Extension settings
     * @param {Object} bgSettings - Background settings
     * @param {Function} onColorsChanged - Callback when colors change
     * @param {Object} overlayThemeManager - Theme manager for Light/Dark detection
     */
    setupBackgroundMonitoring(settings, bgSettings, onColorsChanged, overlayThemeManager = null) {
        this._logger.info(`=== SETTING UP WALLPAPER MONITORING ===`);

        // Guard against multiple setup calls
        if (this._monitorIds.length > 0) {
            this._logger.warn(
                `Wallpaper monitoring already active (${this._monitorIds.length} monitors), skipping setup`
            );
            return;
        }

        // Cleanup existing monitors (should be empty due to guard)
        if (this._monitorIds.length > 0) {
            this._logger.debug(`Cleaning up ${this._monitorIds.length} existing monitors`);
            this._monitorIds.forEach(monitor => {
                if (monitor.settings && monitor.id) {
                    monitor.settings.disconnect(monitor.id);
                }
            });
            this._monitorIds = [];
        }

        // Monitor only the currently active background URI based on color-scheme
        const colorScheme = this.getSystemColorScheme();
        const isDarkPreferred = colorScheme === "prefer-dark"; // SAME logic as handleBackgroundChange
        const activeUriKey = isDarkPreferred ? "changed::picture-uri-dark" : "changed::picture-uri";

        this._logger.info(`Initial color-scheme: ${colorScheme} (prefer-dark: ${isDarkPreferred})`);
        this._logger.info(`Monitoring wallpaper changes on: ${activeUriKey}`);

        // Check if current wallpaper exists for this mode
        const currentPictureUri = bgSettings.get_string(isDarkPreferred ? "picture-uri-dark" : "picture-uri");
        if (currentPictureUri && currentPictureUri !== "none") {
            const wallpaperName = this._getWallpaperName(currentPictureUri);
            this._logger.info(`Current wallpaper: "${wallpaperName}" (${isDarkPreferred ? "dark" : "light"} mode)`);
        } else {
            this._logger.info(`No wallpaper set for ${isDarkPreferred ? "dark" : "light"} mode`);
        }

        const backgroundMonitorId = bgSettings.connect(activeUriKey, () => {
            this.handleBackgroundChange(settings, bgSettings, onColorsChanged);
        });
        this._monitorIds.push({
            id: backgroundMonitorId,
            isDark: isDarkPreferred,
            settings: bgSettings
        });

        // Also monitor color-scheme changes to switch background monitoring
        if (overlayThemeManager && this._interfaceSettings) {
            this._logger.info(`Setting up color-scheme monitoring for automatic Dark/Light switching`);
            const schemeMonitorId = this._interfaceSettings.connect("changed::color-scheme", () => {
                // Reconnect background monitoring when color-scheme changes
                this._reconnectBackgroundMonitoring(settings, bgSettings, onColorsChanged, overlayThemeManager);
            });
            this._monitorIds.push({
                id: schemeMonitorId,
                isDark: null, // Special marker for color-scheme monitor
                settings: this._interfaceSettings
            });
        } else {
            this._logger.info(
                `Color-scheme monitoring disabled (overlayThemeManager: ${!!overlayThemeManager}, interfaceSettings: ${!!this
                    ._interfaceSettings})`
            );
        }

        this._logger.info(
            `Background monitoring enabled for: ${activeUriKey} (${isDarkPreferred ? "dark" : "light"} mode)`
        );
        this._logger.info(`=== WALLPAPER MONITORING SETUP COMPLETE ===`);
    }

    /**
     * Handle background image change
     * @param {Object} settings - Extension settings
     * @param {Object} bgSettings - Background settings
     * @param {Function} onColorsChanged - Callback when colors change
     */
    handleBackgroundChange(settings, bgSettings, onColorsChanged) {
        try {
            // Get current color scheme preference using singleton
            const colorScheme = this.getSystemColorScheme();
            const preferDark = colorScheme === "prefer-dark";

            // Get appropriate picture URI
            const pictureKey = preferDark ? "picture-uri-dark" : "picture-uri";
            const pictureUri = bgSettings.get_string(pictureKey);

            // Enhanced logging: Show which wallpaper is being processed
            this._logger.info(`=== WALLPAPER CHANGE DETECTED ===`);
            this._logger.info(`Color-scheme: ${colorScheme} (prefer-dark: ${preferDark})`);
            this._logger.info(`Using key: ${pictureKey}`);

            if (!pictureUri || pictureUri === "none") {
                this._logger.info(`No background image set for ${pictureKey}, skipping color extraction`);
                return;
            }

            // Extract and log filename from URI for easy identification
            const wallpaperName = this._getWallpaperName(pictureUri);
            this._logger.info(`Processing wallpaper: "${wallpaperName}" (${pictureUri})`);

            // Determine if we should prefer light or dark colors
            // Priority: 1) overlay source theme suffix, 2) gtk-theme suffix, 3) color-scheme, 4) default (dark)
            let preferLight = !this.shouldPreferDarkColors(this._extensionSettings);
            this._logger.info(
                `Color extraction mode: ${preferLight ? "light" : "dark"} colors (theme brightness preference)`
            );

            // Extract and apply colors with theme-aware brightness preference
            const palette = this.extractColorsFromImage(pictureUri, 8, preferLight);
            this._logger.info(
                `Auto-extracted ${palette.length} ${preferLight ? "light" : "dark"} colors from "${wallpaperName}"`
            );

            const colors = this.generateColorScheme(palette, colorScheme);
            this.applyColorsToSettings(settings, colors);

            // Log final accent color for verification
            if (colors && colors.accent) {
                this._logger.info(`Applied accent color: RGB(${colors.accent.join(", ")}) from "${wallpaperName}"`);
            }

            if (onColorsChanged) {
                onColorsChanged(colors);
            }

            this._logger.info(`=== WALLPAPER PROCESSING COMPLETE ===`);
        } catch (e) {
            this._logger.error(`Error handling background change: ${e.message}`);
        }
    }

    /**
     * Extract wallpaper filename from URI for logging
     * @private
     * @param {string} pictureUri - Full URI to wallpaper file
     * @returns {string} Filename or URI if extraction fails
     */
    _getWallpaperName(pictureUri) {
        try {
            if (pictureUri.startsWith("file://")) {
                const path = pictureUri.substring(7); // Remove 'file://' prefix
                return path.split("/").pop(); // Get last part (filename)
            } else {
                // Handle other URI schemes or direct paths
                return pictureUri.split("/").pop() || pictureUri;
            }
        } catch (e) {
            return pictureUri; // Fallback to full URI
        }
    }

    /**
     * Reconnect background monitoring when color-scheme preference changes
     * @private
     * @param {Object} settings - Extension settings
     * @param {Object} bgSettings - Background settings
     * @param {Function} onColorsChanged - Callback when colors change
     * @param {Object} overlayThemeManager - Theme manager for Light/Dark detection
     */
    _reconnectBackgroundMonitoring(settings, bgSettings, onColorsChanged, overlayThemeManager) {
        this._logger.info(`Reconnecting background monitoring due to color-scheme change`);

        // Enhanced logging for color-scheme changes
        const oldColorScheme = this.getSystemColorScheme();
        const oldPreferDark = this.shouldPreferDarkColors(this._extensionSettings);

        this._logger.info(`=== COLOR-SCHEME CHANGE DETECTED ===`);
        this._logger.info(`Previous color-scheme: ${oldColorScheme} (prefer-dark: ${oldPreferDark})`);

        // Disconnect only background URI monitors (keep color-scheme monitor)
        this._monitorIds = this._monitorIds.filter(monitor => {
            if (monitor.isDark !== null) {
                // Background URI monitor
                monitor.settings.disconnect(monitor.id);
                this._logger.debug(`Disconnected background monitor for: ${monitor.isDark ? "dark" : "light"} mode`);
                return false; // Remove from array
            }
            return true; // Keep color-scheme monitor
        });

        // Reconnect with new color-scheme preference
        const newColorScheme = this.getSystemColorScheme();
        const isDarkPreferred = newColorScheme === "prefer-dark"; // SAME logic as handleBackgroundChange
        const activeUriKey = isDarkPreferred ? "changed::picture-uri-dark" : "changed::picture-uri";

        this._logger.info(`New color-scheme: ${newColorScheme} (prefer-dark: ${isDarkPreferred})`);
        this._logger.info(
            `Switching monitoring from "${oldPreferDark ? "picture-uri-dark" : "picture-uri"}" to "${activeUriKey}"`
        );

        const backgroundMonitorId = bgSettings.connect(activeUriKey, () => {
            this.handleBackgroundChange(settings, bgSettings, onColorsChanged);
        });
        this._monitorIds.push({
            id: backgroundMonitorId,
            isDark: isDarkPreferred,
            settings: bgSettings
        });

        this._logger.info(
            `Background monitoring switched to: ${activeUriKey} (${isDarkPreferred ? "dark" : "light"} mode)`
        );

        // Trigger immediate wallpaper processing if wallpaper exists for new mode
        const newPictureKey = isDarkPreferred ? "picture-uri-dark" : "picture-uri";
        const newPictureUri = bgSettings.get_string(newPictureKey);
        if (newPictureUri && newPictureUri !== "none") {
            const wallpaperName = this._getWallpaperName(newPictureUri);
            this._logger.info(
                `Triggering immediate processing for "${wallpaperName}" (new ${
                    isDarkPreferred ? "dark" : "light"
                } mode)`
            );
            this.handleBackgroundChange(settings, bgSettings, onColorsChanged);
        } else {
            this._logger.info(`No wallpaper set for new ${isDarkPreferred ? "dark" : "light"} mode`);
        }

        this._logger.info(`=== COLOR-SCHEME SWITCH COMPLETE ===`);
    }

    // ===== MANUAL COLOR OPERATIONS =====

    /**
     * Extract colors from current background (for manual trigger)
     * @param {boolean} forceExtraction - If true, bypass cache and force re-extraction
     */
    extractFromCurrentBackground(forceExtraction = false) {
        try {
            const bgSettings = this._getBackgroundSettings();
            if (!bgSettings) {
                this._logger.error("Background settings not available");
                return null;
            }

            const colorScheme = this.getSystemColorScheme();
            const preferDark = colorScheme === "prefer-dark"; // Only prefer-dark is dark mode
            const pictureKey = preferDark ? "picture-uri-dark" : "picture-uri";
            const pictureUri = bgSettings.get_string(pictureKey);

            if (!pictureUri || pictureUri === "none") {
                this._logger.info("No background image to extract from");
                return null;
            }

            // Determine if we should prefer light or dark colors
            // Priority: 1) color-scheme, 2) overlay source theme suffix, 3) gtk-theme suffix
            let preferLight = !this.shouldPreferDarkColors(this._extensionSettings);

            // Extract colors with theme-aware brightness preference (propagate forceExtraction)
            const palette = this.extractColorsFromImage(pictureUri, 8, preferLight, forceExtraction);
            this._logger.info(
                `Extracted ${palette.length} ${preferLight ? "light" : "dark"} colors for ${
                    preferLight ? "Light" : "Dark"
                } theme`
            );

            return this.generateColorScheme(palette, colorScheme);
        } catch (e) {
            this._logger.error(`Error in extractFromCurrentBackground: ${e.message}`);
            return null;
        }
    }

    /**
     * Get palette preview for UI (returns array of CSS rgba strings)
     */
    getPalettePreview(palette, maxColors = 6) {
        if (!palette || palette.length === 0) {
            palette = this.getDefaultPalette();
        }

        return palette.slice(0, maxColors).map(color => ThemeUtils.rgbaToCss(...color, 1.0));
    }

    /**
     * Clear color cache
     */
    clearCache() {
        this.cache.clear();
    }

    // ===== PERSISTENT CACHE METHODS =====

    /**
     * Load persistent cache from disk on extension enable
     * Reads wallpaper colors from JSON file to avoid re-analysis
     * @private
     */
    _loadPersistentCache() {
        try {
            const cacheFile = Gio.File.new_for_path(this._cachePath);

            if (!cacheFile.query_exists(null)) {
                this._logger.info("No persistent cache found, starting fresh");
                return;
            }

            const [success, contents] = cacheFile.load_contents(null);
            if (!success) {
                this._logger.error("Failed to read persistent cache file");
                return;
            }

            const cacheData = JSON.parse(new TextDecoder().decode(contents));

            // Validate schema version
            if (cacheData.version !== Constants.CACHE_PERSISTENCE.cacheVersion) {
                this._logger.warn(`Unsupported cache version ${cacheData.version}, ignoring`);
                return;
            }

            // Validate and load entries
            let loadedCount = 0;
            const now = Date.now();
            const staleThreshold = Constants.CACHE_PERSISTENCE.staleAfterDays * 24 * 60 * 60 * 1000;

            for (const entry of cacheData.entries || []) {
                // Skip stale entries (older than 30 days)
                const age = now - new Date(entry.lastUsed).getTime();
                if (age > staleThreshold) {
                    this._logger.debug(
                        `Skipping stale cache entry: ${entry.wallpaperUri} (${Math.floor(
                            age / (24 * 60 * 60 * 1000)
                        )} days old)`
                    );
                    continue;
                }

                // Validate color arrays
                if (!this._validateCacheEntry(entry)) {
                    this._logger.warn(`Invalid cache entry: ${entry.wallpaperUri}`);
                    continue;
                }

                // Populate in-memory cache
                const lightKey = `${entry.wallpaperUri}:light`;
                const darkKey = `${entry.wallpaperUri}:dark`;

                if (entry.lightColors && entry.lightColors.length > 0) {
                    this.cache.set(lightKey, entry.lightColors);
                }
                if (entry.darkColors && entry.darkColors.length > 0) {
                    this.cache.set(darkKey, entry.darkColors);
                }

                loadedCount++;
            }

            this._logger.info(
                `✅ Loaded ${loadedCount} wallpapers from persistent cache (${
                    cacheData.entries?.length || 0
                } total entries)`
            );
        } catch (e) {
            this._logger.error(`Error loading persistent cache: ${e.message}`);
            // Continue with empty cache on error (graceful degradation)
        }
    }

    /**
     * Save in-memory cache to disk
     * Called on extension disable and periodically during runtime
     * @private
     */
    _savePersistentCache() {
        try {
            const cacheDir = Gio.File.new_for_path(`${GLib.get_user_cache_dir()}/cssgnomme`);

            // Create cache directory if it doesn't exist
            if (!cacheDir.query_exists(null)) {
                cacheDir.make_directory_with_parents(null);
                this._logger.debug("Created cache directory");
            }

            // Convert Map to JSON-friendly structure
            const entries = [];
            const processedUris = new Set();

            for (const [cacheKey, colors] of this.cache.entries()) {
                // Split on LAST ':' to handle URIs like "file:///path:dark"
                const lastColonIndex = cacheKey.lastIndexOf(":");
                const wallpaperUri = cacheKey.substring(0, lastColonIndex);
                const mode = cacheKey.substring(lastColonIndex + 1);

                if (processedUris.has(wallpaperUri)) {
                    // Already have entry for this URI, update colors
                    const entry = entries.find(e => e.wallpaperUri === wallpaperUri);
                    if (mode === "light") {
                        entry.lightColors = colors;
                    } else {
                        entry.darkColors = colors;
                    }
                } else {
                    // Create new entry
                    const entry = {
                        wallpaperUri: wallpaperUri,
                        lightColors: mode === "light" ? colors : [],
                        darkColors: mode === "dark" ? colors : [],
                        lastUsed: new Date().toISOString(),
                        analysisTimestamp: new Date().toISOString()
                    };
                    entries.push(entry);
                    processedUris.add(wallpaperUri);
                }
            }

            // Sort by lastUsed (most recent first) and limit to maxEntries
            entries.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
            const limitedEntries = entries.slice(0, Constants.CACHE_PERSISTENCE.maxEntries);

            const cacheData = {
                version: Constants.CACHE_PERSISTENCE.cacheVersion,
                created: new Date().toISOString(),
                maxEntries: Constants.CACHE_PERSISTENCE.maxEntries,
                entries: limitedEntries
            };

            const cacheFile = Gio.File.new_for_path(this._cachePath);
            const jsonString = JSON.stringify(cacheData, null, 2);

            cacheFile.replace_contents(
                new TextEncoder().encode(jsonString),
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            this._logger.info(`💾 Saved ${limitedEntries.length} wallpapers to persistent cache`);
        } catch (e) {
            this._logger.error(`Error saving persistent cache: ${e.message}`);
            // Non-fatal error, continue execution
        }
    }

    /**
     * Schedule persistent cache save (debounced)
     * Prevents excessive disk I/O during rapid color extraction
     * @private
     */
    _schedulePersistentCacheSave() {
        if (!Constants.CACHE_PERSISTENCE.enabled) {
            return;
        }

        // Cancel existing timer
        if (this._cacheSaveTimer) {
            GLib.source_remove(this._cacheSaveTimer);
            this._cacheSaveTimer = null;
        }

        // Schedule save after debounce period
        this._cacheSaveTimer = GLib.timeout_add(GLib.PRIORITY_LOW, Constants.CACHE_PERSISTENCE.saveDebounceMs, () => {
            this._savePersistentCache();
            this._cacheSaveTimer = null;
            return GLib.SOURCE_REMOVE;
        });

        this._logger.debug(`Scheduled persistent cache save in ${Constants.CACHE_PERSISTENCE.saveDebounceMs / 1000}s`);
    }

    /**
     * Validate cache entry structure and data
     * @param {Object} entry - Cache entry to validate
     * @returns {boolean} True if valid
     * @private
     */
    _validateCacheEntry(entry) {
        // Check required fields
        if (!entry.wallpaperUri || typeof entry.wallpaperUri !== "string") {
            return false;
        }

        // Validate color arrays (RGB range 0-255)
        const validateColorArray = colors => {
            if (!Array.isArray(colors)) return false;
            return colors.every(
                rgb =>
                    Array.isArray(rgb) &&
                    rgb.length === 3 &&
                    rgb.every(v => typeof v === "number" && v >= 0 && v <= 255)
            );
        };

        if (entry.lightColors && !validateColorArray(entry.lightColors)) {
            return false;
        }
        if (entry.darkColors && !validateColorArray(entry.darkColors)) {
            return false;
        }

        return true;
    }

    /**
     * Cleanup and disconnect monitors
     * MEMORY LEAK FIX: Cancel pending GC timers
     */
    destroy() {
        // Save cache to disk before cleanup (if enabled)
        if (Constants.CACHE_PERSISTENCE.enabled && this._cacheSaveTimer === null) {
            // Only save if no pending timer (avoid double-save)
            this._savePersistentCache();
        }

        // Cancel pending cache save timer
        if (this._cacheSaveTimer) {
            GLib.source_remove(this._cacheSaveTimer);
            this._cacheSaveTimer = null;
        }

        // MEMORY LEAK FIX: Cancel all pending GC timers
        if (this._pendingGcTimers.size > 0) {
            this._logger.debug(`Cancelling ${this._pendingGcTimers.size} pending GC timers`);
            this._pendingGcTimers.forEach(timerId => {
                try {
                    GLib.source_remove(timerId);
                } catch (e) {
                    // Timer already fired - ignore
                }
            });
            this._pendingGcTimers.clear();
        }

        // Disconnect background monitors using proper settings references
        if (this._monitorIds && this._monitorIds.length > 0) {
            const monitorCount = this._monitorIds.length;
            try {
                this._monitorIds.forEach(monitor => {
                    if (monitor.settings && monitor.id) {
                        monitor.settings.disconnect(monitor.id);
                    }
                });
                this._logger.debug(`Disconnected ${monitorCount} background monitors`);
            } catch (e) {
                this._logger.warn(`Error during monitor cleanup: ${e.message}`);
            }
            this._monitorIds = [];
        }

        // Cleanup background settings (we own this instance)
        if (this._backgroundSettings) {
            try {
                // GNOME Review Guidelines: run_dispose() necessary to immediately free GSettings
                // for org.gnome.desktop.background when ColorPalette is destroyed during extension disable
                this._backgroundSettings.run_dispose();
            } catch (e) {
                this._logger.warn(`Error disposing background settings: ${e.message}`);
            }
            this._backgroundSettings = null;
        }

        // IMPORTANT: Do NOT dispose _interfaceSettings!
        // It's passed from extension.js constructor and shared with extension lifecycle
        // Extension.js owns the interfaceSettings lifecycle, we just borrowed a reference
        // Disposing it here would break extension.js color-scheme monitoring
        this._interfaceSettings = null; // Just nullify our reference

        this.clearCache();

        this._logger.debug("ColorPalette destroyed with timer cleanup");
    }

    /**
     * Get current memory usage of gnome-shell process
     * Reads from /proc/self/status (RSS = Resident Set Size)
     * @returns {number} Memory usage in MB
     * @private
     */
    _getMemoryUsageMB() {
        try {
            const statusFile = Gio.File.new_for_path("/proc/self/status");
            const [success, contents] = statusFile.load_contents(null);

            if (success) {
                const statusText = new TextDecoder().decode(contents);
                const rssMatch = statusText.match(/VmRSS:\s+(\d+)\s+kB/);

                if (rssMatch) {
                    const rssKB = parseInt(rssMatch[1]);
                    return (rssKB / 1024).toFixed(1); // Convert KB to MB
                }
            }
        } catch (e) {
            this._logger.debug(`Could not read memory usage: ${e.message}`);
        }
        return "???"; // Fallback if reading fails
    }
}
