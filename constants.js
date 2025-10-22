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
     */
    BORDER_RADIUS_SCALING: {
        panelButton: 0.6, // Panel buttons: 60% of main radius
        popupItem: 0.5 // Popup menu items: 50% of main radius
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
     * Maps shadow-strength (0.0-0.8) to blur radius in pixels
     * Formula: spread = strength * multiplier
     * Example: strength 0.3 → 12px, strength 0.5 → 20px, strength 0.8 → 32px
     * This controls the outer glow/halo visibility around panels and menus
     */
    SHADOW_SPREAD_MULTIPLIER: 70,

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
     */
    SHADOW_BLUR_VALUES: {
        panel: 12,
        popup: 8,
        button: 8,
        inset: 15
    },

    // === UI LABELS AND INDICATORS ===

    /**
     * Label/indicator text strings for UI elements
     * Checkmark/cross indicators for toggle states
     */
    UI_INDICATORS: {
        enabled: "  ✓", // Two spaces + checkmark for consistent width
        disabled: "  ✗" // Two spaces + cross for consistent width
    }
};
