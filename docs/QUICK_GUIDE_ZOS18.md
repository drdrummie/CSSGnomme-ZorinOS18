# 🚀 CSS Gnomme Quick Guide (ZorinOS 18)

**Version:** v2.3-dev (GNOME 46+)
**Last Updated:** October 22, 2025

---

## 📖 What is CSS Gnomme?

CSS Gnomme is a powerful GNOME Shell extension that creates a **dynamic overlay theme** on top of your existing GTK theme. It automatically extracts colors from your wallpaper, applies custom transparency and blur effects, and enhances your desktop appearance—all **completely reversible** without modifying your original themes.

**Key Features:**

- 🎨 **Automatic color extraction** from your wallpaper
- 🌫️ **Advanced blur effects** for panels and menus
- 🔄 **Dynamic theme overlay** that adapts to your background
- 🖥️ **Zorin OS integration** for seamless taskbar styling
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

- **Overlay Status**: Shows current state and location of generated theme files
  - Active: `~/.themes/CSSGnomme/` exists and is loaded
  - Inactive: Original theme is active

- **Enable Zorin OS Integration**: Special enhancements for Zorin Taskbar
  - Syncs panel margin, border radius, and opacity with Zorin Taskbar
  - Adds floating panel styling for Fluent-based themes
  - **Recommended:** Enable if you're using Zorin OS 18

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

#### Panel Appearance

- **Panel Margin** (0 - 32px): Horizontal spacing from screen edges
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

- **Apply border radius to main panel**: Control whether panel itself gets rounded
  - ✅ ON: Panel has rounded corners (looks best with Panel Margin > 0)
  - ❌ OFF: Only menus/popups are rounded (recommended for Panel Margin = 0)

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
  - **0px**: No border (strong box shadow also used as "styling mode" switch)
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

#### Shadow Effects

- **Shadow strength** (0.0 - 0.8): Intensity of drop shadow
  - **0.0**: No shadow
  - **0.3-0.5**: Subtle depth
  - **0.8**: Strong, dramatic shadow
  - Adds depth perception to panels and menus

- **Shadow color**: Color of drop shadow
  - Automatically set based on theme (dark shadow for light themes, vice versa)
  - Customize for specific aesthetic (e.g., colored shadows)

---

### ⚙️ Page 4: Advanced

**Power-user settings and debugging options.**

#### System Tray

- **Hide system tray indicator**: Remove CSS Gnomme icon from top panel
  - Settings still accessible via Extensions app
  - **Use case:** Minimize clutter after setup is complete

#### Theme Filtering

- **Auto-switch color scheme**: Automatically switch between Light/Dark theme variants
  - ✅ ON: Detects system Dark Mode toggle, switches to matching theme variant
  - Example: ZorinPurple-Light ↔ ZorinPurple-Dark
  - **Note:** Dropdown will only show matching variants (Light OR Dark, not both)

#### Full Auto Mode

- **Full Auto Mode**: Enable all automation features at once
  - Activates: Auto color extraction + Auto theme switching
  - **Recommended:** Turn on for "set it and forget it" experience

#### Debugging

- **Enable debug logging**: Detailed console logs for troubleshooting
  - View logs with: `journalctl -f -o cat /usr/bin/gnome-shell | grep CSSGnomme`
  - Or use: `make logs` from extension directory
  - **Warning:** Increases log verbosity significantly

---

### ℹ️ Page 5: About

**Project information, version, and How It Works explanation.**

- **Version**: Current extension version
- **Links**: GitHub repository, issue tracker, documentation
- **How It Works**: Detailed explanation of overlay system, color extraction, and CSS generation

---

## 🎯 Quick Setup Workflow

### Minimal Setup (5 minutes)

1. **Page 1 (Theme Overlay)**:
   - ✅ Enable **Enable Overlay Theme**
   - ✅ Enable **Enable Zorin OS Integration** (if on Zorin OS)
   - ✅ Enable **Auto-detect colors on wallpaper change**
   - Select your preferred **Base Theme**

2. **Page 2 (Color Settings)**:
   - Adjust **Panel Opacity** (try 0.85)
   - Set **Panel Margin** (try 8px for floating effect)
   - Adjust **Border Radius** (try 12px)

3. **Done!** Colors will auto-extract from wallpaper.

### Full Customization (15 minutes)

1. Follow Minimal Setup above
2. **Page 3 (Blur Effects)**:
   - Set **Blur radius** (try 30px)
   - Adjust **Saturation** (try 1.2)
   - Fine-tune **Blur opacity** (try 0.8)
3. **Page 2** (return here):
   - Experiment with **Override panel color** if needed
4. **Test**: Change wallpaper and watch auto-extraction work!

---

## 💡 Pro Tips

### Best Blur Settings

For **frosted glass effect** (macOS-style):

- Blur radius: 30-35px
- Saturation: 1.2-1.3
- Contrast: 0.9-1.0
- Brightness: 1.1 (light themes) / 0.9 (dark themes)
- Blur opacity: 0.8-0.9

For **subtle transparency** (Windows 11-style):

- Blur radius: 15-20px
- Saturation: 1.0-1.1
- Contrast: 1.0
- Brightness: 1.0
- Blur opacity: 0.6-0.7

### Floating Panel Tips

- Set **Panel Margin** to 8-12px
- Enable **Apply border radius to main panel**
- Set **Border Radius** to 12-15px
- Adjust **Panel Opacity** to 0.8-0.9
- Result: Modern floating taskbar (Zorin/macOS style)

### Color Extraction Tips

- **Too dark?** Increase **Brightness multiplier** (Blur Effects page)
- **Too colorful?** Lower **Saturation multiplier**
- **Wrong colors?** Click **Extract Colors Now** to re-analyze wallpaper
- **Manual override?** Disable auto-extraction, use **Override panel color**

### Performance Tips

- Lower **Blur radius** (< 25px) for better performance on older hardware
- Disable **Enable debug logging** after setup (reduces CPU usage)
- Use **Apply Changes Now** sparingly (auto-update is more efficient)

---

## 🐛 Troubleshooting

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

## 📚 Additional Resources

- **GitHub Repository**: [github.com/drdrummie/CSSGnomme-ZorinOS18](https://github.com/drdrummie/CSSGnomme-ZorinOS18)
- **Issue Tracker**: Report bugs or request features
- **Full Documentation**: See `README.md` for technical details

---

**Enjoy your customized GNOME Shell experience!** 🎨✨
