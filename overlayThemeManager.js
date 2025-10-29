/**
 * overlayThemeManager.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * Dynamic theme overlay system with CSS generation
 */

import GLib from "gi://GLib";
import Gio from "gi://Gio";
import System from "system";

import { Constants } from "./constants.js";
import { CSSTemplates } from "./cssTemplates.js";
import { ThemeUtils } from "./themeUtils.js";
import { GlobalSignalsHandler } from "./signalHandler.js";

/* overlayThemeManager.js
 *
 * GTK Theme Overlay Manager for CSSGnomme
 * Creates non-destructive theme overlays with symlinks and custom CSS
 */

export class OverlayThemeManager {
    constructor(extensionName = "CSSGnomme", logger = null) {
        this.extensionName = extensionName;
        this.overlayName = extensionName;
        this.overlayPath = `${GLib.get_home_dir()}/.themes/${this.overlayName}`;
        this.metadataFile = `${this.overlayPath}/index.theme`;

        // Use provided logger or create fallback
        if (logger) {
            this._logger = logger;
        } else {
            // Fallback if no logger provided
            this._logger = {
                info: msg => log(`[CSSGnomme:OverlayTheme:INFO] ${msg}`),
                warn: msg => log(`[CSSGnomme:OverlayTheme:WARN] ${msg}`),
                error: msg => log(`[CSSGnomme:OverlayTheme:ERROR] ${msg}`),
                debug: msg => log(`[CSSGnomme:OverlayTheme:DEBUG] ${msg}`)
            };
        }

        // Settings singleton instances (prevent memory leaks)
        this._interfaceSettings = null;
        this._shellSettings = null;

        // CSS template system for string pooling (memory optimization)
        this._cssTemplates = new CSSTemplates();

        // Track pending GLib timers for cleanup (prevent memory leaks)
        this._pendingTimers = [];

        // Centralized signal management (ready for future file watchers or settings monitoring)
        this._signalsHandler = new GlobalSignalsHandler();

        // Base theme CSS cache (TIER 1 optimization - processed source CSS)
        // Cache key format: "gtk-base:ThemeName:version:light|dark:tintStrength"
        //                   "shell-base:ThemeName:tintStrength"
        // Invalidated only on source theme change or tint strength adjustment
        this._baseThemeCache = new Map();
        this._baseThemeCacheStats = { hits: 0, misses: 0 };
        this._baseThemeCacheMaxSize = Constants.CACHE_LIMITS.baseTheme;

        // Component CSS cache (TIER 2 optimization - Shell CSS components)
        // Cache key format: "component-name:hash-of-relevant-settings"
        // Components: panel, popup, zorin, fluent
        // Invalidated when relevant settings change (smart invalidation)
        this._componentCssCache = new Map();
        this._componentCacheStats = { hits: 0, misses: 0 };
        this._componentCacheMaxSize = Constants.CACHE_LIMITS.componentCss;

        // Accent color cache (TIER 3 optimization - theme accent color parsing)
        // Cache key format: "themePath:colorScheme"
        // Example: "/usr/share/themes/ZorinBlue-Dark:prefer-dark"
        // Invalidated on source theme change or extension disable
        // Benefit: 6x speedup (6ms → 1ms per CSS update with 6 accent detection calls)
        this._accentColorCache = new Map();
        this._accentCacheStats = { hits: 0, misses: 0 };

        this._logger.info("OverlayThemeManager initialized (sync mode)");
    }

    // ===== SETTINGS SINGLETON GETTERS =====

    /**
     * Get org.gnome.desktop.interface Settings singleton
     * @returns {Gio.Settings} Interface settings instance
     */
    _getInterfaceSettings() {
        if (!this._interfaceSettings) {
            this._interfaceSettings = new Gio.Settings({ schema: "org.gnome.desktop.interface" });
        }
        return this._interfaceSettings;
    }

    /**
     * Get org.gnome.shell.extensions.user-theme Settings singleton
     * @returns {Gio.Settings} Shell theme settings instance
     */
    _getShellSettings() {
        if (!this._shellSettings) {
            const shellThemeSchema = "org.gnome.shell.extensions.user-theme";
            this._shellSettings = new Gio.Settings({ schema: shellThemeSchema });
        }
        return this._shellSettings;
    }

    // ===== THEME DISCOVERY =====

    /**
     * Discover source theme location and validate
     * Searches in standard GTK theme locations
     * @param {string} themeName - Name of the source theme
     * @returns {string|null} Full path to theme or null if not found
     */
    discoverSourceTheme(themeName) {
        const locations = [
            `${GLib.get_home_dir()}/.themes/${themeName}`,
            `${GLib.get_home_dir()}/.local/share/themes/${themeName}`,
            `/usr/share/themes/${themeName}`,
            `/usr/local/share/themes/${themeName}`
        ];

        for (const path of locations) {
            const themeDir = Gio.File.new_for_path(path);
            if (themeDir.query_exists(null)) {
                this._logger.info(` Found source theme at: ${path}`);
                return path;
            }
        }

        this._logger.info(` Source theme ${themeName} not found in any location`);
        return null;
    }

    /**
     * Get list of available themes from all locations
     * @returns {Array} Array of theme names
     */
    getAvailableThemes() {
        const themes = new Set();
        const locations = [
            `${GLib.get_home_dir()}/.themes`,
            `${GLib.get_home_dir()}/.local/share/themes`,
            "/usr/share/themes",
            "/usr/local/share/themes"
        ];

        locations.forEach(location => {
            const dir = Gio.File.new_for_path(location);
            if (!dir.query_exists(null)) return;

            try {
                const enumerator = dir.enumerate_children(
                    "standard::name,standard::type",
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );

                try {
                    let fileInfo;
                    while ((fileInfo = enumerator.next_file(null)) !== null) {
                        if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                            const themeName = fileInfo.get_name();
                            // Skip our overlay theme
                            if (themeName !== this.overlayName) {
                                themes.add(themeName);
                            }
                        }
                    }
                } finally {
                    enumerator.close(null);
                }
            } catch (e) {
                // Ignore permission errors
            }
        });

        return Array.from(themes).sort();
    }

    /**
     * Detect GTK versions and their structure in source theme
     * @param {string} sourcePath - Path to source theme
     * @returns {Object} Object with gtk-3.0 and gtk-4.0 info
     */
    detectGtkVersions(sourcePath) {
        const versions = {};

        ["gtk-3.0", "gtk-4.0"].forEach(version => {
            const gtkDir = Gio.File.new_for_path(`${sourcePath}/${version}`);
            versions[version] = {
                exists: gtkDir.query_exists(null),
                hasGtkCss: false,
                hasDarkCss: false,
                assets: []
            };

            if (versions[version].exists) {
                // Check for gtk.css
                const gtkCss = Gio.File.new_for_path(`${sourcePath}/${version}/gtk.css`);
                versions[version].hasGtkCss = gtkCss.query_exists(null);

                // Check for gtk-dark.css
                const darkCss = Gio.File.new_for_path(`${sourcePath}/${version}/gtk-dark.css`);
                versions[version].hasDarkCss = darkCss.query_exists(null);

                // List all assets/subdirectories
                try {
                    const enumerator = gtkDir.enumerate_children(
                        "standard::name,standard::type",
                        Gio.FileQueryInfoFlags.NONE,
                        null
                    );

                    try {
                        let fileInfo;
                        while ((fileInfo = enumerator.next_file(null)) !== null) {
                            const name = fileInfo.get_name();
                            // Skip CSS files we'll override
                            if (name !== "gtk.css" && name !== "gtk-dark.css") {
                                versions[version].assets.push(name);
                            }
                        }
                    } finally {
                        enumerator.close(null);
                    }
                } catch (e) {
                    this._logger.info(` Error listing ${version} assets: ${e}`);
                }
            }
        });

        return versions;
    }

    /**
     * Detect GNOME Shell theme structure in source
     * @param {string} sourcePath - Path to source theme
     * @returns {Object} Shell theme info
     */
    detectShellTheme(sourcePath) {
        const shellDir = Gio.File.new_for_path(`${sourcePath}/gnome-shell`);

        const shellInfo = {
            exists: shellDir.query_exists(null),
            hasShellCss: false,
            hasPadOsdCss: false,
            assets: []
        };

        if (!shellInfo.exists) {
            return shellInfo;
        }

        // Check for gnome-shell.css (main file)
        const shellCss = Gio.File.new_for_path(`${sourcePath}/gnome-shell/gnome-shell.css`);
        shellInfo.hasShellCss = shellCss.query_exists(null);

        // Check for pad-osd.css (on-screen display for drawing tablets)
        const padOsdCss = Gio.File.new_for_path(`${sourcePath}/gnome-shell/pad-osd.css`);
        shellInfo.hasPadOsdCss = padOsdCss.query_exists(null);

        // List all assets to symlink
        try {
            const enumerator = shellDir.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            try {
                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const name = fileInfo.get_name();
                    // Skip CSS files we'll override
                    if (name !== "gnome-shell.css" && name !== "pad-osd.css") {
                        shellInfo.assets.push(name);
                    }
                }
            } finally {
                enumerator.close(null);
            }
        } catch (e) {
            this._logger.error(` Error listing shell assets: ${e}`);
        }

        this._logger.info(
            ` Shell theme detected: shellCss=${shellInfo.hasShellCss}, padOsd=${shellInfo.hasPadOsdCss}, assets=${shellInfo.assets.length}`
        );
        return shellInfo;
    }

    /**
     * Get all non-GTK directories from source theme for symlinking
     * @param {string} sourcePath - Path to source theme
     * @returns {Array} Array of directory names
     */
    getNonGtkDirectories(sourcePath) {
        const sourceDir = Gio.File.new_for_path(sourcePath);
        const directories = [];

        if (!sourceDir.query_exists(null)) {
            return directories;
        }

        try {
            const enumerator = sourceDir.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            try {
                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                        const name = fileInfo.get_name();
                        // Exclude gtk-*, gnome-shell (we handle separately), and metadata
                        if (!name.match(/^gtk-\d/) && name !== "gnome-shell" && name !== "index.theme") {
                            directories.push(name);
                        }
                    }
                }
            } finally {
                enumerator.close(null);
            }
        } catch (e) {
            this._logger.info(` Error listing source directories: ${e}`);
        }

        return directories;
    }

    // ===== OVERLAY CREATION =====

    /**
     * Create complete overlay theme structure
     * Uses sync file operations for simplicity and speed
     * @param {string} sourceThemeName - Name of source theme to overlay
     * @param {Object} settings - Extension settings object
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings (optional, for saving original themes)
     * @returns {boolean} Success status
     */
    createOverlayTheme(sourceThemeName, settings, interfaceSettings = null) {
        const sourcePath = this.discoverSourceTheme(sourceThemeName);
        if (!sourcePath) {
            this._logger.info(` Cannot create overlay - source theme not found`);
            return false;
        }

        // Check if source theme changed - invalidate base theme cache
        const metadata = this.readIndexTheme();
        if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
            const previousSourceTheme = metadata[`X-${this.extensionName}-Extension`].SourceTheme;
            if (previousSourceTheme && previousSourceTheme !== sourceThemeName) {
                this._logger.info(
                    `🔄 Source theme changed (${previousSourceTheme} → ${sourceThemeName}) - clearing base theme cache`
                );
                this._baseThemeCache.clear();
                this._baseThemeCacheStats = { hits: 0, misses: 0 };

                // Clear accent color cache on source theme change
                this._clearAccentColorCache();
            }
        }

        // ← FIX: Read original themes BEFORE checking if overlay active
        // This prevents circular bug where OriginalGtkTheme = "CSSGnomme"
        let originalGtkTheme = sourceThemeName; // Fallback
        let originalShellTheme = sourceThemeName; // Fallback
        let originalIconTheme = sourceThemeName; // Fallback

        if (interfaceSettings) {
            const currentGtkTheme = interfaceSettings.get_string("gtk-theme");
            const currentIconTheme = interfaceSettings.get_string("icon-theme");

            // ← FIX: If current theme is overlay, read from existing metadata
            if (currentGtkTheme === this.overlayName) {
                const metadata = this.readIndexTheme();
                if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
                    originalGtkTheme =
                        metadata[`X-${this.extensionName}-Extension`].OriginalGtkTheme || sourceThemeName;
                    originalShellTheme =
                        metadata[`X-${this.extensionName}-Extension`].OriginalShellTheme || sourceThemeName;
                    originalIconTheme =
                        metadata[`X-${this.extensionName}-Extension`].OriginalIconTheme || sourceThemeName;
                    this._logger.info(
                        ` Preserved original themes from metadata: GTK=${originalGtkTheme}, Icon=${originalIconTheme}`
                    );
                } else {
                    // No metadata, use sourceThemeName as fallback
                    originalGtkTheme = sourceThemeName;
                    originalIconTheme = sourceThemeName;
                    this._logger.warn(` Overlay active but no metadata - using sourceTheme as fallback`);
                }
            } else {
                // Not using overlay, save current themes as originals
                originalGtkTheme = currentGtkTheme;
                originalIconTheme = currentIconTheme;
                this._logger.info(
                    ` Saved current themes as originals: GTK=${originalGtkTheme}, Icon=${originalIconTheme}`
                );
            }

            try {
                const shellThemeSettings = new Gio.Settings({
                    schema: "org.gnome.shell.extensions.user-theme"
                });
                const currentShellTheme = shellThemeSettings.get_string("name");
                this._logger.debug(` Current Shell theme from user-theme extension: '${currentShellTheme}'`);

                // Same logic for Shell theme
                if (currentShellTheme === this.overlayName) {
                    const metadata = this.readIndexTheme();
                    if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
                        originalShellTheme =
                            metadata[`X-${this.extensionName}-Extension`].OriginalShellTheme || sourceThemeName;
                        this._logger.info(` Preserved original Shell theme from metadata: ${originalShellTheme}`);
                    } else {
                        originalShellTheme = sourceThemeName;
                        this._logger.warn(
                            ` Overlay Shell theme active but no metadata - using sourceTheme as fallback`
                        );
                    }
                } else {
                    originalShellTheme = currentShellTheme;
                    this._logger.info(` Saved current Shell theme as original: ${originalShellTheme}`);
                }
            } catch (e) {
                originalShellTheme = originalGtkTheme; // Fallback to GTK theme
                this._logger.warn(
                    ` user-theme extension not available, using GTK theme as Shell theme: ${originalShellTheme}`
                );
            }
        } else {
            // ← FIX: If interfaceSettings not provided, read directly from GSettings
            try {
                const ifaceSettings = this._getInterfaceSettings();
                const currentGtkTheme = ifaceSettings.get_string("gtk-theme");
                const currentIconTheme = ifaceSettings.get_string("icon-theme");

                // Same circular reference check
                if (currentGtkTheme === this.overlayName) {
                    const metadata = this.readIndexTheme();
                    if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
                        originalGtkTheme =
                            metadata[`X-${this.extensionName}-Extension`].OriginalGtkTheme || sourceThemeName;
                        originalIconTheme =
                            metadata[`X-${this.extensionName}-Extension`].OriginalIconTheme || sourceThemeName;
                    } else {
                        originalGtkTheme = sourceThemeName;
                        originalIconTheme = sourceThemeName;
                    }
                } else {
                    originalGtkTheme = currentGtkTheme;
                    originalIconTheme = currentIconTheme;
                }

                this._logger.info(
                    ` Read original themes from GSettings: GTK=${originalGtkTheme}, Icon=${originalIconTheme}`
                );
            } catch (e) {
                this._logger.warn(` Could not read original themes from GSettings: ${e.message}`);
            }
        }

        try {
            // Create base overlay directory (sync - very fast)
            this._createDirectory(this.overlayPath);

            // Get theme structure (sync - just directory scans)
            const gtkVersions = this.detectGtkVersions(sourcePath);
            const shellTheme = this.detectShellTheme(sourcePath);
            const otherDirs = this.getNonGtkDirectories(sourcePath);

            this._logger.info(` Creating overlay with ${otherDirs.length} symlinked directories`);

            // Collect all CSS generation tasks
            // Using 'let' instead of 'const' to allow later reassignment for memory cleanup
            let cssFiles = {};

            // Generate GTK CSS (sync - template generation)
            for (const version of Object.keys(gtkVersions)) {
                if (gtkVersions[version].exists) {
                    // Generate base-theme.css files (neutralized, tint removed)
                    // IMPORTANT: Generate separate light/dark base themes for future-proofing
                    // (some themes may have different tint colors in gtk.css vs gtk-dark.css)

                    // Light variant base theme (if gtk.css exists)
                    if (gtkVersions[version].hasGtkCss) {
                        const baseCss = this._generateGtkBaseCss(version, sourcePath, false, settings);
                        cssFiles[`${this.overlayPath}/${version}/base-theme.css`] = baseCss;
                    }

                    // Dark variant base theme (if gtk-dark.css exists)
                    if (gtkVersions[version].hasDarkCss) {
                        const baseDarkCss = this._generateGtkBaseCss(version, sourcePath, true, settings);
                        cssFiles[`${this.overlayPath}/${version}/base-theme-dark.css`] = baseDarkCss;
                    }

                    // Generate gtk.css (import base-theme.css + overrides)
                    if (gtkVersions[version].hasGtkCss) {
                        const gtkCss = this._generateGtkCss(version, sourcePath, false, settings);
                        cssFiles[`${this.overlayPath}/${version}/gtk.css`] = gtkCss;
                    }

                    // Generate gtk-dark.css (import base-theme-dark.css + overrides)
                    if (gtkVersions[version].hasDarkCss) {
                        const darkCss = this._generateGtkCss(version, sourcePath, true, settings);
                        cssFiles[`${this.overlayPath}/${version}/gtk-dark.css`] = darkCss;
                    }

                    // Create version directory
                    this._createDirectory(`${this.overlayPath}/${version}`);
                }
            }

            // Generate Shell CSS (sync - template generation)
            if (shellTheme.exists) {
                // Create shell directory first
                this._createDirectory(`${this.overlayPath}/gnome-shell`);

                // Generate base-theme.css (modified original CSS)
                const baseThemeCss = this._generateBaseThemeCss(sourcePath, settings);
                cssFiles[`${this.overlayPath}/gnome-shell/base-theme.css`] = baseThemeCss;

                // Generate gnome-shell.css (our dynamic overrides)
                const shellCss = this._generateShellCss(sourcePath, settings);
                cssFiles[`${this.overlayPath}/gnome-shell/gnome-shell.css`] = shellCss;

                // Generate pad-osd.css if source has it
                if (shellTheme.hasPadOsd) {
                    const padOsdCss = this._generatePadOsdCss(sourcePath, settings);
                    cssFiles[`${this.overlayPath}/gnome-shell/pad-osd.css`] = padOsdCss;
                }
            }

            // Write ALL CSS files synchronously (simpler, faster for small batches)
            this._logger.info(` Writing ${Object.keys(cssFiles).length} CSS files synchronously...`);
            const batchStart = Date.now();

            let writeErrors = 0;
            for (const [filePath, content] of Object.entries(cssFiles)) {
                try {
                    this._writeFile(filePath, content);
                } catch (error) {
                    this._logger.error(` Failed to write ${filePath}: ${error.message}`);
                    writeErrors++;
                }
            }

            const batchElapsed = Date.now() - batchStart;
            this._logger.info(` CSS sync write completed in ${batchElapsed}ms`);

            if (writeErrors > 0) {
                this._logger.warn(` CSS write had ${writeErrors} errors`);
            }

            // MEMORY LEAK FIX: Clear CSS file map to release large strings from memory
            // These strings can be 100KB+ each (6 files = ~600KB total)
            const memBefore = this._getMemoryUsageMB();
            const cssFileCount = Object.keys(cssFiles).length;
            let totalCssSize = 0;
            for (const key in cssFiles) {
                totalCssSize += cssFiles[key].length;
                delete cssFiles[key]; // Explicit property deletion
            }
            const cssSizeMB = (totalCssSize / (1024 * 1024)).toFixed(2);

            this._logger.info(
                `📊 Memory BEFORE CSS cleanup: ${memBefore}MB (${cssFileCount} files, ${cssSizeMB}MB CSS data)`
            );

            // Hint garbage collector to clean up large CSS strings
            try {
                System.gc();

                // Wait 100ms for GC to complete, then check memory
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    const memAfter = this._getMemoryUsageMB();
                    const delta = memAfter - memBefore;
                    this._logger.info(
                        `📊 Memory AFTER CSS cleanup + GC: ${memAfter}MB (Δ ${delta >= 0 ? "+" : ""}${delta.toFixed(
                            1
                        )}MB)`
                    );
                    return false; // One-shot timeout
                });

                this._logger.debug(` Triggered GC after clearing ${cssFileCount} CSS strings (${cssSizeMB}MB)`);
            } catch (e) {
                this._logger.error(` ⚠️  GC ERROR after CSS cleanup: ${e.message}`);
            }

            // Symlink GTK version assets (Sprint 5 fix - Fluent theme support)
            for (const version of Object.keys(gtkVersions)) {
                if (
                    gtkVersions[version].exists &&
                    gtkVersions[version].assets &&
                    gtkVersions[version].assets.length > 0
                ) {
                    gtkVersions[version].assets.forEach(asset => {
                        this._createSymlink(
                            `${sourcePath}/${version}/${asset}`,
                            `${this.overlayPath}/${version}/${asset}`
                        );
                    });
                    this._logger.info(` Symlinked ${gtkVersions[version].assets.length} ${version} assets`);
                }
            }

            // Symlink ALL other directories (sync - fast symlink operations)
            otherDirs.forEach(dir => {
                this._createSymlink(`${sourcePath}/${dir}`, `${this.overlayPath}/${dir}`);
            });

            // Symlink Shell theme assets if exists (sync - fast symlink operations)
            if (shellTheme.exists && shellTheme.assets && shellTheme.assets.length > 0) {
                shellTheme.assets.forEach(asset => {
                    this._createSymlink(
                        `${sourcePath}/gnome-shell/${asset}`,
                        `${this.overlayPath}/gnome-shell/${asset}`
                    );
                });
                this._logger.info(` Symlinked ${shellTheme.assets.length} Shell theme assets`);
            }

            // Detect and apply theme accent color to settings (sync - just settings write)
            this.detectAndApplyAccentColor(sourcePath, settings);

            // Write metadata with original themes (sync - small file)
            this._writeIndexTheme({
                sourceThemeName,
                sourcePath,
                gtkVersions,
                originalGtkTheme,
                originalShellTheme,
                originalIconTheme
            });

            // Write README (sync - small file)
            this._writeReadme(sourceThemeName);

            this._logger.info(` Overlay theme created successfully`);
            return true;
        } catch (e) {
            this._logger.error(` Error creating overlay theme: ${e.message}`);
            this._logger.error(` Stack: ${e.stack}`);
            return false;
        }
    }

    /**
     * Create GNOME Shell theme overlay
     * @param {string} sourcePath - Source theme path
     * @param {Object} shellInfo - Shell theme info
     * @param {Object} settings - Extension settings
     */
    _createShellOverlay(sourcePath, shellInfo, settings) {
        if (!shellInfo.exists) {
            this._logger.info(` Source has no gnome-shell directory, skipping`);
            return;
        }

        const overlayShellDir = `${this.overlayPath}/gnome-shell`;
        this._createDirectory(overlayShellDir);

        this._logger.info(` Creating gnome-shell overlay with ${shellInfo.assets.length} assets`);

        // Generate gnome-shell.css
        if (shellInfo.hasShellCss) {
            // First, generate base-theme.css (modified original CSS)
            const baseThemeCss = this._generateBaseThemeCss(sourcePath, settings);
            this._writeFile(`${overlayShellDir}/base-theme.css`, baseThemeCss);
            this._logger.info(` Generated base-theme.css with modifications`);

            // Then generate gnome-shell.css (our dynamic overrides)
            const shellCss = this._generateShellCss(sourcePath, settings);
            this._writeFile(`${overlayShellDir}/gnome-shell.css`, shellCss);
            this._logger.info(` Generated gnome-shell.css`);
        }

        // Generate pad-osd.css if source has it
        if (shellInfo.hasPadOsdCss) {
            const padOsdCss = this._generatePadOsdCss(sourcePath, settings);
            this._writeFile(`${overlayShellDir}/pad-osd.css`, padOsdCss);
            this._logger.info(` Generated pad-osd.css`);
        }

        // Symlink all assets (icons, images, etc.)
        shellInfo.assets.forEach(asset => {
            this._createSymlink(`${sourcePath}/gnome-shell/${asset}`, `${overlayShellDir}/${asset}`);
        });

        this._logger.info(` GNOME Shell overlay created successfully`);
    }

    /**
     * Generate GTK base-theme.css with tint removal and modifications
     * Same logic as Shell CSS - processes original theme CSS to remove Zorin tint colors
     * @param {string} version - GTK version (e.g., 'gtk-3.0')
     * @param {string} sourcePath - Source theme path
     * @param {boolean} isDark - Is dark variant
     * @param {Object} settings - Extension settings
     * @returns {string} Modified CSS with tint removed
     */
    _generateGtkBaseCss(version, sourcePath, isDark, settings) {
        const cssFile = isDark ? "gtk-dark.css" : "gtk.css";
        const sourceFile = `${sourcePath}/${version}/${cssFile}`;
        const sourceThemeName = sourcePath.split("/").pop();
        const isZorinTheme = sourceThemeName.toLowerCase().includes("zorin");

        // === BASE THEME CACHE (TIER 1 OPTIMIZATION) ===
        // Create cache key from immutable parameters
        const tintStrength = settings.get_int("zorin-tint-strength") || 0;
        const cacheKey = `gtk-base:${sourceThemeName}:${version}:${isDark ? "dark" : "light"}:${tintStrength}`;

        // Check cache first
        if (this._baseThemeCache.has(cacheKey)) {
            this._baseThemeCacheStats.hits++;
            this._logger.debug(`  ✅ Base theme cache HIT: ${cacheKey}`);
            return this._baseThemeCache.get(cacheKey);
        }

        // Cache miss - generate CSS
        this._baseThemeCacheStats.misses++;
        this._logger.info(`  ❌ Base theme cache MISS - generating: ${cacheKey}`);

        try {
            // Read original CSS
            const file = Gio.File.new_for_path(sourceFile);
            if (!file.query_exists(null)) {
                logError(new Error(`[${this.extensionName}] GTK source CSS not found: ${sourceFile}`));
                return null;
            }

            const { success, contents } = this._readCSSFileSync(file);
            if (!success) {
                logError(new Error(`[${this.extensionName}] Failed to read GTK CSS: ${sourceFile}`));
                return null;
            }

            const decoder = new TextDecoder("utf-8");
            let css = decoder.decode(contents);

            // For non-Zorin themes, return original CSS unchanged
            if (!isZorinTheme) {
                this._logger.info(` GTK Base: Non-Zorin theme, using original CSS`);
                return css;
            }

            // === ZORIN THEME: Detect and process tint colors (foreground + background) ===
            // Delegate tint detection to ThemeUtils
            const tintColors = ThemeUtils.detectGtkTintColors(css, isZorinTheme);
            const { fgHex: tintFgHex, fgRgb: tintFgRgb, bgHex: tintBgHex, bgRgb: tintBgRgb } = tintColors;

            if (tintFgHex && tintFgRgb) {
                this._logger.info(
                    ` GTK Base: Detected Zorin FOREGROUND tint: ${tintFgHex} (rgb ${tintFgRgb[0]}, ${tintFgRgb[1]}, ${tintFgRgb[2]})`
                );
            }

            if (tintBgHex && tintBgRgb) {
                this._logger.info(
                    ` GTK Base: Detected Zorin BACKGROUND tint: ${tintBgHex} (rgb ${tintBgRgb[0]}, ${tintBgRgb[1]}, ${tintBgRgb[2]})`
                );
            }

            // If no tints detected, return original CSS
            if (!tintFgHex && !tintBgHex) {
                this._logger.info(` GTK Base: No .background colors or @define-color detected (not a Zorin theme)`);
                return css; // No tint to process
            }

            // === DETERMINE DOMINANT TINT CHANNEL (for algorithmic neutralization) ===
            // Use foreground tint as reference (if available), else background tint
            const referenceTintRgb = tintFgRgb || tintBgRgb;

            // Calculate adaptive threshold using ThemeUtils
            const tintThreshold = ThemeUtils.calculateAdaptiveThreshold(referenceTintRgb);

            // Determine dominant channel using ThemeUtils
            const dominantChannel = ThemeUtils.determineDominantChannel(referenceTintRgb, tintThreshold);

            const [refR, refG, refB] = referenceTintRgb;
            const maxChannel = Math.max(refR, refG, refB);
            const minChannel = Math.min(refR, refG, refB);
            const tintStrengthInRef = maxChannel - minChannel;

            this._logger.info(
                ` GTK Base: Dominant tint channel: ${
                    dominantChannel ? dominantChannel.toUpperCase() : "NONE"
                } (ref: rgb(${refR}, ${refG}, ${refB}), adaptive threshold: ${tintThreshold}, ref tint: ${tintStrengthInRef})`
            );

            // Determine neutral colors based on theme variant
            const isLightTheme =
                sourceThemeName.includes("Light") ||
                sourceThemeName.includes("light") ||
                (!sourceThemeName.includes("Dark") && !sourceThemeName.includes("dark"));
            const neutralFgRgb = isLightTheme ? [50, 50, 50] : [200, 200, 200];
            // TRUE NEUTRAL gray - all channels equal (no blue/red/green tint!)
            const neutralBgRgb = isLightTheme ? [250, 250, 250] : [50, 50, 50]; // Pure neutral gray

            // Get tint strength setting (0-100%)
            const tintStrength = settings.get_int("zorin-tint-strength") || 0;
            this._logger.info(` GTK Base: Zorin tint strength: ${tintStrength}%`);

            // Track replacement counts
            let totalDefineColorMatches = 0;
            let totalRgbaMatches = 0;
            let totalHexMatches = 0;

            // === PROCESS FOREGROUND TINT (if detected) ===
            if (tintFgHex && tintFgRgb) {
                const targetFgRgb = this._blendTintColor(tintFgRgb, neutralFgRgb, tintStrength);
                const targetFgRgbString = `${targetFgRgb[0]}, ${targetFgRgb[1]}, ${targetFgRgb[2]}`;
                const targetFgHex = "#" + targetFgRgb.map(c => c.toString(16).padStart(2, "0")).join("");

                this._logger.info(
                    ` GTK Base: Target FOREGROUND (${tintStrength}% blend): ${targetFgHex} (rgb ${targetFgRgbString})`
                );

                // STEP 1: Replace @define-color directives
                const fgDefineColorRegex = new RegExp(
                    `(@define-color\\s+[\\w_-]+\\s+)${tintFgHex.replace("#", "#")}(\\s*;)`,
                    "gi"
                );
                const fgDefineColorMatches = css.match(fgDefineColorRegex);
                css = css.replace(fgDefineColorRegex, `$1${targetFgHex}$2`);
                totalDefineColorMatches += fgDefineColorMatches ? fgDefineColorMatches.length : 0;

                // STEP 2: Replace inline rgba(tintR, tintG, tintB, alpha) patterns
                const tintFgRgbString = `${tintFgRgb[0]}, ${tintFgRgb[1]}, ${tintFgRgb[2]}`;
                const fgRgbaRegex = new RegExp(
                    `rgba?\\(\\s*${tintFgRgbString.replace(/,/g, "\\s*,\\s*")}\\s*,\\s*([\\d.]+)\\s*\\)`,
                    "gi"
                );
                const fgRgbaMatches = css.match(fgRgbaRegex);
                css = css.replace(fgRgbaRegex, `rgba(${targetFgRgbString}, $1)`);
                totalRgbaMatches += fgRgbaMatches ? fgRgbaMatches.length : 0;

                // STEP 3: Replace inline #tintHex color codes
                const fgHexRegex = new RegExp(tintFgHex.replace("#", "#"), "gi");
                const fgHexMatches = css.match(fgHexRegex);
                css = css.replace(fgHexRegex, targetFgHex);
                totalHexMatches += fgHexMatches ? fgHexMatches.length : 0;
            }

            // === PROCESS BACKGROUND TINT (if detected) ===
            if (tintBgHex && tintBgRgb) {
                const targetBgRgb = this._blendTintColor(tintBgRgb, neutralBgRgb, tintStrength);
                const targetBgRgbString = `${targetBgRgb[0]}, ${targetBgRgb[1]}, ${targetBgRgb[2]}`;
                const targetBgHex = "#" + targetBgRgb.map(c => c.toString(16).padStart(2, "0")).join("");

                this._logger.info(
                    ` GTK Base: Target BACKGROUND (${tintStrength}% blend): ${targetBgHex} (rgb ${targetBgRgbString})`
                );

                // STEP 1: Replace @define-color directives
                const bgDefineColorRegex = new RegExp(
                    `(@define-color\\s+[\\w_-]+\\s+)${tintBgHex.replace("#", "#")}(\\s*;)`,
                    "gi"
                );
                const bgDefineColorMatches = css.match(bgDefineColorRegex);
                css = css.replace(bgDefineColorRegex, `$1${targetBgHex}$2`);
                totalDefineColorMatches += bgDefineColorMatches ? bgDefineColorMatches.length : 0;

                // STEP 2: Replace inline rgba(tintR, tintG, tintB, alpha) patterns
                const tintBgRgbString = `${tintBgRgb[0]}, ${tintBgRgb[1]}, ${tintBgRgb[2]}`;
                const bgRgbaRegex = new RegExp(
                    `rgba?\\(\\s*${tintBgRgbString.replace(/,/g, "\\s*,\\s*")}\\s*,\\s*([\\d.]+)\\s*\\)`,
                    "gi"
                );
                const bgRgbaMatches = css.match(bgRgbaRegex);
                css = css.replace(bgRgbaRegex, `rgba(${targetBgRgbString}, $1)`);
                totalRgbaMatches += bgRgbaMatches ? bgRgbaMatches.length : 0;

                // STEP 3: Replace inline #tintHex color codes
                const bgHexRegex = new RegExp(tintBgHex.replace("#", "#"), "gi");
                const bgHexMatches = css.match(bgHexRegex);
                css = css.replace(bgHexRegex, targetBgHex);
                totalHexMatches += bgHexMatches ? bgHexMatches.length : 0;
            }

            this._logger.info(
                ` GTK Base: Replaced ${totalDefineColorMatches} @define-color + ${totalRgbaMatches} rgba() + ${totalHexMatches} hex tint colors (FG+BG combined)`
            );

            // === STEP 4: ALGORITHMIC NEUTRALIZATION of tinted BACKGROUND colors ===
            // Find and neutralize ONLY background-related colors with dominant channel tint
            // Preserves foreground colors (text, borders, accents) to maintain theme identity
            if (dominantChannel) {
                this._logger.info(
                    ` GTK Base: Starting algorithmic neutralization for ${dominantChannel.toUpperCase()}-tinted BACKGROUND colors...`
                );

                // Delegate to ThemeUtils for context-aware neutralization
                const neutralizationResult = ThemeUtils.neutralizeTintedCss(css, {
                    dominantChannel,
                    threshold: tintThreshold,
                    tintStrength,
                    blendFunction: this._blendTintColor.bind(this)
                });

                css = neutralizationResult.css;

                this._logger.info(
                    ` GTK Base: Algorithmic neutralization replaced ${neutralizationResult.replacementCount} tinted colors (backgrounds + @define-color, ${neutralizationResult.whitelistedBlocks} blocks preserved)`
                );
            }

            // Add header comment
            const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
            const tintModification =
                tintStrength === 0
                    ? "Tint removed"
                    : tintStrength === 100
                    ? "Original tint preserved"
                    : `Tint reduced to ${tintStrength}%`;
            const header = `/*
 * CSSGnomme GTK Base Theme
 * Generated: ${timestamp}
 * Theme: ${sourceThemeName} (${isZorinTheme ? "Zorin" : "Standard"}, ${isLightTheme ? "Light" : "Dark"})
 * Source: ${sourceFile}
 * Modifications: ${tintModification}
 */

`;
            const result = header + css;

            // Cache the result for future use
            this._baseThemeCache.set(cacheKey, result);
            this._logger.info(`  💾 Cached base theme: ${(result.length / 1024).toFixed(1)}KB`);

            // Enforce LRU eviction if cache exceeds limit
            this._enforceCacheLRU(this._baseThemeCache, this._baseThemeCacheMaxSize, "base theme");

            return result;
        } catch (e) {
            logError(e, `[${this.extensionName}] Error generating GTK base CSS`);
            return null;
        }
    }

    /**
     * Generate gtk.css with import + overrides
     * Now imports base-theme.css instead of original theme CSS
     * @param {string} version - GTK version
     * @param {string} sourcePath - Source theme path
     * @param {boolean} isDark - Is dark variant
     * @param {Object} settings - Extension settings
     * @returns {string} Generated CSS content
     */
    _generateGtkCss(version, sourcePath, isDark, settings, isLightTheme = null) {
        const cssFile = isDark ? "gtk-dark.css" : "gtk.css";

        // Detect source theme name and type
        const sourceThemeName = sourcePath.split("/").pop();
        const isZorinTheme = sourceThemeName.toLowerCase().includes("zorin");
        const enableZorinIntegration = settings.get_boolean("enable-zorin-integration");

        // Get settings values (allow 0 for flat appearance)
        const borderRadius = settings.get_int("border-radius");

        // Detect theme accent color for switch/checkbox styling (cached for performance)
        const accentColor = this._getCachedAccentColor(sourcePath);
        const themeIsLight = isLightTheme !== null ? isLightTheme : this._isLightTheme(sourcePath);

        // === EXTRACT UNIFIED COLOR SETTINGS ===
        const colorSettings = this._extractColorSettings(sourcePath, settings);

        // Log GTK color sources for debugging
        this._logger.info(` GTK Panel: ${colorSettings.panel.source}`);
        this._logger.info(` GTK Popup: ${colorSettings.popup.source}`);

        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
        // Fix v2.4.2: Use separate base themes for light/dark variants (future-proof)
        // This allows different tint processing if themes have different colors in gtk.css vs gtk-dark.css
        const baseThemeFile = isDark ? "base-theme-dark.css" : "base-theme.css";

        // ALWAYS use base-theme-*.css - we just generated it in memory (line 490-503)
        // During overlay creation, base-theme always exists (generated in same batch)
        const baseThemeExists = true;
        const importSource = baseThemeFile;

        // Delegate to cssTemplates for complete CSS generation
        return this._cssTemplates.getGtkOverlayCss(
            this.extensionName,
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
        );
    }

    /**
     * Apply unified opacity to color string
     * Extracts RGB from rgba()/rgb() and applies new opacity
     * @param {string} colorStr - Color string (rgba or rgb)
     * @param {number} opacity - Opacity value (0.0 - 1.0)
     * @returns {string} Color with applied opacity
     */
    _applyOpacityToColor(colorStr, opacity) {
        // Match rgba(R, G, B, A) or rgb(R, G, B)
        const rgbaMatch = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/);

        if (rgbaMatch) {
            const [, r, g, b] = rgbaMatch;
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        // Fallback to original color if parsing fails
        return colorStr;
    }

    /**
     * Get cached accent color or parse if not cached
     * Cache key includes color-scheme to handle light/dark theme variants
     * @param {string} sourcePath - Theme directory path
     * @returns {Array|null} RGB array [r, g, b] or null if not found
     */
    _getCachedAccentColor(sourcePath) {
        // Get current color-scheme for cache key (light themes may have different accents)
        const colorScheme = this._getSystemColorScheme();
        const cacheKey = `${sourcePath}:${colorScheme}`;

        if (this._accentColorCache.has(cacheKey)) {
            this._accentCacheStats.hits++;
            this._logger.debug(` ✅ Accent color cache HIT: ${cacheKey}`);
            return this._accentColorCache.get(cacheKey);
        }

        this._accentCacheStats.misses++;
        this._logger.debug(` ❌ Accent color cache MISS: ${cacheKey}`);
        const accentColor = this._parseThemeAccentColor(sourcePath); // Original parsing logic
        this._accentColorCache.set(cacheKey, accentColor);

        return accentColor;
    }

    /**
     * Clear accent color cache
     * Called on source theme change or extension disable
     */
    _clearAccentColorCache() {
        const size = this._accentColorCache.size;
        this._accentColorCache.clear();
        this._accentCacheStats = { hits: 0, misses: 0 };
        if (size > 0) {
            this._logger.debug(` Accent color cache cleared (${size} entries)`);
        }
    }

    /**
     * Parse GTK4 @accent_bg_color from gtk-4.0/gtk.css or gtk-dark.css
     * GTK4 libadwaita uses @accent_bg_color consistently across themes
     * This is the most reliable source for modern themes (Fluent, Zorin, etc.)
     * @param {string} sourcePath - Source theme path
     * @returns {Object|null} {color: [r,g,b], source: string, isValid: boolean} or null
     */
    _parseGtk4AccentColor(sourcePath) {
        // Try gtk-dark.css first if dark theme, then gtk.css
        const isDarkTheme = this._systemPrefersDark();
        const cssFiles = isDarkTheme
            ? [`${sourcePath}/gtk-4.0/gtk-dark.css`, `${sourcePath}/gtk-4.0/gtk.css`]
            : [`${sourcePath}/gtk-4.0/gtk.css`, `${sourcePath}/gtk-4.0/gtk-dark.css`];

        for (const cssPath of cssFiles) {
            const cssFile = Gio.File.new_for_path(cssPath);

            if (!cssFile.query_exists(null)) {
                continue; // Try next file
            }

            try {
                const { success, contents } = this._readCSSFileSync(cssFile);
                if (!success) {
                    continue;
                }

                const cssText = new TextDecoder().decode(contents);

                // Pattern: @define-color accent_bg_color #xxxxxx
                const accentMatch = cssText.match(/@define-color\s+accent_bg_color\s+#([0-9a-fA-F]{6})/);

                if (accentMatch) {
                    const hex = accentMatch[1];
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);

                    // Validate accent color
                    const validation = ThemeUtils.isValidAccent(r, g, b);
                    const cssFileName = cssPath.split("/").pop();

                    if (validation.isValid) {
                        this._logger.info(
                            ` Parsed GTK4 @accent_bg_color from ${cssFileName}: rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                        );
                        return {
                            color: [r, g, b],
                            source: `GTK4 ${cssFileName}`,
                            isValid: true
                        };
                    } else {
                        this._logger.debug(
                            ` Rejected GTK4 @accent_bg_color from ${cssFileName}: rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                        );
                        return {
                            color: [r, g, b],
                            source: `GTK4 ${cssFileName}`,
                            isValid: false
                        };
                    }
                }
            } catch (e) {
                this._logger.debug(` Error reading GTK4 CSS ${cssPath}: ${e.message}`);
            }
        }

        return null; // No GTK4 accent color found
    }

    /**
     * Parse theme accent color from CSS with priority order:
     * 0. GTK4 @accent_bg_color (highest priority - modern themes)
     * 1. GTK3 switch:checked background (reliable for legacy themes)
     * 2. GTK3 @theme_selected_bg_color (fallback)
     * 3. GNOME Shell stage color (if saturated enough)
     * 4. Most frequent saturated color (last resort)
     * @param {string} sourcePath - Source theme path
     * @returns {Array|null} [r, g, b] array or null if not found
     */
    _parseThemeAccentColor(sourcePath) {
        // Priority 0: GTK4 @accent_bg_color (libadwaita - most reliable for modern themes)
        const gtk4Result = this._parseGtk4AccentColor(sourcePath);
        if (gtk4Result && gtk4Result.isValid) {
            let [r, g, b] = gtk4Result.color;

            // Depastelify for dark themes
            const isDarkTheme = this._systemPrefersDark();
            if (isDarkTheme) {
                const result = ThemeUtils.depastelizeAccent(r, g, b);
                if (result.transformed) {
                    [r, g, b] = result.rgb;
                    this._logger.info(` Depastelized GTK4 accent: ${result.before} → ${result.after}`);
                }
            }

            return [r, g, b];
        }

        // Priority 1 & 2: Check GTK-3.0 CSS (fallback for themes without GTK4)
        const gtkCssFile = Gio.File.new_for_path(`${sourcePath}/gtk-3.0/gtk.css`);

        if (gtkCssFile.query_exists(null)) {
            try {
                const { success, contents } = this._readCSSFileSync(gtkCssFile);
                if (success) {
                    const cssText = new TextDecoder().decode(contents);

                    // Priority 1: switch:checked { background-color: #xxxxxx }
                    // This is the most reliable accent color in most themes
                    // CRITICAL: (?!:) negative lookahead prevents matching :hover/:active/:disabled states
                    const switchMatch = cssText.match(
                        /switch:checked(?!:)\s*\{[^}]*background-color:\s*#([0-9a-fA-F]{6})/
                    );

                    if (switchMatch) {
                        const hex = switchMatch[1];
                        let r = parseInt(hex.substring(0, 2), 16);
                        let g = parseInt(hex.substring(2, 4), 16);
                        let b = parseInt(hex.substring(4, 6), 16);

                        // Validate accent color (reject grey/white/black)
                        const validation = ThemeUtils.isValidAccent(r, g, b);

                        if (validation.isValid) {
                            // Depastelify accent colors for dark themes (Zorin Dark fix)
                            const isDarkTheme = this._systemPrefersDark();
                            if (isDarkTheme) {
                                const result = ThemeUtils.depastelizeAccent(r, g, b);
                                if (result.transformed) {
                                    [r, g, b] = result.rgb;
                                    this._logger.info(` Depastelized accent: ${result.before} → ${result.after}`);
                                }
                            }

                            this._logger.info(
                                ` Parsed accent from GTK switch:checked: rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                            );
                            return [r, g, b];
                        } else {
                            this._logger.debug(
                                ` Rejected switch:checked color rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                            );
                        }
                    }

                    // Priority 2: @define-color theme_selected_bg_color #xxxxxx
                    const selectedBgMatch = cssText.match(
                        /@define-color\s+theme_selected_bg_color\s+#([0-9a-fA-F]{6})/
                    );

                    if (selectedBgMatch) {
                        const hex = selectedBgMatch[1];
                        let r = parseInt(hex.substring(0, 2), 16);
                        let g = parseInt(hex.substring(2, 4), 16);
                        let b = parseInt(hex.substring(4, 6), 16);

                        // Validate accent color (reject grey/white/black)
                        const validation = ThemeUtils.isValidAccent(r, g, b);

                        if (validation.isValid) {
                            // Depastelify accent colors for dark themes (Zorin Dark fix)
                            const isDarkTheme = this._systemPrefersDark();
                            if (isDarkTheme) {
                                const result = ThemeUtils.depastelizeAccent(r, g, b);
                                if (result.transformed) {
                                    [r, g, b] = result.rgb;
                                    this._logger.info(` Depastelized accent: ${result.before} → ${result.after}`);
                                }
                            }

                            this._logger.info(
                                ` Parsed accent from GTK theme_selected_bg_color: rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                            );
                            return [r, g, b];
                        } else {
                            this._logger.debug(
                                ` Rejected theme_selected_bg_color rgb(${r}, ${g}, ${b}) - ${validation.reason}`
                            );
                        }
                    }
                }
            } catch (e) {
                this._logger.info(` Error reading GTK CSS: ${e.message}`);
            }
        }

        // Priority 3 & 4: GNOME Shell CSS fallbacks
        const cssFile = Gio.File.new_for_path(`${sourcePath}/gnome-shell/gnome-shell.css`);

        if (!cssFile.query_exists(null)) {
            return null;
        }

        try {
            const { success, contents } = this._readCSSFileSync(cssFile);
            if (!success) return null;

            const cssText = new TextDecoder().decode(contents);

            // Priority 3: Try to match stage color
            // Example: stage { font-size: 10pt; color: #fdb4b4; }
            const stageMatch = cssText.match(/stage\s*\{[^}]*color:\s*#([0-9a-fA-F]{6})/);

            if (stageMatch) {
                const hex = stageMatch[1];
                let r = parseInt(hex.substring(0, 2), 16);
                let g = parseInt(hex.substring(2, 4), 16);
                let b = parseInt(hex.substring(4, 6), 16);

                // Check if this is a saturated color (not white/gray)
                const maxChannel = Math.max(r, g, b);
                const minChannel = Math.min(r, g, b);
                const saturation = maxChannel - minChannel;

                if (saturation > 50) {
                    // Enhance pastel colors for dark themes (use system color scheme)
                    const isDarkTheme = this._systemPrefersDark();
                    if (isDarkTheme) {
                        const enhanced = ThemeUtils.enhancePastelColor([r, g, b]);
                        [r, g, b] = enhanced;
                        this._logger.info(` Enhanced pastel accent for dark theme: rgb(${r}, ${g}, ${b})`);
                    }

                    this._logger.info(` Parsed accent from Shell stage color: rgb(${r}, ${g}, ${b})`);
                    return [r, g, b];
                }
            }

            // Priority 4 REMOVED: Don't fallback to random Shell colors
            // User expectation: "kad korisnik klikne grey, mora dobiti grey"
            // Wallpaper colors (panel/popup) are handled separately by colorPalette.js
        } catch (e) {
            this._logger.info(` Error parsing Shell CSS: ${e.message}`);
        }

        // No valid accent color found - return NULL
        // This respects neutral/grey theme choice (no forced colors)
        this._logger.info(` No valid accent color found in theme at ${sourcePath} (neutral/grey theme)`);
        return null;
    }

    /**
     * Get system color scheme preference
     * @returns {string} 'prefer-dark', 'prefer-light', or 'default'
     */
    _getSystemColorScheme() {
        try {
            const interfaceSettings = this._getInterfaceSettings();
            const scheme = interfaceSettings.get_string("color-scheme");
            this._logger.info(` System color-scheme: ${scheme}`);
            return scheme;
        } catch (e) {
            this._logger.info(` Error reading color-scheme (using default): ${e.message}`);
            return "default";
        }
    }

    /**
     * Determine if system prefers dark mode
     * Checks Quick Settings Dark/Light theme switch via gtk-theme suffix
     * @returns {boolean} True if dark mode preferred, false otherwise
     */
    _systemPrefersDark() {
        try {
            const interfaceSettings = this._getInterfaceSettings();

            // Primary: Check gtk-theme suffix (Zorin OS Quick Settings Dark/Light Theme)
            const gtkTheme = interfaceSettings.get_string("gtk-theme");

            if (gtkTheme.endsWith("-Dark")) {
                this._logger.info(` Dark mode detected (gtk-theme: ${gtkTheme})`);
                return true;
            } else if (gtkTheme.endsWith("-Light")) {
                this._logger.info(` Light mode detected (gtk-theme: ${gtkTheme})`);
                return false;
            }

            // Fallback: Use color-scheme (GNOME 42+ standard)
            const scheme = this._getSystemColorScheme();
            return scheme !== "prefer-light";
        } catch (e) {
            this._logger.info(` Error detecting system mode: ${e.message}, defaulting to dark`);
            return true;
        }
    }

    /**
     * Detect if theme is light or dark by analyzing panel background color
     * @param {string} sourcePath - Source theme path
     * @returns {boolean} True if theme is light, false if dark
     */
    _isLightTheme(sourcePath) {
        try {
            const cssPath = `${sourcePath}/gnome-shell/gnome-shell.css`;
            const cssFile = Gio.File.new_for_path(cssPath);

            if (!cssFile.query_exists(null)) {
                // No shell CSS - fallback to name detection
                const themeName = GLib.path_get_basename(sourcePath);
                return themeName.includes("-Light");
            }

            const { contents } = this._readCSSFileSync(cssFile);
            const cssText = new TextDecoder().decode(contents);

            // Find #panel background-color
            const panelMatch = cssText.match(
                /#panel\s*\{[^}]*background-color:\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
            );

            if (panelMatch) {
                const r = parseInt(panelMatch[1]);
                const g = parseInt(panelMatch[2]);
                const b = parseInt(panelMatch[3]);

                // Use HSP (perceived brightness) to determine if light or dark
                const brightness = ThemeUtils.getHSP(r, g, b);
                const isLight = brightness > 127;

                this._logger.info(
                    ` Theme brightness detected: ${brightness.toFixed(0)} (${isLight ? "Light" : "Dark"})`
                );
                return isLight;
            }

            // Fallback to name if CSS parsing fails
            const themeName = GLib.path_get_basename(sourcePath);
            return themeName.includes("-Light");
        } catch (e) {
            this._logger.info(` Error detecting theme brightness: ${e.message}`);
            // Fallback to name detection
            const themeName = GLib.path_get_basename(sourcePath);
            return themeName.includes("-Light");
        }
    }

    /**
     * Parse original panel background color from theme
     * @param {string} sourcePath - Source theme path
     * @returns {Array|null} [r, g, b] array or null if not found
     */
    _parseThemePanelColor(sourcePath) {
        try {
            const cssPath = `${sourcePath}/gnome-shell/gnome-shell.css`;
            const cssFile = Gio.File.new_for_path(cssPath);

            if (!cssFile.query_exists(null)) {
                return null;
            }

            const { contents } = this._readCSSFileSync(cssFile);
            const cssText = new TextDecoder().decode(contents);

            // Find #panel background-color
            const panelMatch = cssText.match(
                /#panel\s*\{[^}]*background-color:\s*rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
            );

            if (panelMatch) {
                const r = parseInt(panelMatch[1]);
                const g = parseInt(panelMatch[2]);
                const b = parseInt(panelMatch[3]);

                this._logger.info(` Detected theme panel color: rgb(${r}, ${g}, ${b})`);
                return [r, g, b];
            }

            return null;
        } catch (e) {
            this._logger.info(` Error parsing theme panel color: ${e.message}`);
            return null;
        }
    }

    /**
     * Detect and apply theme accent color to settings
     * Updates blur-border-color and blur-background with detected accent
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings object
     * @param {boolean} isLightTheme - Whether the theme is light or dark
     * @returns {boolean} True if accent color was detected and applied
     */
    detectAndApplyAccentColor(sourcePath, settings, isLightTheme = null) {
        try {
            this._logger.info(` Starting accent color detection for theme: ${sourcePath}`);
            const accentColor = this._getCachedAccentColor(sourcePath);

            // Use provided theme brightness or detect if not provided
            const themeIsLight = isLightTheme !== null ? isLightTheme : this._isLightTheme(sourcePath);

            // === BATCH SETTINGS MODE - Prevent callback storm ===
            // blur-border-color, blur-background, shadow-color → 3 callbacks
            // With delay/apply: 3 settings → 1 callback
            settings.delay();

            if (!accentColor) {
                this._logger.info(` No accent color detected (neutral/grayscale theme)`);

                // FALLBACK: Use panel color as base for shadow generation
                const panelColor = this._parseThemePanelColor(sourcePath);
                if (panelColor) {
                    const [pr, pg, pb] = panelColor;

                    // Generate shadow from panel color (darkened variant)
                    const shadowVariant = themeIsLight
                        ? ThemeUtils.colorShade([pr, pg, pb], 0.5) // 50% lighter for light theme
                        : ThemeUtils.colorShade([pr, pg, pb], -0.5); // 50% darker for dark theme
                    const shadowColor = ThemeUtils.rgbaToCss(...shadowVariant, 1.0);
                    settings.set_string("shadow-color", shadowColor);

                    this._logger.info(` Applied neutral shadow from panel color: ${shadowColor}`);
                } else {
                    // Ultimate fallback: use Constants default
                    const rgbValues = themeIsLight ? Constants.SHADOW_COLOR_RGB.light : Constants.SHADOW_COLOR_RGB.dark;
                    const defaultShadow = `rgba(${rgbValues.join(", ")}, 1.0)`;
                    settings.set_string("shadow-color", defaultShadow);
                    this._logger.info(` Applied default shadow color: ${defaultShadow}`);
                }

                // === APPLY BATCH SETTINGS - Even for fallback path ===
                settings.apply();

                return false; // No accent color applied
            }

            const [r, g, b] = accentColor;

            const borderAlpha = themeIsLight
                ? Constants.ACCENT_COLOR_ALPHA.border.lightTheme
                : Constants.ACCENT_COLOR_ALPHA.border.darkTheme;
            const bgAlpha = themeIsLight
                ? Constants.ACCENT_COLOR_ALPHA.background.lightTheme
                : Constants.ACCENT_COLOR_ALPHA.background.darkTheme;

            // Apply accent color to border (visible border uses accent color)
            const borderColor = `rgba(${r}, ${g}, ${b}, ${borderAlpha})`;
            settings.set_string("blur-border-color", borderColor);

            // Apply accent-based tint for blur-background (glossy effect)
            // Light theme: Slightly lighter accent for glossy tint
            // Dark theme: Slightly lighter accent for glossy tint (maintains theme accent hue)
            const bgTintVariant = themeIsLight
                ? ThemeUtils.colorShade([r, g, b], 0.15) // 15% lighter for light theme
                : ThemeUtils.colorShade([r, g, b], 0.15); // 15% lighter for dark theme (glossy)
            const blurTint = ThemeUtils.rgbaToCss(...bgTintVariant, bgAlpha);
            settings.set_string("blur-background", blurTint);

            // Apply shadow-color based on theme accent
            // Light theme: Heavily lightened accent (soft shadow)
            // Dark theme: Heavily darkened accent (deep shadow)
            const shadowVariant = themeIsLight
                ? ThemeUtils.colorShade([r, g, b], 0.85) // 85% lighter for light theme
                : ThemeUtils.colorShade([r, g, b], -0.85); // 85% darker for dark theme
            const shadowColor = ThemeUtils.rgbaToCss(...shadowVariant, 1.0);
            settings.set_string("shadow-color", shadowColor);

            this._logger.info(
                ` Applied theme colors (${
                    themeIsLight ? "light" : "dark"
                } theme): border=${borderColor} (accent), background=${blurTint} (accent tint +15%), shadow=${shadowColor} (accent variant)`
            );

            // === APPLY BATCH SETTINGS - Single callback ===
            settings.apply();
            return true;
        } catch (e) {
            this._logger.info(` Error applying accent color: ${e.message}`);
            return false;
        }
    }

    /**
     * Calculate blended color between tint and neutral based on strength percentage
     * @param {Array<number>} tintRgb - Original tint RGB [r, g, b]
     * @param {Array<number>} neutralRgb - Neutral target RGB [r, g, b]
     * @param {number} strength - Tint strength 0-100 (0=neutral, 100=full tint)
     * @returns {Array<number>} Blended RGB [r, g, b]
     */
    _blendTintColor(tintRgb, neutralRgb, strength) {
        // strength: 0% = neutral, 100% = original tint
        const factor = strength / 100.0;

        const r = Math.round(neutralRgb[0] + (tintRgb[0] - neutralRgb[0]) * factor);
        const g = Math.round(neutralRgb[1] + (tintRgb[1] - neutralRgb[1]) * factor);
        const b = Math.round(neutralRgb[2] + (tintRgb[2] - neutralRgb[2]) * factor);

        return [r, g, b];
    }

    /**
     * Generate gnome-shell.css with import + overrides
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {string} Generated CSS
     */
    /**
     * Generate base-theme.css - modified original CSS with tint removal and fixes
     * This is generated once per overlay creation and not modified on settings updates
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {string} Modified CSS content
     */
    _generateBaseThemeCss(sourcePath, settings) {
        const importPath = `${sourcePath}/gnome-shell/gnome-shell.css`;
        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        // Get theme info
        const sourceThemeName = settings.get_string("overlay-source-theme") || "Unknown";
        const isZorinTheme = sourceThemeName.toLowerCase().includes("zorin");
        const isLightTheme = this._isLightTheme(sourcePath);
        const enableZorinIntegration = settings.get_boolean("enable-zorin-integration");

        // === BASE THEME CACHE (TIER 1 OPTIMIZATION) ===
        // Create cache key from immutable parameters
        const tintStrength = settings.get_int("zorin-tint-strength") || 0;
        // Note: borderRadius removed from cache key (v2.5.1) - Quick Settings CSS moved to component cache
        const cacheKey = `shell-base:${sourceThemeName}:${tintStrength}:${enableZorinIntegration}`;

        // Check cache first
        if (this._baseThemeCache.has(cacheKey)) {
            this._baseThemeCacheStats.hits++;
            this._logger.debug(`  ✅ Shell base cache HIT: ${cacheKey}`);
            return this._baseThemeCache.get(cacheKey);
        }

        // Cache miss - generate CSS
        this._baseThemeCacheStats.misses++;
        this._logger.info(`  ❌ Shell base cache MISS - generating: ${cacheKey}`);

        this._logger.info(` Reading original CSS from ${importPath}`);

        // Read original CSS
        const cssFile = Gio.File.new_for_path(importPath);
        if (!cssFile.query_exists(null)) {
            this._logger.error(` Source CSS not found: ${importPath}`);
            return `/* ERROR: Source CSS not found */`;
        }

        const { success, contents } = this._readCSSFileSync(cssFile);
        if (!success) {
            this._logger.error(` Failed to read CSS from ${importPath}`);
            return `/* ERROR: Failed to read source CSS */`;
        }

        let cssText = new TextDecoder().decode(contents);
        this._logger.info(` Original CSS size: ${cssText.length} bytes`);

        // === ZORIN-SPECIFIC MODIFICATIONS ===

        if (isZorinTheme) {
            // Detect tint color from ORIGINAL stage definition (before we replace it)
            const stageColorMatch = cssText.match(/stage\s*\{[^}]*color:\s*#([0-9a-fA-F]{6})/);

            if (stageColorMatch) {
                const tintHex = stageColorMatch[1];
                const tintR = parseInt(tintHex.substring(0, 2), 16);
                const tintG = parseInt(tintHex.substring(2, 4), 16);
                const tintB = parseInt(tintHex.substring(4, 6), 16);

                this._logger.info(` Detected Zorin tint color: rgb(${tintR}, ${tintG}, ${tintB}) / #${tintHex}`);

                // Get tint strength setting (0-100%)
                const tintStrength = settings.get_int("zorin-tint-strength") || 0;
                this._logger.info(` Zorin tint strength: ${tintStrength}%`);

                // Calculate target color based on tint strength
                const neutralRgb = isLightTheme ? [50, 50, 50] : [200, 200, 200];
                const tintRgb = [tintR, tintG, tintB];
                const targetRgb = this._blendTintColor(tintRgb, neutralRgb, tintStrength);
                const targetRgbString = `${targetRgb[0]}, ${targetRgb[1]}, ${targetRgb[2]}`;
                const targetHex = targetRgb.map(c => c.toString(16).padStart(2, "0")).join("");

                this._logger.info(` Target color (${tintStrength}% blend): rgb(${targetRgbString}) / #${targetHex}`);

                // Replace ALL rgba(tintR, tintG, tintB, alpha) with target color
                const rgbaRegex = new RegExp(
                    `rgba?\\(\\s*${tintR}\\s*,\\s*${tintG}\\s*,\\s*${tintB}\\s*,\\s*([\\d.]+)\\s*\\)`,
                    "g"
                );
                const rgbaCount = (cssText.match(rgbaRegex) || []).length;
                cssText = cssText.replace(rgbaRegex, `rgba(${targetRgbString}, $1)`);

                // Replace ALL #tintHex with target hex color
                const hexRegex = new RegExp(`#${tintHex}`, "gi");
                const hexCount = (cssText.match(hexRegex) || []).length;
                cssText = cssText.replace(hexRegex, `#${targetHex}`);

                this._logger.info(` Replaced ${rgbaCount} rgba() + ${hexCount} hex tint colors`);
            }
        }

        // === UNIVERSAL MODIFICATIONS (all themes) ===

        // 1. Replace stage color with neutral (removes color tint effect)
        const neutralStageColor = isLightTheme
            ? Constants.NEUTRAL_STAGE_COLORS.light
            : Constants.NEUTRAL_STAGE_COLORS.dark;
        cssText = cssText.replace(/stage\s*\{([^}]*?)color:\s*[^;}]+;/g, `stage {$1color: ${neutralStageColor};`);
        this._logger.info(` Set neutral stage color: ${neutralStageColor}`);

        // Quick Settings CSS removed from base-theme (v2.5.1 fix)
        // Moved to component CSS for dynamic updates on border-radius change
        // See: _generateShellCss() line ~2230

        // === FLUENT-SPECIFIC MODIFICATIONS ===

        if (!isZorinTheme && enableZorinIntegration) {
            // Add titlebar CSS at the end for higher specificity (cached accent color)
            const accentColor = this._getCachedAccentColor(sourcePath);
            const accentRgb = accentColor ? `${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}` : "100, 100, 100";

            // Sprint 5.0: Fluent Theme titlebar fix (cached template method)
            const titlebarCss = this._cssTemplates.getShellFluentTitlebarFix(accentRgb, isLightTheme);

            // Sprint 5.1: Zorin Accent Color Gradient Fixes for Third-Party Themes
            const gradientFixCss = this._cssTemplates.getShellZorinGradientFixes(accentRgb);

            cssText += titlebarCss + gradientFixCss;
            this._logger.info(
                ` Added Fluent titlebar CSS + Zorin gradient fixes (${
                    titlebarCss.length + gradientFixCss.length
                } bytes)`
            );
        }

        // === RETURN MODIFIED CSS ===

        // Note: tintStrength already defined in cache key section
        const tintModification = isZorinTheme
            ? tintStrength === 0
                ? "Tint removed"
                : tintStrength === 100
                ? "Original tint preserved"
                : `Tint reduced to ${tintStrength}%`
            : "";

        const header = `/*
 * ${this.extensionName} Base Theme
 * Generated: ${timestamp}
 * Source: ${importPath}
 * Theme: ${sourceThemeName} (${isZorinTheme ? "Zorin" : "Other"}, ${isLightTheme ? "Light" : "Dark"})
 * Modifications: ${tintModification} ${
            !isZorinTheme && enableZorinIntegration ? "Titlebar fix" : ""
        } Stage color neutralized
 */

`;

        const result = header + cssText;

        // Cache the result for future use
        this._baseThemeCache.set(cacheKey, result);
        this._logger.info(`  💾 Cached shell base: ${(result.length / 1024).toFixed(1)}KB`);

        // Enforce LRU eviction if cache exceeds limit
        this._enforceCacheLRU(this._baseThemeCache, this._baseThemeCacheMaxSize, "base theme");

        this._logger.info(` Base theme CSS generated: ${cssText.length} bytes`);
        return result;
    }

    /**
     * Extract unified color settings for CSS generation
     * Centralizes panel/popup color logic to prevent duplication
     * @private
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {Object} Unified color settings with panel and popup information
     */
    _extractColorSettings(sourcePath, settings) {
        const panelOpacity = settings.get_double("panel-opacity") || Constants.DEFAULT_OPACITY.panel;
        const menuOpacity = settings.get_double("menu-opacity") || 0.9;
        const themePanelColor = this._parseThemePanelColor(sourcePath);

        // === PANEL COLOR - 3-tier system ===
        const panelOverride = settings.get_boolean("override-panel-color");
        let panelColor, panelSource;

        if (panelOverride) {
            // Tier 1: User explicit override - use RGB from setting but apply panel-opacity slider
            const panelOverrideColor = settings.get_string("choose-override-panel-color");
            const panelParsed = ThemeUtils.parseColor(panelOverrideColor);
            if (panelParsed) {
                // Apply panel-opacity slider to override color (RGB from setting, alpha from slider)
                panelColor = ThemeUtils.rgbaToCss(panelParsed.r, panelParsed.g, panelParsed.b, panelOpacity);
            } else {
                // Fallback if parsing fails
                panelColor = ThemeUtils.rgbaToCss(46, 52, 64, panelOpacity);
            }
            panelSource = "User Override";
        } else if (themePanelColor) {
            // Tier 2: Theme original color
            const [r, g, b] = themePanelColor;
            panelColor = ThemeUtils.rgbaToCss(r, g, b, panelOpacity);
            panelSource = "Theme Color";
        } else {
            // Tier 3: Fallback based on system preference
            const isDark = this._systemPrefersDark();
            panelColor = isDark
                ? ThemeUtils.rgbaToCss(46, 52, 64, panelOpacity)
                : ThemeUtils.rgbaToCss(255, 255, 255, panelOpacity);
            panelSource = "Fallback (System Preference)";
        }

        // === POPUP COLOR - inherit or override ===
        const popupOverride = settings.get_boolean("override-popup-color");
        let popupColor, popupSource;

        if (popupOverride) {
            // User explicit popup override - use RGB from setting but apply menu-opacity slider
            const popupOverrideColor = settings.get_string("choose-override-popup-color");
            const popupParsed = ThemeUtils.parseColor(popupOverrideColor);
            if (popupParsed) {
                // Apply menu-opacity slider to override color (RGB from setting, alpha from slider)
                popupColor = ThemeUtils.rgbaToCss(popupParsed.r, popupParsed.g, popupParsed.b, menuOpacity);
            } else {
                // Fallback if parsing fails
                popupColor = ThemeUtils.rgbaToCss(255, 255, 255, menuOpacity);
            }
            popupSource = "User Override";
        } else {
            // Inherit panel color but apply menu opacity
            const panelParsed = ThemeUtils.parseColor(panelColor);
            if (panelParsed) {
                popupColor = ThemeUtils.rgbaToCss(panelParsed.r, panelParsed.g, panelParsed.b, menuOpacity);
            } else {
                // Fallback if parsing fails
                popupColor = ThemeUtils.rgbaToCss(46, 52, 64, menuOpacity);
            }
            popupSource = "Inherited from Panel";
        }

        // === PARSE TO RGBA ARRAYS (backward compatibility) ===
        const panelRgba = ThemeUtils.convertColor(panelColor, "array") || [46, 52, 64, 0.8];
        const popupRgba = ThemeUtils.convertColor(popupColor, "array") || [255, 255, 255, 0.9];

        // === GENERATE DERIVED COLORS ===
        const panelHover = ThemeUtils.getAutoHighlightColor(panelRgba.slice(0, 3));
        const panelFg = ThemeUtils.getAutoFgColor(panelRgba.slice(0, 3));
        const popupHover = ThemeUtils.getAutoHighlightColor(popupRgba.slice(0, 3));
        const popupFg = ThemeUtils.getAutoFgColor(popupRgba.slice(0, 3));

        // === GENERATE CSS STRINGS FOR TEMPLATES ===
        const panelFgCss = ThemeUtils.rgbaToCss(...panelFg, 1.0);
        const panelHoverCss = ThemeUtils.rgbaToCss(...panelHover, panelRgba[3] || 1.0);
        const panelSolidCss = ThemeUtils.rgbaToCss(panelRgba[0], panelRgba[1], panelRgba[2], 1.0);
        const popupFgCss = ThemeUtils.rgbaToCss(...popupFg, 1.0);
        const popupHoverCss = ThemeUtils.rgbaToCss(...popupHover, popupRgba[3] || 1.0);

        return {
            panel: {
                color: panelColor,
                rgba: panelRgba,
                source: panelSource,
                override: panelOverride,
                opacity: panelOpacity,
                hover: panelHover,
                fg: panelFg,
                // Pre-generated CSS strings for templates
                fgCss: panelFgCss,
                hoverCss: panelHoverCss,
                solidCss: panelSolidCss
            },
            popup: {
                color: popupColor,
                rgba: popupRgba,
                source: popupSource,
                override: popupOverride,
                opacity: menuOpacity,
                hover: popupHover,
                fg: popupFg,
                // Pre-generated CSS strings for templates
                fgCss: popupFgCss,
                hoverCss: popupHoverCss
            },
            themePanelColor: themePanelColor
        };
    }

    /**
     * Extract common variables for Shell CSS generation
     * @private
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {Object} Variables object
     */
    _extractShellCssVars(sourcePath, settings, isLightTheme = null) {
        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        // Get settings (allow 0 for flat/borderless appearance)
        const borderRadius = settings.get_int("border-radius");
        const borderWidth = settings.get_int("blur-border-width");
        const applyPanelRadius = settings.get_boolean("apply-panel-radius");
        const enableZorinIntegration = settings.get_boolean("enable-zorin-integration");

        // Detect if this is a Zorin theme (check theme name)
        const sourceThemeName = settings.get_string("overlay-source-theme") || "Unknown";
        const isZorinTheme = sourceThemeName.toLowerCase().includes("zorin");

        // Parse theme accent color for blur effects and borders (cached for performance)
        const accentColor = this._getCachedAccentColor(sourcePath);
        const accentRgb = accentColor ? `${accentColor[0]}, ${accentColor[1]}, ${accentColor[2]}` : "253, 180, 180"; // Default to red-ish

        // Get blur-border-color from settings (can be overridden by color extraction)
        const borderColorStr = settings.get_string("blur-border-color");
        const borderColorMatch = borderColorStr.match(
            /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
        );
        const borderColor = borderColorMatch
            ? `rgba(${borderColorMatch[1]}, ${borderColorMatch[2]}, ${borderColorMatch[3]}, ${
                  borderColorMatch[4] || 1.0
              })`
            : `rgba(${accentRgb}, 0.3)`; // Fallback to theme accent

        // Generate hover color from accent using ThemeUtils
        const hoverColor = accentColor ? ThemeUtils.getAutoHighlightColor(accentColor, 0.15) : [38, 27, 27];
        const hoverRgb = `${hoverColor[0]}, ${hoverColor[1]}, ${hoverColor[2]}`;

        // === EXTRACT UNIFIED COLOR SETTINGS ===
        const colorSettings = this._extractColorSettings(sourcePath, settings);

        // Generate CSS strings from unified color settings
        const panelBackgroundCss = `background-color: ${colorSettings.panel.color} !important;\n    background-image: none !important;`;
        const popupBackgroundCss = `background-color: ${colorSettings.popup.color} !important;`;

        // Window Preview uses panel opacity (same transparency as taskbar)
        const previewPanelRgba = ThemeUtils.convertColor(colorSettings.panel.color, "array") || [46, 52, 64, 0.1];
        const previewBackgroundCss = `background-color: ${ThemeUtils.rgbaToCss(
            previewPanelRgba[0],
            previewPanelRgba[1],
            previewPanelRgba[2],
            colorSettings.panel.opacity
        )} !important;`;

        // Log color sources for debugging
        this._logger.info(` Shell Panel: ${colorSettings.panel.source}`);
        this._logger.info(` Shell Popup: ${colorSettings.popup.source}`);

        // Extract values for backward compatibility
        const panelOpacity = colorSettings.panel.opacity;
        const menuOpacity = colorSettings.popup.opacity;
        const themePanelColor = colorSettings.themePanelColor;
        const panelOverride = colorSettings.panel.override;
        const popupOverride = colorSettings.popup.override;

        // Parse blur settings from GSettings (user-controllable via Blur Effects page)
        const blurRadius = settings.get_int("blur-radius"); // Allow 0 (disable blur)
        const blurSaturate = settings.get_double("blur-saturate") || 0.95;
        const blurContrast = settings.get_double("blur-contrast") || 0.75;
        const blurBrightness = settings.get_double("blur-brightness") || 0.65;
        const blurOpacity = settings.get_double("blur-opacity") || 0.8;
        const shadowStrength = settings.get_double("shadow-strength") || 0.3; // Now controls shadow spread

        // Parse blur-background color (tint overlay - white for light theme, dark for dark theme)
        const blurBackgroundStr =
            settings.get_string("blur-background") || Constants.INITIALIZATION_DEFAULTS.blurBackground;
        const blurBgMatch = blurBackgroundStr.match(
            /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
        );
        const blurTintR = blurBgMatch ? parseInt(blurBgMatch[1]) : 0;
        const blurTintG = blurBgMatch ? parseInt(blurBgMatch[2]) : 0;
        const blurTintB = blurBgMatch ? parseInt(blurBgMatch[3]) : 0;
        const blurTintAlpha = blurBgMatch ? parseFloat(blurBgMatch[4]) || 0.3 : 0.3;

        // Generate backdrop-filter with user settings (applies to popups) - CACHED
        const backdropFilter = this._cssTemplates.getBackdropFilter(
            blurRadius,
            blurSaturate,
            blurContrast,
            blurBrightness
        );

        // Generate blur background tint overlay (subtle color overlay on blurred background)
        const blurBackgroundOverlay = `rgba(${blurTintR}, ${blurTintG}, ${blurTintB}, ${blurTintAlpha * blurOpacity})`;

        // Detect if source theme is light or dark for Zorin-specific adjustments
        const themeIsLight = isLightTheme !== null ? isLightTheme : this._isLightTheme(sourcePath);

        // Adjust tint/opacity based on theme brightness for Zorin themes
        const hoverOpacity = isZorinTheme
            ? themeIsLight
                ? Constants.ZORIN_HOVER_OPACITY.lightTheme
                : Constants.ZORIN_HOVER_OPACITY.darkTheme
            : Constants.ZORIN_HOVER_OPACITY.lightTheme; // Default fallback
        const activeOpacity = isZorinTheme
            ? themeIsLight
                ? Constants.ZORIN_ACTIVE_OPACITY.lightTheme
                : Constants.ZORIN_ACTIVE_OPACITY.darkTheme
            : Constants.ZORIN_ACTIVE_OPACITY.lightTheme; // Default fallback
        // Shadow color from settings (user controls color + alpha via color picker)
        // If not set or default, auto-detect based on theme brightness
        const shadowColorSetting = settings.get_string("shadow-color");
        const shadowColor =
            shadowColorSetting &&
            shadowColorSetting !== Constants.DEFAULT_SHADOW_COLORS.light &&
            shadowColorSetting !== Constants.DEFAULT_SHADOW_COLORS.dark
                ? shadowColorSetting
                : themeIsLight
                ? Constants.DEFAULT_SHADOW_COLORS.lightFallback
                : Constants.DEFAULT_SHADOW_COLORS.darkFallback; // Auto-detect fallback

        // Fixed blur values from constants (commit 94bb07e)
        const shadowPanelBlur = Constants.SHADOW_BLUR_VALUES.panel;
        const shadowPopupBlur = Constants.SHADOW_BLUR_VALUES.popup;
        const shadowButtonBlur = Constants.SHADOW_BLUR_VALUES.button;
        const shadowInsetBlur = Constants.SHADOW_BLUR_VALUES.inset;

        return {
            timestamp,
            borderRadius,
            borderWidth,
            panelOpacity,
            menuOpacity,
            applyPanelRadius,
            enableZorinIntegration,
            sourceThemeName,
            isZorinTheme,
            accentColor,
            accentRgb,
            borderColor,
            hoverColor,
            hoverRgb,
            themePanelColor,
            panelOverride,
            panelBackgroundCss,
            popupOverride,
            popupBackgroundCss,
            previewBackgroundCss,
            blurRadius,
            blurSaturate,
            blurContrast,
            blurBrightness,
            blurOpacity,
            blurTintR,
            blurTintG,
            blurTintB,
            blurTintAlpha,
            blurBackgroundOverlay,
            backdropFilter,
            isLightTheme,
            hoverOpacity,
            activeOpacity,
            shadowColor,
            shadowPanelBlur,
            shadowPopupBlur,
            shadowButtonBlur,
            shadowInsetBlur
        };
    }

    /**
     * Enforce LRU eviction on cache if size exceeds limit
     * @private
     * @param {Map} cache - Cache Map to enforce limit on
     * @param {number} maxSize - Maximum allowed cache size
     * @param {string} cacheName - Cache name for logging (e.g., "component CSS", "base theme")
     */
    _enforceCacheLRU(cache, maxSize, cacheName) {
        if (cache.size > maxSize) {
            // LRU eviction: Map maintains insertion order, first key = oldest
            const firstKey = cache.keys().next().value;
            const evictedValue = cache.get(firstKey);
            cache.delete(firstKey);

            // Log eviction with size info if value is string (CSS content)
            if (typeof evictedValue === "string") {
                this._logger.debug(
                    `  🗑️  Evicted oldest ${cacheName}: ${firstKey} (${(evictedValue.length / 1024).toFixed(1)}KB)`
                );
            } else {
                this._logger.debug(`  🗑️  Evicted oldest ${cacheName}: ${firstKey}`);
            }
        }
    }

    /**
     * Create cache key for component CSS
     * Hash only relevant variables for each component type
     * @private
     * @param {string} componentName - Component name (panel, popup, zorin, fluent)
     * @param {Object} vars - Variables object from _extractShellCssVars
     * @returns {string} Cache key
     */
    _createComponentCacheKey(componentName, vars) {
        // Define relevant variables per component
        const relevantVars = {
            panel: [
                vars.borderRadius,
                vars.borderWidth,
                vars.applyPanelRadius,
                vars.enableZorinIntegration,
                vars.isZorinTheme,
                vars.isLightTheme,
                vars.panelBackgroundCss,
                vars.backdropFilter,
                vars.shadowColor,
                vars.borderColor,
                vars.hoverRgb,
                vars.hoverOpacity,
                vars.activeOpacity
            ],
            popup: [
                vars.borderRadius,
                vars.borderWidth,
                vars.popupBackgroundCss,
                vars.backdropFilter,
                vars.blurBackgroundOverlay,
                vars.shadowColor,
                vars.previewBackgroundCss,
                vars.enableZorinIntegration
            ],
            zorin: [
                vars.borderRadius,
                vars.sourceThemeName,
                vars.enableZorinIntegration,
                vars.isZorinTheme,
                vars.accentRgb,
                vars.hoverRgb,
                vars.activeOpacity
            ],
            fluent: [
                vars.sourceThemeName,
                vars.isZorinTheme,
                vars.enableZorinIntegration,
                vars.borderRadius,
                vars.accentRgb
            ]
        };

        const varsToHash = relevantVars[componentName] || [];
        const hashInput = JSON.stringify(varsToHash);

        // Simple hash function (djb2)
        let hash = 5381;
        for (let i = 0; i < hashInput.length; i++) {
            hash = (hash << 5) + hash + hashInput.charCodeAt(i);
        }

        return `${componentName}:${hash >>> 0}`; // Convert to unsigned 32-bit int
    }

    /**
     * Generate panel-specific CSS
     * REFACTORED: CSS template generation moved to cssTemplates.js
     * This method now handles only cache logic
     * @private
     * @param {Object} vars - Variables object from _extractShellCssVars
     * @returns {string} Panel CSS
     */
    _generatePanelCss(vars) {
        // === COMPONENT CSS CACHE (TIER 2 OPTIMIZATION) ===
        const cacheKey = this._createComponentCacheKey("panel", vars);

        // Check cache first
        if (this._componentCssCache.has(cacheKey)) {
            this._componentCacheStats.hits++;
            this._logger.debug(`  ✅ Panel CSS cache HIT: ${cacheKey}`);
            return this._componentCssCache.get(cacheKey);
        }

        // Cache miss - generate CSS using cssTemplates
        this._componentCacheStats.misses++;
        this._logger.debug(`  ❌ Panel CSS cache MISS: ${cacheKey}`);

        // Delegate CSS generation to cssTemplates (separation of concerns)
        const css = this._cssTemplates.getPanelCss(vars);

        // Cache the result
        this._componentCssCache.set(cacheKey, css);
        this._logger.debug(`  💾 Cached panel CSS: ${(css.length / 1024).toFixed(1)}KB`);

        // Enforce LRU eviction if cache exceeds limit
        this._enforceCacheLRU(this._componentCssCache, this._componentCacheMaxSize, "component CSS");

        return css;
    }

    /**
     * Generate popup/menu-specific CSS
     * REFACTORED: CSS template generation moved to cssTemplates.js
     * This method now handles only cache logic
     * @private
     * @param {Object} vars - Variables object from _extractShellCssVars
     * @returns {string} Popup/menu CSS
     */
    _generatePopupCss(vars) {
        // === COMPONENT CSS CACHE (TIER 2 OPTIMIZATION) ===
        const cacheKey = this._createComponentCacheKey("popup", vars);

        if (this._componentCssCache.has(cacheKey)) {
            this._componentCacheStats.hits++;
            this._logger.debug(`  ✅ Popup CSS cache HIT: ${cacheKey}`);
            return this._componentCssCache.get(cacheKey);
        }

        this._componentCacheStats.misses++;
        this._logger.debug(`  ❌ Popup CSS cache MISS: ${cacheKey}`);

        // Delegate CSS generation to cssTemplates (separation of concerns)
        const css = this._cssTemplates.getPopupCss(vars);

        // Cache the generated CSS
        this._componentCssCache.set(cacheKey, css);
        this._logger.debug(`  💾 Cached popup CSS: ${(css.length / 1024).toFixed(1)}KB`);

        // Enforce LRU eviction if cache exceeds limit
        this._enforceCacheLRU(this._componentCssCache, this._componentCacheMaxSize, "component CSS");

        return css;
    }

    /**
     * Generate Zorin-specific CSS enhancements
     * REFACTORED: CSS template generation moved to cssTemplates.js
     * @private
     * @param {Object} vars - Variables object from _extractShellCssVars
     * @returns {string} Zorin-specific CSS
     */
    _generateZorinCss(vars) {
        // Delegate to cssTemplates (simple pass-through, no caching needed for small CSS)
        return this._cssTemplates.getZorinCss(vars);
    }

    /**
     * Assemble final Shell CSS from components
     * REFACTORED: CSS assembly moved to cssTemplates.js
     * @private
     * @param {Object} vars - Variables object from _extractShellCssVars
     * @param {string} panelCss - Panel CSS from _generatePanelCss
     * @param {string} popupCss - Popup CSS from _generatePopupCss
     * @param {string} zorinCss - Zorin CSS from _generateZorinCss
     * @returns {string} Complete Shell CSS
     */
    _assembleShellCss(vars, panelCss, popupCss, zorinCss) {
        // Delegate to cssTemplates for final assembly
        return this._cssTemplates.assembleShellCss(vars, panelCss, popupCss, zorinCss, this.extensionName);
    }

    /**
     * Generate gnome-shell.css with import + overrides
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {string} CSS content
     */
    _generateShellCss(sourcePath, settings, isLightTheme = null) {
        // Extract common variables
        const vars = this._extractShellCssVars(sourcePath, settings, isLightTheme);
        const panelCss = this._generatePanelCss(vars);
        const popupCss = this._generatePopupCss(vars);
        const zorinCss = this._generateZorinCss(vars);

        // Assemble base CSS
        let shellCss = this._assembleShellCss(vars, panelCss, popupCss, zorinCss);

        // === QUICK SETTINGS BORDER-RADIUS SYNC (v2.5.1) ===
        // Append Quick Settings CSS OUTSIDE base-theme cache for dynamic updates
        // This ensures border-radius changes in prefs.js immediately reflect in UI
        const borderRadius = settings.get_int("border-radius");
        const quickSettingsCss = this._cssTemplates.getShellQuickSettingsCss(borderRadius);
        shellCss += "\n" + quickSettingsCss;
        this._logger.debug(`  Added Quick Settings border-radius sync: ${borderRadius}px`);

        return shellCss;
    }

    /**
     * Generate pad-osd.css with import + overrides
     * REFACTORED: CSS template generation moved to cssTemplates.js
     * @param {string} sourcePath - Source theme path
     * @param {Object} settings - Extension settings
     * @returns {string} Generated CSS
     */
    _generatePadOsdCss(sourcePath, settings) {
        const borderRadius = settings.get_int("border-radius"); // Allow 0 (flat corners)

        // Delegate CSS generation to cssTemplates (separation of concerns)
        return this._cssTemplates.getPadOsdCss(this.extensionName, sourcePath, borderRadius);
    }

    // ===== METADATA MANAGEMENT =====

    /**
     * Parse source theme's index.theme to extract icon theme
     * @param {string} sourcePath - Source theme path
     * @returns {string} Icon theme name or 'Adwaita' as fallback
     */
    _parseSourceIconTheme(sourcePath) {
        const indexThemePath = `${sourcePath}/index.theme`;
        const file = Gio.File.new_for_path(indexThemePath);

        if (!file.query_exists(null)) {
            this._logger.info(` Source theme has no index.theme, using Adwaita icons`);
            return "Adwaita";
        }

        try {
            const { success, contents } = this._readCSSFileSync(file);
            if (!success) return "Adwaita";

            const text = new TextDecoder().decode(contents);
            const match = text.match(/IconTheme\s*=\s*(.+)/);

            if (match) {
                const iconTheme = match[1].trim();
                this._logger.info(` Detected source icon theme: ${iconTheme}`);
                return iconTheme;
            }

            return "Adwaita";
        } catch (e) {
            logError(e, `[${this.extensionName}] Error parsing source index.theme`);
            return "Adwaita";
        }
    }

    /**
     * Detect border-radius from theme CSS files
     * Searches GNOME Shell and GTK CSS for common border-radius patterns
     * @param {string} themeName - Name of the theme to analyze
     * @returns {number|null} Detected border-radius in pixels or null if not found
     */
    detectThemeBorderRadius(themeName) {
        const sourcePath = this.discoverSourceTheme(themeName);
        if (!sourcePath) {
            this._logger.info(`Cannot detect border-radius: theme ${themeName} not found`);
            return null;
        }

        const radiusValues = [];
        const cssFiles = [
            `${sourcePath}/gnome-shell/gnome-shell.css`,
            `${sourcePath}/gtk-3.0/gtk.css`,
            `${sourcePath}/gtk-4.0/gtk.css`
        ];

        // Regex patterns for border-radius detection (prioritize common UI elements)
        const patterns = [
            /\.popup-menu[^{]*{[^}]*border-radius:\s*(\d+)px/i,
            /\.panel[^{]*{[^}]*border-radius:\s*(\d+)px/i,
            /\.button[^{]*{[^}]*border-radius:\s*(\d+)px/i,
            /border-radius:\s*(\d+)px/gi // Generic fallback
        ];

        for (const cssPath of cssFiles) {
            const file = Gio.File.new_for_path(cssPath);
            if (!file.query_exists(null)) continue;

            try {
                const { success, contents } = this._readCSSFileSync(file);
                if (!success) continue;

                const cssText = new TextDecoder().decode(contents);

                // Try priority patterns first (popup-menu, panel, button)
                for (let i = 0; i < patterns.length - 1; i++) {
                    const matches = cssText.match(patterns[i]);
                    if (matches && matches[1]) {
                        const radius = parseInt(matches[1]);
                        if (radius >= 0 && radius <= 50) {
                            // Sanity check
                            this._logger.info(`Detected border-radius ${radius}px from ${cssPath} (priority pattern)`);
                            return radius;
                        }
                    }
                }

                // Fallback: collect all border-radius values
                let match;
                const genericPattern = patterns[patterns.length - 1];
                while ((match = genericPattern.exec(cssText)) !== null) {
                    const radius = parseInt(match[1]);
                    if (radius >= 0 && radius <= 50) {
                        radiusValues.push(radius);
                    }
                }
            } catch (e) {
                this._logger.debug(`Error reading ${cssPath}: ${e.message}`);
            }
        }

        // If no priority matches, find most common radius value
        if (radiusValues.length > 0) {
            const frequency = {};
            let maxCount = 0;
            let mostCommon = radiusValues[0];

            radiusValues.forEach(val => {
                frequency[val] = (frequency[val] || 0) + 1;
                if (frequency[val] > maxCount) {
                    maxCount = frequency[val];
                    mostCommon = val;
                }
            });

            this._logger.info(
                `Detected border-radius ${mostCommon}px (most common from ${radiusValues.length} values)`
            );
            return mostCommon;
        }

        this._logger.info(`No border-radius detected in theme ${themeName}`);
        return null;
    }

    /**
     * Write index.theme metadata file
     * @param {Object} config - Configuration object
     * @param {string} config.sourceThemeName - Source theme name
     * @param {string} config.sourcePath - Source theme path
     * @param {Object} config.gtkVersions - GTK versions info
     * @param {string} [config.originalGtkTheme=''] - Original GTK theme to restore
     * @param {string} [config.originalShellTheme=''] - Original Shell theme to restore
     * @param {string} [config.originalIconTheme=''] - Original icon theme to restore
     */
    _writeIndexTheme(config) {
        const {
            sourceThemeName,
            sourcePath,
            gtkVersions,
            originalGtkTheme = "",
            originalShellTheme = "",
            originalIconTheme = "",
            sourceIconTheme = null
        } = config;

        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        const hasGtk3 = gtkVersions["gtk-3.0"]?.exists || false;
        const hasGtk4 = gtkVersions["gtk-4.0"]?.exists || false;
        const hasDarkVariant = gtkVersions["gtk-3.0"]?.hasDarkCss || gtkVersions["gtk-4.0"]?.hasDarkCss || false;

        // Use provided source icon theme or parse from source theme
        const iconTheme = sourceIconTheme || this._parseSourceIconTheme(sourcePath);

        const content = `[Desktop Entry]
Type=X-GNOME-Metatheme
Name=${this.extensionName} Dynamic Theme
Comment=Auto-generated overlay theme by ${this.extensionName} extension
Encoding=UTF-8

[X-GNOME-Metatheme]
GtkTheme=${this.overlayName}
MetacityTheme=${sourceThemeName}
IconTheme=${iconTheme}
CursorTheme=Adwaita
ButtonLayout=close,minimize,maximize:

[X-${this.extensionName}-Extension]
Version=1.0
SourceTheme=${sourceThemeName}
SourceThemePath=${sourcePath}
CreatedDate=${timestamp}
LastModified=${timestamp}
AutoRestore=true
SupportsColorScheme=true
HasDarkVariant=${hasDarkVariant}
HasGtk3=${hasGtk3}
HasGtk4=${hasGtk4}
OriginalGtkTheme=${originalGtkTheme}
OriginalShellTheme=${originalShellTheme}
OriginalIconTheme=${originalIconTheme}
`;

        this._writeFile(this.metadataFile, content);
    }

    /**
     * Read and parse index.theme metadata
     * @returns {Object|null} Parsed metadata or null
     */
    readIndexTheme() {
        const file = Gio.File.new_for_path(this.metadataFile);

        if (!file.query_exists(null)) {
            return null;
        }

        try {
            const { success, contents } = this._readCSSFileSync(file);
            if (!success) return null;

            const text = new TextDecoder().decode(contents);
            const metadata = {};

            // Parse INI-style file
            const lines = text.split("\n");
            let currentSection = null;

            lines.forEach(line => {
                line = line.trim();

                // Section header
                if (line.match(/^\[.*\]$/)) {
                    currentSection = line.slice(1, -1);
                    metadata[currentSection] = {};
                    return;
                }

                // Key=Value pairs
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match && currentSection) {
                    const key = match[1].trim();
                    const value = match[2].trim();
                    metadata[currentSection][key] = value;
                }
            });

            return metadata;
        } catch (e) {
            this._logger.info(` Error reading metadata: ${e}`);
            return null;
        }
    }

    /**
     * Update LastModified timestamp in metadata
     */
    updateLastModified() {
        const metadata = this.readIndexTheme();
        if (!metadata) return;

        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        // Update timestamp in extension section
        if (metadata[`X-${this.extensionName}-Extension`]) {
            metadata[`X-${this.extensionName}-Extension`].LastModified = timestamp;
        }

        // Rebuild file content
        let content = "";
        Object.keys(metadata).forEach(section => {
            content += `[${section}]\n`;
            Object.keys(metadata[section]).forEach(key => {
                content += `${key}=${metadata[section][key]}\n`;
            });
            content += "\n";
        });

        this._writeFile(this.metadataFile, content);
    }

    /**
     * Write README.md for user info
     * @param {string} sourceThemeName - Source theme name
     */
    _writeReadme(sourceThemeName) {
        const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

        const content = `# ${this.extensionName} Overlay Theme

**⚠️ AUTO-GENERATED - DO NOT EDIT MANUALLY**

This theme is automatically managed by the ${this.extensionName} GNOME Shell extension.

## Information

- **Created:** ${timestamp}
- **Source Theme:** ${sourceThemeName}
- **Overlay Name:** ${this.overlayName}

## Structure

- **GTK Directories:** Custom CSS with @import of source theme
- **Other Directories:** Symlinked to source theme
- **Metadata:** Stored in index.theme

## Notes

- This theme overlays **${sourceThemeName}** without modifying it
- Changes to extension settings update CSS automatically
- Deleting this directory is safe - it will be regenerated

## Managed by

${this.extensionName} GNOME Shell Extension
`;

        this._writeFile(`${this.overlayPath}/README.md`, content);
    }

    // ===== FILE SYSTEM UTILITIES =====

    /**
     * Create directory with parents
     * @param {string} path - Directory path
     * @returns {boolean} True if successful, false on error
     */
    _createDirectory(path) {
        try {
            GLib.mkdir_with_parents(path, parseInt("0755", 8));
            return true;
        } catch (e) {
            this._logger.error(`Failed to create directory ${path}: ${e.message}`);
            return false;
        }
    }

    /**
     * Write text file
     * @param {string} path - File path
     * @param {string} content - File content
     * @returns {boolean} True if successful, false on error
     */
    _writeFile(path, content) {
        try {
            const file = Gio.File.new_for_path(path);
            const bytes = new TextEncoder().encode(content);

            file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            return true;
        } catch (e) {
            this._logger.error(`Failed to write file ${path}: ${e.message}`);
            return false;
        }
    }

    /**
     * Create symbolic link
     * @param {string} target - Target path (what to link to)
     * @param {string} linkPath - Link path (where to create link)
     */
    _createSymlink(target, linkPath) {
        try {
            // Remove existing link/file if exists
            const linkFile = Gio.File.new_for_path(linkPath);
            if (linkFile.query_exists(null)) {
                linkFile.delete(null);
            }

            // Create symlink using Gio.File API (no subprocess)
            linkFile.make_symbolic_link(target, null);
        } catch (e) {
            this._logger.info(` Error creating symlink: ${e.message}`);
        }
    }

    /**
     * Remove overlay theme directory
     * @returns {boolean} Success status
     */
    removeOverlayTheme() {
        const overlayDir = Gio.File.new_for_path(this.overlayPath);

        if (!overlayDir.query_exists(null)) {
            this._logger.info(` Overlay theme does not exist`);
            return true;
        }

        try {
            // Recursive delete using Gio.File API (no subprocess)
            this._deleteRecursive(overlayDir);
            this._logger.info(` Overlay theme removed`);
            return true;
        } catch (e) {
            this._logger.info(` Error removing overlay: ${e.message}`);
            return false;
        }
    }

    /**
     * Check if overlay theme exists
     * @returns {boolean} True if overlay exists
     */
    overlayExists() {
        const overlayDir = Gio.File.new_for_path(this.overlayPath);
        return overlayDir.query_exists(null);
    }

    /**
     * Check if overlay needs recreation due to source theme change
     * Compares current source theme setting with the one stored in index.theme
     * @param {Object} extensionSettings - Extension settings object
     * @returns {boolean} True if overlay needs recreation
     */
    needsRecreation(extensionSettings) {
        if (!this.overlayExists()) {
            return true; // Needs creation
        }

        const metadata = this.readIndexTheme();
        if (!metadata || !metadata[`X-${this.extensionName}-Extension`]) {
            this._logger.warn(" Overlay exists but metadata missing - needs recreation");
            return true;
        }

        const storedSourceTheme = metadata[`X-${this.extensionName}-Extension`].SourceTheme;
        const currentSourceTheme = extensionSettings.get_string("overlay-source-theme");

        if (storedSourceTheme !== currentSourceTheme) {
            this._logger.info(` Source theme changed: ${storedSourceTheme} → ${currentSourceTheme} - needs recreation`);
            return true;
        }

        return false; // Overlay is up-to-date
    }

    // ===== LOGGING =====

    /**
     * Log info about overlay theme
     */
    logOverlayInfo() {
        if (!this.overlayExists()) {
            this._logger.info(` No overlay theme exists`);
            return;
        }

        const metadata = this.readIndexTheme();
        if (!metadata) {
            this._logger.info(` Overlay exists but no metadata found`);
            return;
        }

        const extData = metadata[`X-${this.extensionName}-Extension`];
        if (extData) {
            this._logger.info(` Overlay Info:`);
            this._logger.info(`  Source: ${extData.SourceTheme}`);
            this._logger.info(`  Created: ${extData.CreatedDate}`);
            this._logger.info(`  Modified: ${extData.LastModified}`);
            this._logger.info(`  GTK3: ${extData.HasGtk3}, GTK4: ${extData.HasGtk4}`);
            this._logger.info(`  Dark Variant: ${extData.HasDarkVariant}`);
        }
    }

    // ===== THEME ACTIVATION =====

    /**
     * Get current GTK theme from gsettings
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings
     * @returns {string} Current theme name
     */
    getCurrentTheme(interfaceSettings) {
        return interfaceSettings.get_string("gtk-theme");
    }

    /**
     * Activate overlay theme
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings
     * @param {Object} extensionSettings - Extension settings object
     * @returns {boolean} Success status
     */
    activateOverlay(interfaceSettings, extensionSettings) {
        if (!this.overlayExists()) {
            this._logger.info(` Cannot activate - overlay does not exist`);
            return false;
        }

        // Read original themes from index.theme metadata
        const metadata = this.readIndexTheme();
        let originalGtkTheme = "";
        let originalShellTheme = "";

        if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
            originalGtkTheme = metadata[`X-${this.extensionName}-Extension`].OriginalGtkTheme || "";
            originalShellTheme = metadata[`X-${this.extensionName}-Extension`].OriginalShellTheme || "";
            this._logger.info(` Read from index.theme - GTK: ${originalGtkTheme}, Shell: ${originalShellTheme}`);
        }

        // Fallback: get current themes if not in metadata
        const currentGtkTheme = this.getCurrentTheme(interfaceSettings);
        if (!originalGtkTheme || currentGtkTheme !== this.overlayName) {
            originalGtkTheme = currentGtkTheme;
        }

        // Set Shell theme
        try {
            const shellThemeSettings = new Gio.Settings({
                schema: "org.gnome.shell.extensions.user-theme"
            });
            const currentShellTheme = shellThemeSettings.get_string("name");

            if (!originalShellTheme || currentShellTheme !== this.overlayName) {
                originalShellTheme = currentShellTheme;
            }

            shellThemeSettings.set_string("name", this.overlayName);
            this._logger.info(` Shell theme set to: ${this.overlayName}`);
        } catch (e) {
            this._logger.info(` Note: user-theme extension not available, Shell theme not changed: ${e}`);
        }

        // Set icon theme from source theme's index.theme
        if (metadata && metadata["X-GNOME-Metatheme"]) {
            const sourceIconTheme = metadata["X-GNOME-Metatheme"].IconTheme;
            if (sourceIconTheme && sourceIconTheme !== "Adwaita") {
                const currentIconTheme = interfaceSettings.get_string("icon-theme");
                this._logger.info(` Setting icon theme: ${currentIconTheme} → ${sourceIconTheme}`);
                interfaceSettings.set_string("icon-theme", sourceIconTheme);
            }
        }

        // Switch to overlay (GTK theme)
        interfaceSettings.set_string("gtk-theme", this.overlayName);
        this._logger.info(` Overlay theme activated`);

        return true;
    }

    /**
     * Restore original theme
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings
     * @param {Object} extensionSettings - Extension settings object
     * @returns {boolean} Success status
     */
    restoreOriginalTheme(interfaceSettings, extensionSettings) {
        const currentTheme = this.getCurrentTheme(interfaceSettings);

        // Only restore if currently using overlay
        if (currentTheme !== this.overlayName) {
            this._logger.info(` Not using overlay, no need to restore`);
            return true;
        }

        // Read original themes from index.theme metadata
        const metadata = this.readIndexTheme();
        let originalGtkTheme = "Adwaita"; // Fallback
        let originalShellTheme = "Adwaita"; // Fallback
        let originalIconTheme = "Adwaita"; // Fallback

        if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
            originalGtkTheme = metadata[`X-${this.extensionName}-Extension`].OriginalGtkTheme || "Adwaita";
            originalShellTheme = metadata[`X-${this.extensionName}-Extension`].OriginalShellTheme || "Adwaita";
            originalIconTheme = metadata[`X-${this.extensionName}-Extension`].OriginalIconTheme || "Adwaita";
            this._logger.info(
                ` Read from index.theme - GTK: ${originalGtkTheme}, Shell: ${originalShellTheme}, Icon: ${originalIconTheme}`
            );
        }

        this._logger.info(` Restoring original theme: ${originalGtkTheme}`);
        interfaceSettings.set_string("gtk-theme", originalGtkTheme);

        // Restore icon theme
        this._logger.info(` Restoring original icon theme: ${originalIconTheme}`);
        interfaceSettings.set_string("icon-theme", originalIconTheme);

        // Restore Shell theme
        try {
            const shellThemeSettings = new Gio.Settings({
                schema: "org.gnome.shell.extensions.user-theme"
            });

            this._logger.info(` Restoring original Shell theme: ${originalShellTheme}`);
            shellThemeSettings.set_string("name", originalShellTheme);
        } catch (e) {
            this._logger.info(` Note: user-theme extension not available: ${e}`);
        }

        return true;
    }

    /**
     * Refresh theme by quick switch (forces GTK reload)
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings
     */
    /**
     * Refresh theme by temporarily switching to source theme and back
     * This forces GTK to reload the overlay CSS without flashing light theme
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings
     */
    refreshTheme(interfaceSettings) {
        const currentTheme = this.getCurrentTheme(interfaceSettings);

        this._logger.info(` Refreshing theme: ${currentTheme}`);

        // Get source theme from metadata to avoid light theme flash
        const metadata = this.readIndexTheme();
        let switchTheme = "Adwaita"; // Fallback

        if (metadata && metadata[`X-${this.extensionName}-Extension`]) {
            const extData = metadata[`X-${this.extensionName}-Extension`];
            switchTheme = extData.SourceTheme || "Adwaita";
            this._logger.info(` Using source theme for refresh: ${switchTheme}`);
        }

        // Quick switch to source theme (or Adwaita fallback) to force reload
        interfaceSettings.set_string("gtk-theme", switchTheme);

        const timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            interfaceSettings.set_string("gtk-theme", currentTheme);
            this._logger.info(` Theme refreshed`);
            // Remove from tracking when completed
            const idx = this._pendingTimers.indexOf(timerId);
            if (idx > -1) this._pendingTimers.splice(idx, 1);
            return GLib.SOURCE_REMOVE;
        });
        this._pendingTimers.push(timerId);
    }

    // ===== THEME UPDATES =====

    /**
     * Update overlay theme CSS without recreating structure
     * @param {Object} settings - Extension settings object
     * @param {boolean} detectAccentColor - If true, re-detect and apply accent color from theme
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings (optional, for updating icon theme)
     * @returns {boolean} Success status
     */
    updateOverlayCss(settings, detectAccentColor = false, interfaceSettings = null) {
        this._logger.debug("updateOverlayCss called - starting overlay CSS update");
        if (!this.overlayExists()) {
            this._logger.error(` Cannot update CSS - overlay does not exist at ${this.overlayPath}`);
            return false;
        }

        const metadata = this.readIndexTheme();
        if (!metadata || !metadata[`X-${this.extensionName}-Extension`]) {
            this._logger.error(` Cannot update CSS - no metadata found`);
            return false;
        }

        const extData = metadata[`X-${this.extensionName}-Extension`];
        const sourceThemeName = extData.SourceTheme;
        const sourcePath = this.discoverSourceTheme(sourceThemeName);

        // Preserve original themes from metadata
        const originalGtkTheme = extData.OriginalGtkTheme || "";
        const originalShellTheme = extData.OriginalShellTheme || "";
        const originalIconTheme = extData.OriginalIconTheme || "Adwaita";

        if (!sourcePath) {
            this._logger.error(` Cannot update CSS - source theme '${sourceThemeName}' not found`);
            return false;
        }

        this._logger.info(` Updating overlay CSS from '${sourceThemeName}'`);

        try {
            const gtkVersions = this.detectGtkVersions(sourcePath);
            const shellTheme = this.detectShellTheme(sourcePath);

            // Parse icon theme once for both index.theme and system settings
            const sourceIconTheme = this._parseSourceIconTheme(sourcePath);

            // Detect theme brightness once for all CSS generation functions
            const isLightTheme = this._isLightTheme(sourcePath);

            // Only detect and apply accent color if explicitly requested (e.g., on recreate or source theme change)
            if (detectAccentColor) {
                this._logger.info(` Re-detecting accent color from theme`);
                this.detectAndApplyAccentColor(sourcePath, settings, isLightTheme);
            } else {
                this._logger.info(` Preserving user-configured accent colors`);
            }

            // Regenerate GTK CSS files
            Object.keys(gtkVersions).forEach(version => {
                if (gtkVersions[version].exists) {
                    this._updateGtkCss(version, sourcePath, gtkVersions[version], settings, isLightTheme);
                }
            });

            // Regenerate Shell CSS files
            if (shellTheme.exists) {
                this._updateShellCss(sourcePath, shellTheme, settings, isLightTheme);
            }

            // Update metadata preserving original themes
            this._writeIndexTheme({
                sourceThemeName,
                sourcePath,
                gtkVersions,
                originalGtkTheme,
                originalShellTheme,
                originalIconTheme,
                sourceIconTheme
            });

            // Update icon theme if interfaceSettings provided and source icon theme changed
            if (interfaceSettings) {
                const currentIconTheme = interfaceSettings.get_string("icon-theme");

                if (sourceIconTheme && sourceIconTheme !== "Adwaita" && sourceIconTheme !== currentIconTheme) {
                    this._logger.info(` Updating icon theme: ${currentIconTheme} → ${sourceIconTheme}`);
                    interfaceSettings.set_string("icon-theme", sourceIconTheme);
                }
            }

            this._logger.info(` Overlay CSS updated successfully`);

            // Log cache statistics
            const hitRate =
                this._baseThemeCacheStats.hits + this._baseThemeCacheStats.misses > 0
                    ? (
                          (this._baseThemeCacheStats.hits /
                              (this._baseThemeCacheStats.hits + this._baseThemeCacheStats.misses)) *
                          100
                      ).toFixed(1)
                    : 0;
            this._logger.info(
                `📊 Base Theme Cache Stats: ${this._baseThemeCacheStats.hits} hits, ${this._baseThemeCacheStats.misses} misses (${hitRate}% hit rate)`
            );

            // Log component cache statistics
            const componentHitRate =
                this._componentCacheStats.hits + this._componentCacheStats.misses > 0
                    ? (
                          (this._componentCacheStats.hits /
                              (this._componentCacheStats.hits + this._componentCacheStats.misses)) *
                          100
                      ).toFixed(1)
                    : 0;
            this._logger.info(
                `📊 Component Cache Stats: ${this._componentCacheStats.hits} hits, ${this._componentCacheStats.misses} misses (${componentHitRate}% hit rate)`
            );

            // Log accent color cache statistics
            const accentHitRate =
                this._accentCacheStats.hits + this._accentCacheStats.misses > 0
                    ? (
                          (this._accentCacheStats.hits /
                              (this._accentCacheStats.hits + this._accentCacheStats.misses)) *
                          100
                      ).toFixed(1)
                    : 0;
            this._logger.info(
                `📊 Accent Color Cache Stats: ${this._accentCacheStats.hits} hits, ${this._accentCacheStats.misses} misses (${accentHitRate}% hit rate)`
            );

            // Memory cleanup after successful CSS generation
            this._cssStrings = null;
            if (global.gc) global.gc();

            return true;
        } catch (e) {
            this._logger.info(` Error updating overlay: ${e.message}`);
            return false;
        }
    }

    /**
     * Update GTK CSS files for specific version
     * @param {string} version - GTK version
     * @param {string} sourcePath - Source theme path
     * @param {Object} versionInfo - Version info
     * @param {Object} settings - Extension settings
     */
    _updateGtkCss(version, sourcePath, versionInfo, settings, isLightTheme = null) {
        const overlayGtkDir = `${this.overlayPath}/${version}`;

        if (versionInfo.hasGtkCss) {
            const gtkCss = this._generateGtkCss(version, sourcePath, false, settings, isLightTheme);
            this._writeFile(`${overlayGtkDir}/gtk.css`, gtkCss);
            this._logger.info(` Updated ${version}/gtk.css`);
        }

        if (versionInfo.hasDarkCss) {
            const darkCss = this._generateGtkCss(version, sourcePath, true, settings, isLightTheme);
            this._writeFile(`${overlayGtkDir}/gtk-dark.css`, darkCss);
            this._logger.info(` Updated ${version}/gtk-dark.css`);
        }
    }

    /**
     * Update Shell CSS files
     * @param {string} sourcePath - Source theme path
     * @param {Object} shellInfo - Shell info
     * @param {Object} settings - Extension settings
     */
    _updateShellCss(sourcePath, shellInfo, settings, isLightTheme = null) {
        const overlayShellDir = `${this.overlayPath}/gnome-shell`;

        if (shellInfo.hasShellCss) {
            const shellCss = this._generateShellCss(sourcePath, settings, isLightTheme);
            this._writeFile(`${overlayShellDir}/gnome-shell.css`, shellCss);
            this._logger.info(` Updated gnome-shell/gnome-shell.css`);

            // NOTE: Shell theme reload handled by extension.js via Main.loadTheme() API
            // This ensures instant reload without Adwaita flicker (GNOME 46+ pattern)
            this._logger.debug(` Shell CSS written - reload delegated to caller`);
        }

        if (shellInfo.hasPadOsdCss) {
            const padOsdCss = this._generatePadOsdCss(sourcePath, settings);
            this._writeFile(`${overlayShellDir}/pad-osd.css`, padOsdCss);
            this._logger.info(` Updated gnome-shell/pad-osd.css`);
        }
    }

    /**
     * REMOVED: _forceShellThemeReload() - legacy GNOME 43 pattern
     *
     * GNOME 46+ uses Main.loadTheme() API for instant Shell CSS reload.
     * Shell theme reload is now exclusively handled in extension.js:
     *   - _recreateOverlayTheme() - line ~975
     *   - _debounceUserSettingsUpdate() - line ~1115
     *   - _scheduleOverlayUpdate() - line ~1170
     *
     * This eliminates:
     *   - Visible Adwaita flicker (100-400ms white flash)
     *   - Unnecessary 100ms timeout delays
     *   - GSettings clear+set workaround
     *   - Complex nested timer management
     *
     * Performance improvement: ~1500ms → ~252ms (83% faster)
     *
     * See: docs/OPTIMIZATION_PLAN.md Phase 1 for details
     */

    /**
     * Recreate overlay from scratch (sync version)
     * BLOCKING: Deletes and recreates overlay theme synchronously
     * @param {Object} settings - Extension settings object
     * @param {Gio.Settings} interfaceSettings - GNOME interface settings (optional, for saving original themes)
     * @returns {boolean} Success status
     */
    recreateOverlay(settings, interfaceSettings = null) {
        // Read NEW source theme from settings (not from old metadata)
        const sourceThemeName = settings.get_string("overlay-source-theme");

        if (!sourceThemeName) {
            this._logger.info(` Cannot recreate - no source theme specified`);
            return false;
        }

        this._logger.info(` Recreating overlay (sync) for: ${sourceThemeName}`);

        // Remove old overlay (sync - fast directory delete)
        this.removeOverlayTheme();

        // Create new one with NEW source theme (sync - CSS generation)
        return this.createOverlayTheme(sourceThemeName, settings, interfaceSettings);
    }

    /**
     * Read CSS file synchronously (centralized helper for Gio.File.load_contents)
     * @param {Gio.File} file - File object to read
     * @returns {{success: boolean, contents: Uint8Array}} Result object
     * @throws {Error} If file read fails critically
     */
    _readCSSFileSync(file) {
        const [success, contents] = file.load_contents(null);
        return { success, contents };
    }

    /**
     * Recursively delete directory using Gio.File API
     * Handles files, directories, and symlinks correctly with try-finally guards
     * @param {Gio.File} fileOrDir - File or directory to delete
     * @throws {Error} If deletion fails
     */
    _deleteRecursive(fileOrDir) {
        const fileType = fileOrDir.query_file_type(Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);

        if (fileType === Gio.FileType.DIRECTORY) {
            // Directory: enumerate children and delete recursively
            const enumerator = fileOrDir.enumerate_children(
                "standard::name",
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                null
            );

            try {
                let fileInfo;
                while ((fileInfo = enumerator.next_file(null)) !== null) {
                    const child = fileOrDir.get_child(fileInfo.get_name());
                    this._deleteRecursive(child); // Recursive call
                }
            } finally {
                enumerator.close(null); // Always close enumerator
            }

            // Delete empty directory
            fileOrDir.delete(null);
        } else {
            // File or symlink: just delete
            fileOrDir.delete(null);
        }
    }

    /**
     * Cleanup resources and dispose Settings singletons
     * Call this when OverlayThemeManager is no longer needed
     */
    destroy() {
        // Disconnect all tracked signals
        if (this._signalsHandler) {
            this._signalsHandler.destroy();
            this._signalsHandler = null;
        }

        // Clear CSS caches to free memory
        if (this._baseThemeCache) {
            const cacheSize = this._baseThemeCache.size;
            let totalMemory = 0;
            for (const [key, value] of this._baseThemeCache.entries()) {
                totalMemory += value.length;
            }
            this._baseThemeCache.clear();
            this._logger.info(
                `🗑️  Cleared base theme cache: ${cacheSize} entries (${(totalMemory / 1024).toFixed(1)}KB freed)`
            );
        }

        // Clear component CSS cache
        if (this._componentCssCache) {
            const cacheSize = this._componentCssCache.size;
            let totalMemory = 0;
            for (const [key, value] of this._componentCssCache.entries()) {
                totalMemory += value.length;
            }
            this._componentCssCache.clear();
            this._logger.info(
                `🗑️  Cleared component CSS cache: ${cacheSize} entries (${(totalMemory / 1024).toFixed(1)}KB freed)`
            );
        }

        // Clear accent color cache
        this._clearAccentColorCache();

        // Cancel pending GLib timers to prevent memory leaks
        if (this._pendingTimers && this._pendingTimers.length > 0) {
            this._pendingTimers.forEach(timerId => {
                try {
                    GLib.source_remove(timerId);
                } catch (e) {
                    // Timer already completed - ignore
                }
            });
            this._pendingTimers = [];
            this._logger.debug("Cancelled pending GLib timers");
        }

        // Dispose Settings instances to prevent memory leaks
        if (this._interfaceSettings) {
            try {
                // GNOME Review Guidelines: run_dispose() necessary to immediately free GSettings
                // for org.gnome.desktop.interface when OverlayThemeManager is destroyed
                this._interfaceSettings.run_dispose();
            } catch (e) {
                this._logger.warn(`Error disposing interface settings: ${e.message}`);
            }
            this._interfaceSettings = null;
        }

        if (this._shellSettings) {
            try {
                // GNOME Review Guidelines: run_dispose() necessary to immediately free GSettings
                // for org.gnome.shell when OverlayThemeManager is destroyed
                this._shellSettings.run_dispose();
            } catch (e) {
                this._logger.warn(`Error disposing shell settings: ${e.message}`);
            }
            this._shellSettings = null;
        }

        this._logger.info("OverlayThemeManager destroyed, Settings disposed, async operations cancelled");
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
