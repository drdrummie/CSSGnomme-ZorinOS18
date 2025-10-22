# Changelog

## [2.3] - 2025-10-22

### Performance Improvements

-   Batch settings updates - Reduced callback storms (26 settings → 1 callback)
-   Promise-based theme switching - 18% faster overlay recreation
-   Intelligent color extraction cache - Proper light/dark mode handling

### Bug Fixes

-   Fixed color extraction on theme toggle (dark↔light)
-   Eliminated redundant cache checks
-   Improved theme switching timing

## [2.1.3] - 2025-10-21

### ZorinOS Integration

-   Panel margin control (floating mode)
-   Border radius sync with Zorin Taskbar
-   Opacity sync with Zorin Taskbar

### Improvements

-   Centralized signal management (GlobalSignalsHandler pattern)
-   Memory leak prevention (51 signal handlers tracked)
-   Improved lifecycle management

## [2.1.0] - 2025-10-19

### Bug Fixes

-   Fixed memory leaks in signal handlers
-   Fixed preferences crash (infinite signal loop)
-   Improved enable/disable cycle stability

### Architecture

-   Component recreation pattern
-   Proper cleanup in disable()
-   Stress tested (10+ enable/disable cycles)

## [2.0] - 2025-10-19

### GNOME 46+ Port

-   Full ESM module system
-   Modern Extension API
-   All 9 modules ported (100% feature parity)

### Features

-   Automatic color extraction from wallpaper
-   Dynamic theme overlay system
-   Advanced blur effects (backdrop-filter)
-   Customizable transparency per component
-   Panel styling (border radius, shadows, accents)
-   ZorinOS 18 integration (basic)

### Performance

-   83% faster shell reload (Main.loadTheme())
-   Zero memory leaks
-   Persistent color extraction cache

## [1.4] - Legacy (GNOME 43)

Final release for ZorinOS 17 / GNOME 43. Maintenance mode.

See legacy branch for details.
