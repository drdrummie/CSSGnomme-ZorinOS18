# 🚀 CSS Gnomme Quick Guide (ZorinOS 18)

**Version:** v2.5.3 (GNOME 46+)
**Last Updated:** November 2, 2025

---

## 📖 What is CSS Gnomme?

CSS Gnomme is a powerful GNOME Shell extension that creates a **dynamic overlay theme** on top of your existing GTK theme. It automatically extracts colors from your wallpaper, applies custom transparency and blur effects, and enhances your desktop appearance—all **completely reversible** without modifying your original themes.

**Key Features:**

- 🔄 **Dynamic theme overlay** that adapts to your background
- 🎨 **Automatic color extraction** from your wallpaper
- 🌫️ **Advanced blur effects** for panels and menus
- 🖥️ **Zorin OS integration** for seamless taskbar styling
- 🎭 **Manual icon theme override** for themes without matching icon packs
- ⚡ **Live updates** when you change settings

---

## ⚙️ Settings Overview

Access settings by clicking the **CSS Gnomme icon** in your system tray → **Open Settings**

### 🎨 Page 1: Theme Overlay

**This is where you enable CSS Gnomme and choose your base theme.**

#### Theme Integration

- **Enable Overlay Theme**: Master switch to activate the entire CSS Gnomme system

  - ✅ ON: CSS Gnomme creates overlay theme and applies your customizations
  - ❌ OFF: System reverts to your original theme (all settings preserved)

- **Base Theme**: The GTK theme CSS Gnomme uses as foundation

  - Select from installed themes in `~/.themes/` or `/usr/share/themes/`
  - CSS Gnomme will inherit this theme's styling and apply your customizations on top
  - **Tip:** Use Fluent-based themes (ZorinBlue, ZorinPurple) for best results on Zorin OS
  - **Smart Filtering:** When "Auto-switch between Light/Dark variants" is enabled, dropdown only shows themes matching current appearance (Light OR Dark, not both)

- **Overlay Status**: Shows current state and location of generated theme files

  - Active: `~/.themes/CSSGnomme/` exists and is loaded
  - Inactive: Original theme is active

- **Auto-detect theme border radius**: Automatically match your theme's rounded corners
  - ✅ ON: CSS Gnomme detects border-radius from active theme
  - ❌ OFF: Use manual Border Radius slider in Color Settings

#### Automatic Color Extraction

- **Auto-detect colors on wallpaper change**: Automatically extract and apply colors when you change your background

  - **How it works:** Monitors `~/.config/background` for changes
  - Extracts dominant colors using K-means clustering
  - Applies colors to panel, menus, and borders within 2 seconds

- **Extract Colors Now**: Manual trigger button
  - Use this after changing wallpaper if auto-extraction is disabled
  - Or to force re-extraction if colors don't look right

#### Manual Controls

- **Apply Changes Now**: Force immediate update (bypasses 2-second auto-update delay)

  - Use when adjusting multiple settings and want instant preview

- **Recreate Overlay Theme**: Rebuild entire overlay from scratch
  - **When to use:** If theme looks broken or settings aren't applying
  - Deletes and regenerates `~/.themes/CSSGnomme/`

---

### 🎨 Page 2: Color Settings

**Fine-tune transparency, colors, and panel appearance.**

#### Basic Transparency Controls

- **Panel Opacity** (0.0 - 1.0): Taskbar/panel transparency

  - **0.0**: Fully transparent (invisible panel)
  - **0.5**: Half transparent (balanced)
  - **1.0**: Fully opaque (solid panel)
  - **Recommended:** 0.7-0.9 for subtle transparency

- **Menu Opacity** (0.0 - 1.0): Popup menu transparency

  - Controls application menus, system menus, and dropdown panels
  - **Tip:** Keep this higher than panel (0.85-0.95) for readability

- **Zorin Theme Tint Strength** (0 - 100%): Adjust Zorin theme color tint intensity
  - **0%**: Fully neutral grey backgrounds (no color tint)
  - **100%**: Original colored backgrounds (Zorin theme default)
  - Only affects Zorin themes (ZorinBlue, ZorinGreen, ZorinPurple, etc.)
  - Other themes unaffected (Fluent, Arc, Graphite remain unchanged)

#### Panel Appearance

- **Panel Margin** (0 - 32px): Horizontal spacing from screen edges (Floating mode)

  - **0px**: Pinned to edges (traditional panel)
  - **4-16px**: Floating panel with modern appearance (Zorin style)
  - **Syncs with Zorin Taskbar** when integration is enabled

- **Override panel color**: Use custom color instead of extracted wallpaper color

  - Enable to manually choose panel background color
  - Useful if extracted color doesn't match your preference

- **Choose override panel color**: RGBA color picker

  - Full control over panel background (supports transparency via alpha channel)
  - Only active when "Override panel color" is enabled

- **Override popup color**: Separate color override for menus/popups

  - Recommended to keep similar to panel color for consistency

- **Choose override popup color**: RGBA picker for menu backgrounds

- **Border Radius** (0 - 25px): Roundness of panel corners
  - **0px**: Square corners (flat design)
  - **8-12px**: Moderately rounded (modern)
  - **15-25px**: Heavily rounded (macOS-style)
  - **Step:** 1px for precise control

---

### 🌫️ Page 3: Blur Effects

**Create frosted glass effects for panels and menus.**

#### Custom Blur Settings

- **Blur radius** (1 - 50px): Intensity of blur effect

  - **10-20px**: Subtle, elegant blur
  - **30-40px**: Noticeable frosted glass effect
  - **Higher values:** More diffused, fog-like appearance

- **Saturation multiplier** (0.4 - 2.0): Color vibrancy in blurred background

  - **< 1.0**: Desaturated, muted colors
  - **1.0**: Natural colors
  - **> 1.0**: Enhanced, vivid colors
  - **Recommended:** 1.1-1.3 for vibrant frosted glass

- **Contrast multiplier** (0.4 - 2.0): Difference between light/dark areas

  - **< 1.0**: Softer, low-contrast blur
  - **1.0**: Natural contrast
  - **> 1.0**: Sharp, high-contrast edges
  - **Recommended:** 0.9-1.1 for natural appearance

- **Brightness multiplier** (0.4 - 2.0): Overall lightness of blur effect

  - **< 1.0**: Darker, dimmed background
  - **1.0**: Natural brightness
  - **> 1.0**: Brighter, illuminated effect
  - **Tip:** Use 1.1-1.3 for light themes, 0.8-0.9 for dark themes

- **Background color/tint**: Semi-transparent overlay color applied over blur

  - Automatically set to neutral white (light themes) or black (dark themes)
  - Customize for unique glass effects (e.g., blue tint for cool tones)
  - **Format:** RGBA (supports alpha channel)

- **Border color**: Color of subtle border framing blurred elements

  - Automatically extracted from wallpaper accent color
  - Provides definition and polish to blur effect

- **Border width** (0 - 5px): Thickness of border

  - **0px**: No border (minimalist)
  - **1-2px**: Subtle definition (recommended)
  - **3-5px**: Prominent frame

- **Blur opacity** (0.0 - 1.0): Transparency of entire blur layer

  - **0.0**: Blur disabled (no effect)
  - **0.3-0.6**: Light, ethereal appearance
  - **0.8-1.0**: Prominent, solid glass effect

- **Blur transition duration** (0.1 - 2.0s): Animation speed for blur changes
  - **0.1-0.3s**: Quick, snappy transitions
  - **0.5-0.8s**: Balanced, smooth fades
  - **1.0-2.0s**: Slow, elegant animations

#### Shadow Effects (only when border-width is set to 0)

- **Shadow strength** (0.0 - 1.0): Intensity of drop shadow ✨ **FIXED in v2.5.3!**

  - **Formula:** `baseShadow = shadowStrength × 30` with ratio-based scaling
  - **0.0**: No shadow
  - **0.1**: Minimal depth (3px base shadow)
  - **0.4**: Default balanced shadow (12px base shadow)
  - **0.8**: Strong, dramatic shadow (24px base shadow)
  - **1.0**: Maximum glow effect (30px base shadow)
  - **What was fixed:** Slider was non-functional since v2.0 - now works with instant updates!
  - Adds depth perception to panels and menus

- **Shadow color**: Color of drop shadow
  - Automatically set based on theme (dark shadow for light themes, vice versa)
  - Customize for specific aesthetic (e.g., colored shadows)

---

### ⚙️ Page 4: Advanced

**Power-user settings and debugging options.**

#### Interface Behavior

- **Hide system tray indicator**: Remove CSS Gnomme icon from top panel
  - Settings still accessible via Extensions app
  - **Use case:** Minimize clutter after setup is complete

- **Enable notifications**: Show desktop notifications for theme changes and events
  - Color extraction results
  - Extension events and errors
  - Theme switching confirmations

- **Enable Zorin OS Integration**: Special enhancements for Zorin Taskbar (moved from Page 1)
  - Syncs panel margin, border radius, and opacity with Zorin Taskbar
  - Adds floating panel styling for Fluent-based themes
  - **Recommended:** Enable if you're using Zorin OS 18

- **Zorin Menu Layout Style**: Choose from 5 different app menu layouts
  - **ALL**: Standard Zorin layout (categories + apps + sidebar)
  - **MINT**: Linux Mint style (hover categories)
  - **APP_GRID**: Grid view for apps
  - **APPS_ONLY**: Applications list only
  - **SYSTEM_ONLY**: System shortcuts only
  - **Note:** Requires Zorin Menu extension to be installed and enabled

- **Icon Theme Override**: Select icon theme independently from GTK theme
  - ✅ **Enable:** Shows icon theme dropdown, useful for themes without matching icon packs
  - ❌ **Disable:** Auto-detect from GTK theme (default behavior)
  - **Location:** Scans `~/.icons`, `~/.local/share/icons`, `/usr/share/icons`
  - **Validation:** Only shows themes with valid `index.theme` file
  - **Use case:** Fixes missing icons for themes like Fluent GTK without Fluent icons installed

- **Icon Theme**: Dropdown to select specific icon theme
  - Only active when "Icon Theme Override" is enabled
  - Sorted alphabetically (Adwaita first as system fallback)
  - Requires manual overlay recreation after changing

#### Automation

- **Auto-switch between Light/Dark variants**: Automatically switch theme variants on system Dark Mode toggle
  - ✅ ON: Detects system Dark Mode toggle, switches to matching theme variant
  - Example: ZorinPurple-Light ↔ ZorinPurple-Dark
  - **Smart Filtering:** Dropdown will only show matching variants (Light OR Dark, not both)
  - ❌ OFF: User manually selects theme from full list

#### Full Auto Mode (Experimental)

- **Full Auto Mode**: Uses Wallpaper color extraction to style most of the shell elements
  - ✅ **Enable:** Wallpaper extraction controls shell colors (panel, popup, blur colors, shadows)
  - ❌ **Disable:** Theme controls blur effects, wallpaper controls panel/popup only (default)
  - **Experimental:** May produce unexpected results with certain wallpapers

#### Debugging

- **Enable debug logging**: Detailed console logs for troubleshooting
  - View logs with: `journalctl -f -o cat /usr/bin/gnome-shell | grep CSSGnomme`
  - Or use: `make logs` from extension directory
  - **Warning:** Increases log verbosity significantly

---

### ℹ️ Page 5: About

**Project information, version, and How It Works explanation.**

- **Version**: v2.5.3 (November 2, 2025)
- **Author**: drdrummie
- **Inspired by**: Cinnamon CSS Panels and GNOME Open Bar extensions
- **How does it work**: Quick info

---

## 🎯 Quick Setup Workflow

### Minimal Setup (5 minutes)

1. **Page 1 (Theme Overlay)**:

    - ✅ Enable **Enable Overlay Theme**
    - ✅ Enable **Auto-detect colors on wallpaper change**
    - ✅ Enable **Auto-detect theme border radius**
    - Select your preferred **Base Theme**

2. **Page 2 (Color Settings)**:

    - Adjust **Panel Opacity** (try 0.85)
    - Set **Panel Margin** (try 8px for floating effect)
    - Adjust **Border Radius** (try 12px) - only if auto-detect is OFF - DISABLE if you don't want extension to change border-radius later when you switching themes

3. **Page 4 (Advanced Settings)**:

    - ✅ Enable **Enable Zorin OS Integration** (if on Zorin OS)
    - ✅ Enable **Icon Theme Override** if your theme has missing icons (e.g., Fluent GTK)
    - Select matching **Icon Theme** from dropdown

4. **Done!** Colors will auto-extract from wallpaper.

### Full Customization (15 minutes)

1. Follow Minimal Setup above
2. **Page 3 (Blur Effects)**:
    - Set **Blur radius** (try 30px)
    - Adjust **Saturation** (try 1.2)
    - Fine-tune **Blur opacity** (try 0.8)
    - Adjust **Shadow strength** (try 0.4 for balanced shadow)
3. **Page 2** (return here):
    - Experiment with **Override panel color** if needed
    - Fine-tune **Zorin Theme Tint Strength** (lower for neutral grey backgrounds)
4. **Page 4** (Advanced):
    - Try different **Zorin Menu Layout** styles (MINT, APP_GRID, etc.)
5. **Test**: Change wallpaper and watch auto-extraction work!

---

### Performance Tips

- Lower **Blur radius** (< 25px) for better performance on older hardware
- Use **Shadow strength** of 0.4 or lower for subtle depth without performance impact
- Disable **Enable debug logging** after setup (reduces CPU usage)
- Use **Apply Changes Now** sparingly (auto-update is more efficient)
- **Icon Theme Override**: Only enable if needed (reduces theme complexity)

---

## 🐛 Troubleshooting

### Overlay looks broken or messed up

**Symptom:** Theme appears corrupted, colors wrong, or UI elements broken

**Solution (Full Reset):**

1. **Disable Overlay**: Open CSS Gnomme settings → Turn OFF "Enable Overlay Theme"
2. **Choose Base Theme**: Go to Zorin Appearance settings → Select the theme you want
3. **Select in Extension**: Open CSS Gnomme settings → Choose same theme in "Base Theme" dropdown
4. **Enable Overlay**: Turn ON "Enable Overlay Theme"
5. **Recreate**: Click "Recreate Overlay Theme" button

**Also Try (if above doesn't help):**

- Try **Enable/Disable toggle** several times (sometimes one cycle is enough)
- Or use **Apply Changes Now** button to force refresh

### Colors not extracting

**Symptom:** "No background image found" notification

**Solution:**

1. Verify wallpaper is set in **Settings → Background**
2. Click **Extract Colors Now** (Page 1)
3. Enable **Auto-detect colors on wallpaper change**

### Blur not visible

**Symptom:** Transparency works but no blur effect

**Solution:**

1. Increase **Blur radius** to 30-40px (Page 3)
2. Lower **Menu Opacity** to 0.7-0.8 (Page 2)
3. Check **Blur opacity** is not 0.0 (Page 3)

### Shadow not working

**Symptom:** No drop shadow visible under panels/menus

**Solution:**

1. Set **Border width** to 0 (Page 3) - shadows only work when border is disabled
2. Increase **Shadow strength** to 0.4 or higher (Page 3)
3. Check **Shadow color** is visible against your wallpaper (Page 3)

### Icons missing or broken

**Symptom:** Some icons don't display in menus or panels (common with Fluent GTK themes)

**Solution:**

1. **Page 4 (Advanced)**: Enable **Icon Theme Override**
2. Select matching icon theme from **Icon Theme** dropdown (e.g., Fluent-dark-Icons)
3. **Page 1**: Click **Recreate Overlay Theme** to apply icon changes
4. If icons still missing, ensure icon theme is installed in `~/.icons` or `/usr/share/icons`

### Theme reverts after reboot

**Symptom:** CSS Gnomme overlay resets to original theme

**Solution:**

1. Check **Enable Overlay Theme** is ON (Page 1)
2. Verify `~/.themes/CSSGnomme/` directory exists
3. Click **Recreate Overlay Theme** (Page 1)

### Settings not applying

**Symptom:** Changes made but no visual update

**Solution:**

1. Click **Apply Changes Now** (Page 1)
2. Restart GNOME Shell: `Alt+F2` → type `r` → Enter (X11 only)
3. On Wayland: Log out and log back in

---

## 🎁 What's New in v2.5.3

### ✨ Major Fixes & Features

- **🔧 Shadow Strength Now Works!** - Fixed non-functional slider (bug since v2.0!)
  - New formula: `baseShadow = shadowStrength × 30` with ratio-based scaling
  - Range expanded: 0.0-1.0 (was 0.0-0.8)
  - Examples: 0.0 = no shadow, 0.4 = default (12px), 1.0 = max glow (30px)
  - Instant updates without overlay recreation

- **🎭 Manual Icon Theme Override** - Select icon theme independently from GTK theme
  - Fixes missing icons for themes without matching icon packs (e.g., Fluent GTK)
  - Scans `~/.icons`, `~/.local/share/icons`, `/usr/share/icons` with validation
  - Auto-detect fallback when disabled (default behavior)
  - Location: Page 4 → Advanced Settings → Interface Behavior

- **📐 Preferences UI Reorganization** - Cleaner layout with logical grouping
  - Theme Overlay page simplified (removed Zorin/Icon controls)
  - Advanced Settings enhanced (Zorin features + Icon override grouped together)
  - Removed verbose "How It Works" info rows from individual pages

### 🎛️ Other Recent Improvements (v2.5.0-v2.5.2)

- **Zorin Menu Layout Control** (v2.5.2) - Choose from 5 layout styles (MINT, APP_GRID, etc.)
- **Quick Settings Border-Radius Sync** (v2.5.1) - Matches panel border-radius automatically
- **Minimal Mode** (v2.5.0) - Wallpaper accent limited to core widgets only
- **Constants Refactoring** (v2.5.0) - Eliminated 35+ magic numbers across codebase

---

## 📚 Additional Resources

- **GitHub Repository**: [github.com/drdrummie/CSSGnomme-ZorinOS18](https://github.com/drdrummie/CSSGnomme-ZorinOS18)
- **Issue Tracker**: Report bugs or request features
- **Full Documentation**: See README.md for technical details

---

**Enjoy your customized GNOME Shell experience!** 🎨✨
