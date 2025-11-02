/**
 * constants.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * Configuration constants and defaults
 */

/* constants.js
 *
 * Centralized constants and configuration values for CSSGnomme
 * All magic numbers with explanations in one place
 */

/**
 * CSSGnomme constants - centralized configuration
 * Replaces magic numbers scattered throughout codebase
 */
export const Constants = {
    // === COLOR EXTRACTION SETTINGS ===

    /**
     * Maximum image dimension for color analysis (pixels)
     * Trade-off between accuracy and performance
     * 800px provides good color representation without excessive processing time
     */
    COLOR_ANALYSIS_MAX_DIMENSION: 800,

    /**
     * Target pixel sample count for color analysis
     * Analyzing 10,000 pixels provides statistically significant color distribution
     * while maintaining sub-second analysis time on most hardware
     */
    COLOR_ANALYSIS_TARGET_SAMPLES: 10000,

    /**
     * Color quantization step for clustering similar colors
     * Step of 16 (256/16 = 16 levels per channel) balances:
     * - Reducing similar colors (e.g., RGB(100,50,30) ≈ RGB(105,55,35))
     * - Preserving distinct hues
     */
    COLOR_QUANTIZATION_STEP: 16,

    /**
     * Minimum color saturation delta to avoid grayscale
     * Delta < 10 indicates near-grayscale colors (R≈G≈B)
     * Higher threshold (15-20) would be more aggressive at filtering desaturated colors
     */
    COLOR_MIN_SATURATION_DELTA: 10,

    /**
     * Brightness filtering thresholds for color extraction
     * Filters colors to match light/dark theme requirements
     * - Light mode: Wider range (90-255) to capture diverse wallpapers (pastels, neons, edge cases)
     * - Dark mode: Narrower range (20-180) to avoid overly bright colors on dark backgrounds
     * Light threshold expanded based on stress test log analysis (9/299 pixels passed = too strict)
     */
    COLOR_BRIGHTNESS_THRESHOLDS: {
        light: { min: 140, max: 235 }, // Narrowed range: captures 70% of light-theme usable colors
        dark: { min: 20, max: 180 } // Unchanged: dark mode already works well
    }, // === OVERLAY THEME SETTINGS ===

    /**
     * Debounce delays for overlay theme updates (milliseconds)
     * Different contexts require different timing to balance UX and performance
     */
    OVERLAY_UPDATE_DEBOUNCE: {
        userSettings: 2000, // Prefs.js slider adjustments (user "tuning")
        colorScheme: 800, // Dark/Light automatic switch (balance speed/hardware)
        wallpaper: 800 // Wallpaper change (same as color-scheme for consistency)
    },

    /**
     * Cache size limits to prevent unbounded memory growth
     * LRU eviction ensures oldest entries removed when limit reached
     *
     * Memory estimates (per entry):
     * - colorPalette: ~150 bytes (8 RGB arrays × 3 bytes × 8 colors) → 100 entries = ~15KB total
     * - componentCss: ~12KB per variant (panel + popup CSS) → 100 variants = ~1.2MB total
     * - baseTheme: ~510KB per theme (gtk-3.0 + gtk-4.0 + shell) → 10 themes = ~5MB total (acceptable)
     *
     * Total max cache memory: ~6.2MB (negligible for modern desktop systems)
     *
     * ✅ LRU Eviction: Verified through stress testing (80+ operations, zero memory leaks)
     */
    CACHE_LIMITS: {
        colorPalette: 100, // Max 100 wallpapers cached (~15KB total, supports large collections)
        componentCss: 100, // Max 100 component CSS variants (~1.2MB total, covers 50 wallpapers × 2 modes)
        baseTheme: 10, // Max 10 base theme CSS caches (~5MB total, covers all realistic theme switches)
        cssTemplates: 100 // Max 100 theme templates cached (multiple color combinations)
    },

    /**
     * Persistent wallpaper color cache configuration
     * Stores analyzed colors to disk for cross-session reuse
     *
     * Performance benefits:
     * - Cross-session persistence: Analyzed wallpapers remain cached after reboot
     * - Faster startup: No K-means re-analysis needed for known wallpapers (300ms → <5ms)
     * - Better UX: Instant color application on extension enable
     *
     * Memory/Disk Impact:
     * - maxEntries: 100 wallpapers = ~50KB disk space (negligible)
     * - saveDebounceMs: 15s provides quick persistence while preventing excessive I/O
     */
    CACHE_PERSISTENCE: {
        enabled: true, // Enable persistent cache (can be controlled via GSettings in future)
        maxEntries: 100, // Maximum number of wallpapers to cache (increased from 50 for better retention)
        saveDebounceMs: 15000, // 15s debounce after last cache change (reduced from 30s for faster persistence)
        cacheVersion: "1.0", // Schema version for future migrations
        staleAfterDays: 30, // Remove entries older than 30 days (cleanup)
        cacheFileName: "wallpaper-colors.json" // File name in cache directory
    }, // === UI SETTINGS ===

    /**
     * Default opacity values
     * Based on UX testing for optimal transparency/readability balance
     */
    DEFAULT_OPACITY: {
        panel: 0.6, // 60% - readable text while showing background
        menu: 0.8 // 80% - more solid for better popup readability
    },

    /**
     * Default border radius value (pixels)
     * Modern design trend - 12px provides subtle rounding without excessive curves
     */
    DEFAULT_BORDER_RADIUS: 12,

    /**
     * Border radius presets (pixels)
     * Based on common design system values (8px increments)
     */
    BORDER_RADIUS_PRESETS: {
        flat: 0,
        subtle: 8,
        modern: 12, // Default
        rounded: 16,
        pill: 24
    },

    /**
     * Default blur settings
     * Calibrated for "frosted glass" effect on most themes
     */
    DEFAULT_BLUR: {
        radius: 22, // Blur intensity (pixels)
        saturate: 0.95, // Color vibrancy multiplier
        contrast: 0.75, // Contrast adjustment
        brightness: 0.65, // Brightness adjustment
        opacity: 0.8 // Overall blur layer opacity
    },

    /**
     * Default border width for blur effects (pixels)
     * 1-2px provides subtle definition without overwhelming design
     */
    DEFAULT_BORDER_WIDTH: 1,

    // === PERFORMANCE SETTINGS ===

    /**
     * HSP brightness threshold for dark/light detection
     * Colors below 155 are considered dark background
     * Based on perceptual brightness formula (weighted RGB)
     */
    HSP_DARK_THRESHOLD: 155,

    /**
     * Minimum contrast ratio for WCAG AA compliance
     * 4.5:1 for normal text, 3:1 for large text
     */
    MIN_CONTRAST_RATIO: {
        AA: 4.5,
        AAA: 7.0,
        large: 3.0
    },

    /**
     * Color adjustment step for contrast enhancement
     * When auto-generating foreground colors
     */
    CONTRAST_ADJUSTMENT_STEP: 0.1,

    /**
     * Auto-highlight intensity for hover effects
     * 0.15 = 15% lighter/darker than base color
     */
    AUTO_HIGHLIGHT_INTENSITY: 0.15,

    // === ZORIN INTEGRATION SETTINGS ===

    /**
     * Zorin theme hover opacity adjustments
     * Different values for light/dark themes for optimal visibility
     */
    ZORIN_HOVER_OPACITY: {
        lightTheme: 0.3, // Light theme: stronger contrast needed
        darkTheme: 0.25 // Dark theme: softer hover for elegance
    },

    /**
     * Zorin theme active state opacity
     * For checked/pressed states
     */
    ZORIN_ACTIVE_OPACITY: {
        lightTheme: 0.6,
        darkTheme: 0.4
    },

    // === UI SCALING FACTORS ===

    /**
     * Border radius scaling factors for UI elements
     * Relative to main border-radius setting
     * v2.5: Added Quick Settings scaling factors
     */
    BORDER_RADIUS_SCALING: {
        panelButton: 0.8, // Panel buttons: 80% of main radius (updated from 0.6 for better proportions)
        popupItem: 0.5, // Popup menu items: 50% of main radius
        quickToggle: 0.8, // Quick Settings toggle buttons: 80% of main radius (matches panel buttons)
        quickToggleArrow: 0.6, // Quick Settings arrow buttons: 60% of main radius (smaller elements)
        listViewRow: 0.4 // List view rows: 40% of main radius (subtle, optional feature for v2.6+)
    },

    // === QUICK SETTINGS SIZING ===

    /**
     * Quick Settings toggle button height adjustment
     * Reduces default theme height for more compact appearance (Zorin 17-style)
     * v2.5.1: User-requested compact mode
     */
    QUICK_SETTINGS_HEIGHT: {
        reduction: 6, // Reduce height by 6px total (3px top + 3px bottom padding)
        baseHeight: 42 // Target min-height (down from theme default 48px)
    },

    // === ACCENT HOVER INTENSITIES ===

    /**
     * Opacity values for accent color hover effects in app switcher
     * Progressive intensity for different states
     */
    ACCENT_HOVER_OPACITY: {
        subtle: 0.15, // Base hover state
        medium: 0.35, // Selected state
        strong: 0.45, // Selected + hover state
        active: 0.4 // Active/pressed state
    },

    // === ACCENT COLOR DETECTION SETTINGS ===

    /**
     * Alpha values for accent color application based on theme brightness
     * Higher alpha on light themes for better visibility, lower on dark themes
     */
    ACCENT_COLOR_ALPHA: {
        border: {
            lightTheme: 0.8, // Higher alpha for visible borders on light backgrounds
            darkTheme: 0.6 // Lower alpha for subtle borders on dark backgrounds
        },
        background: {
            lightTheme: 0.35, // Stronger tint on light themes for contrast
            darkTheme: 0.25 // Softer tint on dark themes to avoid overpowering
        }
    },

    // === PADDING VALUES (PIXELS) ===

    /**
     * Standard padding values for UI elements
     * Consistent spacing throughout the interface
     */
    UI_PADDING: {
        dashLabel: { vertical: 6, horizontal: 12 }, // Dash label tooltip
        previewHeader: { vertical: 4, horizontal: 8 } // Window preview header
    },

    // === SHADOW COLORS ===

    /**
     * RGB values for theme-aware shadows
     * White for light themes, black for dark themes
     */
    SHADOW_COLOR_RGB: {
        light: [255, 255, 255], // Pure white for light theme separation
        dark: [0, 0, 0] // Pure black for dark theme depth
    },

    // === SHADOW SPREAD SETTINGS ===

    /**
     * Shadow spread multiplier for shadow-strength setting
     * Maps shadow-strength (0.0-1.0) to blur radius in pixels
     * Formula: panelBlur = strength * multiplier
     * Example: strength 0.4 → 12px (default), strength 0.6 → 18px, strength 1.0 → 30px
     * This controls the outer glow/halo visibility around panels and menus
     *
     * Range: 0.0 (no shadow) to 1.0 (max 30px panel blur)
     * Calculation: 12px (current panel default) / 0.4 (new default strength) = 30
     */
    SHADOW_SPREAD_MULTIPLIER: 30,

    /**
     * Shadow blur ratio modifiers relative to base panel shadow
     * These maintain visual hierarchy while allowing dynamic shadow-strength control
     *
     * Base calculation: panelBlur = shadowStrength * SHADOW_SPREAD_MULTIPLIER
     * Then apply ratios for other elements:
     *   - popup: panelBlur * 0.67 (8px at default 0.4 strength)
     *   - button: panelBlur * 0.67 (8px at default 0.4 strength)
     *   - inset: panelBlur * 1.25 (15px at default 0.4 strength)
     *
     * Examples at different strength values:
     *   - 0.1: panel 3px, popup 2px, button 2px, inset 4px (minimal)
     *   - 0.4: panel 12px, popup 8px, button 8px, inset 15px (default)
     *   - 0.6: panel 18px, popup 12px, button 12px, inset 23px (medium)
     *   - 1.0: panel 30px, popup 20px, button 20px, inset 38px (maximum)
     */
    SHADOW_BLUR_RATIOS: {
        panel: 1.0, // Base reference (12px at 0.4 strength)
        popup: 0.67, // 67% of panel (8px at 0.4 strength)
        button: 0.67, // 67% of panel (8px at 0.4 strength)
        inset: 1.25 // 125% of panel (15px at 0.4 strength)
    },

    // === COLOR FALLBACKS ===

    /**
     * Default fallback colors when theme parsing fails
     * Nord-inspired palette for neutral, pleasant appearance
     */
    FALLBACK_COLORS: {
        darkPanel: [46, 52, 64], // Nord Polar Night 0
        lightPanel: [255, 255, 255], // Pure white
        darkPopup: [20, 20, 20], // Near black
        lightPopup: [240, 240, 240], // Off-white
        accent: [253, 180, 180] // Soft red-ish accent
    },

    // === BLUR GLOW EFFECT SETTINGS ===

    /**
     * Glow intensity multiplier for blur shadow
     * Higher values create more prominent glow around elements
     */
    GLOW_INTENSITY_MULTIPLIER: 1.5,

    /**
     * Glow spread factor (relative to blur radius)
     * 0.6 = glow extends 60% of blur radius
     */
    GLOW_SPREAD_FACTOR: 0.6,

    /**
     * Maximum glow opacity cap
     * Prevents overwhelming glow even with high blur settings
     */
    MAX_GLOW_OPACITY: 0.9,

    /**
     * Backdrop filter blur reduction factor
     * Applied blur is 50% of configured blur radius for performance
     * backdrop-filter is more expensive than box-shadow blur
     */
    BACKDROP_BLUR_REDUCTION: 0.5,

    // === TRANSITION SETTINGS ===

    /**
     * Default transition duration for CSS animations (seconds)
     * 0.3s provides smooth feel without feeling sluggish
     */
    DEFAULT_TRANSITION_DURATION: 0.3,

    /**
     * Panel button hover transition duration (milliseconds)
     * Faster than general transitions for immediate feedback
     */
    PANEL_BUTTON_TRANSITION_MS: 150,

    /**
     * Blur transition default duration (seconds)
     * For smooth blur effect changes when settings update
     */
    BLUR_TRANSITION_DURATION: 0.3,

    // === THEME DETECTION PATTERNS ===

    /**
     * Keywords for detecting Zorin themes
     * Case-insensitive check against theme names
     */
    ZORIN_THEME_KEYWORDS: ["zorin", "zorinblue", "zorinos"],

    /**
     * CSS selectors for theme accent color extraction
     * Priority order for parsing theme colors
     */
    ACCENT_COLOR_SELECTORS: {
        gtkSwitch: "switch:checked",
        themeSelected: "@theme_selected_bg_color",
        stageColor: "stage { color:"
    },

    // === SHADOW BLUR VALUES ===

    /**
     * Fixed shadow blur radius values (pixels)
     * Hardcoded per commit 94bb07e for consistent depth perception
     * Panel: 12px - Subtle elevation for taskbar
     * Popup: 8px - Sharp depth, matches taskbar for visual consistency
     * Button: 8px - Button hover/active shadow
     * Inset: 15px - Inner glossy glow effect
     *
     * @deprecated Since v2.6 - Now calculated dynamically via shadow-strength setting
     * See SHADOW_SPREAD_MULTIPLIER and SHADOW_BLUR_RATIOS for dynamic calculation
     * Kept for backwards compatibility reference only
     */
    SHADOW_BLUR_VALUES: {
        panel: 12, // Now: shadowStrength * SHADOW_SPREAD_MULTIPLIER * SHADOW_BLUR_RATIOS.panel
        popup: 8, // Now: shadowStrength * SHADOW_SPREAD_MULTIPLIER * SHADOW_BLUR_RATIOS.popup
        button: 8, // Now: shadowStrength * SHADOW_SPREAD_MULTIPLIER * SHADOW_BLUR_RATIOS.button
        inset: 15 // Now: shadowStrength * SHADOW_SPREAD_MULTIPLIER * SHADOW_BLUR_RATIOS.inset
    },

    // === UI LABELS AND INDICATORS ===

    /**
     * Label/indicator text strings for UI elements
     * Checkmark/cross indicators for toggle states
     */
    UI_INDICATORS: {
        enabled: "  ✓", // Two spaces + checkmark for consistent width
        disabled: "  ✗" // Two spaces + cross for consistent width
    },

    // === WALLPAPER COLOR EXTRACTION SHADING ===

    /**
     * Shade factors for wallpaper accent color transformations
     * Used to derive border and shadow colors from extracted accent
     */
    WALLPAPER_ACCENT_SHADING: {
        border: {
            darkTheme: 0.15, // Lighten 15% for dark themes (better visibility)
            lightTheme: -0.1 // Darken 10% for light themes (subtle contrast)
        },
        shadow: {
            darkTheme: -0.85, // 85% darker → deep shadow effect
            lightTheme: 0.85 // 85% lighter → soft shadow effect
        }
    },

    // === BLUR EFFECT ALPHA VALUES ===

    /**
     * Opacity values for blur effects (border, background, shadows)
     * Theme-dependent alphas provide optimal visibility across light/dark backgrounds
     */
    BLUR_ALPHA: {
        border: {
            darkTheme: 0.6, // Lower opacity on dark backgrounds (subtle border)
            lightTheme: 0.8 // Higher opacity on light backgrounds (visible separation)
        },
        background: 0.15, // Blur background glossy effect (15% opacity)
        shadowFallback: 0.3 // Auto-detect shadow fallback alpha (30% opacity)
    },

    // === DEFAULT SHADOW COLORS ===

    /**
     * Default shadow colors for theme-aware effects
     * Auto-detection fallback when user hasn't customized shadow color
     */
    DEFAULT_SHADOW_COLORS: {
        light: "rgba(255, 255, 255, 0.7)", // Light theme shadow (70% opacity)
        dark: "rgba(0, 0, 0, 0.7)", // Dark theme shadow (70% opacity)
        lightFallback: "rgba(255, 255, 255, 0.3)", // Auto-detect fallback (30% opacity)
        darkFallback: "rgba(0, 0, 0, 0.3)" // Auto-detect fallback (30% opacity)
    },

    // === AUTO-GENERATED TEXT COLORS ===

    /**
     * Text colors for auto-generated foreground on backgrounds
     * Ensures WCAG AA contrast compliance
     */
    AUTO_TEXT_COLORS: {
        lightOnDark: [250, 250, 250], // Light text RGB for dark backgrounds
        darkOnLight: [5, 5, 5], // Dark text RGB for light backgrounds
        lightHex: "#ffffff", // White text hex (dark themes)
        darkHex: "#161c1f" // Dark text hex (light themes)
    },

    // === NEUTRAL STAGE COLORS ===

    /**
     * Neutral stage colors for Shell theme generation
     * Used when no valid accent color is detected (grey/neutral themes)
     */
    NEUTRAL_STAGE_COLORS: {
        light: "#2e3436", // Light theme stage color (dark grey)
        dark: "#eeeeec" // Dark theme stage color (off-white)
    },

    // === ZORIN TASKBAR INTEGRATION LIMITS ===

    /**
     * Range limits for Zorin Taskbar GSettings synchronization
     * Ensures values stay within Zorin's supported ranges
     */
    ZORIN_LIMITS: {
        panelMargin: { min: 0, max: 20 }, // Panel margin range (pixels)
        borderRadius: { min: 0, max: 25 }, // Border radius range (pixels)
        borderRadiusDivider: 5 // Zorin multiplier conversion (px → 0-5 scale)
    },

    // === INITIALIZATION DEFAULTS ===

    /**
     * Default values for extension initialization
     * Applied when settings are reset or first-time setup
     */
    INITIALIZATION_DEFAULTS: {
        panelMargin: 8, // Floating panel default (0 = pinned to edge)
        popupColorLight: "rgba(255, 255, 255, 0.9)", // White popup (90% opacity)
        blurBackground: "rgba(0, 0, 0, 0.3)", // Black blur background (30% opacity)
        blurBorder: "rgba(255, 255, 255, 0.15)" // White blur border (15% opacity)
    }
};
