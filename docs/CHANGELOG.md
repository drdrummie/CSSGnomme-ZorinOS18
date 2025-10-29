# Changelog

All notable changes to CSSGnomme will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.1] - 2025-10-29

**Quick Settings Enhancements + Dynamic Updates**

### Added

- **Quick Settings Border-Radius Sync**: Quick Settings elements now sync with user border-radius setting

  - Universal application for all themes (Zorin and non-Zorin)
  - Scaling factors: Toggle buttons 80%, Arrow buttons 60%
  - Professional appearance with visual consistency

- **Quick Settings Compact Height**: Reduced button height from 48px to 42px

  - Zorin 17-style compact appearance
  - Better use of vertical space
  - Maintains accessibility while reducing visual bulk

- **Partial Border-Radius**: Seamless toggle+arrow connections
  - LTR layout: Toggle rounded left, flat right
  - RTL layout: Toggle rounded right, flat left
  - Standalone toggles preserve full radius

### Fixed

- **Dynamic Border-Radius Updates**: Border-radius changes now apply instantly
  - No more "Recreate Overlay" required for border-radius adjustments
  - Moved Quick Settings CSS from base-theme cache to component CSS
  - Improved cache efficiency (base-theme no longer invalidated by UI changes)

### Changed

- **Minimal Mode**: Wallpaper accent limited to core widgets only
  - Switches, checkboxes, radio buttons, progress bars
  - Theme hover/selection behavior preserved
  - Eliminated window control button artifacts

---

## [2.5.0] - 2025-10-28

**Constants Refactoring + Minimal Mode**

### Changed

- **Constants Refactoring**: Eliminated 35+ magic numbers across codebase

  - Added 94 lines of centralized constants with JSDoc documentation
  - 7 new constant categories (shading, opacity, limits, defaults)
  - Single source of truth for all numeric values

- **Preferences UI Reorganization**: Moved Zorin Theme Tint Strength to Color Settings page
  - Better UX grouping with transparency/color controls
  - Clearer subtitle explaining tint behavior

### Tested

- **Stress Test**: 10 minutes, 6 themes, zero errors
  - Zero JavaScript errors, zero memory leaks
  - Cache performance: Accent 93.5%, Wallpaper 100%
  - Memory stable: 302→420 MB (expected caching behavior)

---

## [2.4.0] - 2025-10-25

**Sprint 5 Backports + Performance**

### Added

- **GTK Assets Symlinking**: Custom checkbox/radio/switch icons from Fluent themes now display correctly
- **Accent Color Cache**: 6x speedup (180ms → 31ms overhead for 30 changes)
  - 97.3% cache hit rate validated through stress testing
  - Color-scheme aware (separate entries for light/dark)
  - Zero memory overhead (~500 bytes for 4 cached entries)

### Fixed

- **Zorin Gradient Fixes**: Third-party themes no longer show unwanted accent gradients
  - Quick Settings, Calendar, Screenshot UI gradients removed
  - Applied conditionally (non-Zorin themes only)

### Changed

- **Icon Override Removal**: Theme's custom checkbox/radio styling preserved
- **Fluent Titlebar Cleanup**: Architectural refactoring - all CSS templates in cssTemplates.js

---

## [2.3.3] - 2025-10-23

**GTK CSS Refactoring**

### Changed

- **CSS Template Refactoring**: Moved ~160 lines of GTK CSS from overlayThemeManager.js to cssTemplates.js
- **Separation of Concerns**: All CSS logic in cssTemplates.js, orchestration in overlayThemeManager.js
- **2-Tier Cache System**: Base Theme Cache + Component Cache
  - CSS Write Time: 2ms for 6 files
  - Memory Overhead: +0.2MB (minimal impact)

---

## [2.1.1] - 2025-10-21

**Signal Management Refactoring**

### Changed

- **Centralized Signal Management**: Adopted GlobalSignalsHandler pattern
  - extension.js: 33-41 signals centrally tracked
  - prefs.js: Fixed 6 ColorButton memory leaks
  - Foundation ready for v2.2 Master Mode

### Fixed

- **Memory Leak Prevention**: Fixed signal leaks in extension.js (30+ settings handlers)
- **Enable/Disable Cycle**: Component recreation pattern prevents stale references
- **Prefs Crash Fix**: Eliminated infinite signal loop in dropdown

---

## [2.1.0] - 2025-10-19

**Critical Stability Fixes**

### Fixed

- **Memory Leak Prevention**: Fixed signal leaks in extension.js (30+ settings handlers + menu items)
- **Enable/Disable Cycle**: Component recreation pattern prevents stale references
- **Prefs Crash Fix**: Eliminated infinite signal loop in dropdown (blockSignals pattern)
- **Shared Settings**: ColorPalette properly handles shared GSettings disposal
- **Logger Cleanup**: Singleton pattern with automatic signal reconnection

### Changed

- **Architecture**: Component recreation pattern (GNOME 43 style adapted for GNOME 46)
- **Stress Tested**: 10x enable/disable cycles with clean logs

---

## [2.0.0] - 2025-10-19

**GNOME 46+ Port Complete**

### Added

- **Complete GNOME 46 Support**: All 9 modules ported to GNOME 46+ ESM syntax
- **cssTemplates.js**: New file with complete CSS generation system (1068 lines)
- **Enhanced Logging**: Child hierarchy, leak tracking, debug caching (loggingUtils.js)
- **Persistent Cache**: Smart filtering, memory fixes (colorPalette.js)
- **Zorin Integration**: Feature detection, panel margin sync (ZorinStyler.js)
- **Main.loadTheme() Optimization**: 83% faster Shell reload vs legacy GSettings

### Changed

- **Extension Architecture**: Extension API (not ExtensionUtils)
- **Import System**: ESM imports throughout (import/export syntax)
- **Lifecycle Management**: Proper signal cleanup, indicator UI, settings bindings
- **Preferences UI**: Adwaita-based preferences with modern UI components

### Performance

- **Shell Reload**: 83% faster (Main.loadTheme() vs legacy GSettings clear+set)
- **Stability**: Zero memory leaks, proper lifecycle management
- **Testing**: All features verified on ZorinOS 18 / GNOME 46

---

## [1.5.0] - 2025-10-18

**Legacy Branch (GNOME 43-44)**

### Added

- **Sprint 5 Complete**: Fluent theme support, Zorin gradient fixes
- **Active Maintenance**: Critical fixes + backports from v2.x

### Note

- This is the legacy branch for ZorinOS 17 / GNOME 43-44
- See `zorinos17-v15` branch for source code
- Active maintenance for critical fixes only

---

## Earlier Versions

For complete version history of v1.x series, see the `zorinos17-v15` branch.
