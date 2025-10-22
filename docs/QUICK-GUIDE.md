# Quick Start Guide

## Installation

1. Install from extensions.gnome.org or manually
2. Enable extension: `gnome-extensions enable cssgnomme@dr.drummie`
3. Restart GNOME Shell (Alt+F2 → 'r' on X11)

## First Steps

### Enable Overlay Theme

1. Click CSSGnomme icon in system tray
2. Toggle "Enable Overlay Theme"
3. Theme overlay activates in 2-3 seconds

### Extract Colors

1. Open extension menu
2. Click "Extract Colors from Wallpaper"
3. Wait 1-2 seconds for extraction
4. Colors auto-apply to panel and menus

### Customize Settings

Open Preferences (menu or GNOME Extensions app):

**Panel Tab:**

-   Adjust opacity slider (0-100%)
-   Enable/disable apply blur
-   Set border radius (0-25px)

**Blur Tab:**

-   Blur radius (1-50px)
-   Saturation (0.4-2.0)
-   Contrast (0.4-2.0)
-   Brightness (0.4-2.0)

**Colors Tab:**

-   View extracted colors
-   Manual color pickers (border, background)
-   Auto-extract on wallpaper change

**Zorin Tab (ZorinOS 18 only):**

-   Panel margin (0-32px) - floating mode
-   Border radius (0-25px)
-   Sync opacity with Zorin Taskbar

## Tips

-   **Faster extraction:** Use smaller wallpapers (1920x1080 vs 4K)
-   **Better performance:** Lower blur radius (5-15px optimal)
-   **Clean look:** Match border radius on panel and blur
-   **ZorinOS floating mode:** Set panel margin to 8-16px

## Common Issues

**Colors too dark/bright:**

-   Theme auto-detects light/dark mode
-   Try different wallpaper with better color contrast

**Panel not visible:**

-   Increase opacity (minimum ~20% for visibility)
-   Check if overlay theme is enabled

**Blur not working:**

-   Ensure "Apply Blur" is enabled in Panel tab
-   Some themes may not support backdrop-filter

**Extension menu missing:**

-   Restart GNOME Shell
-   Check if extension is enabled: `gnome-extensions list --enabled`

## Advanced

**Clear cache:**
Preferences → Advanced → Clear Theme Cache

**Debug mode:**
Edit `~/.local/share/gnome-shell/extensions/cssgnomme@dr.drummie/constants.js`
Set `DEBUG_MODE_ENABLED = true`

**Logs:**

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep CSSGnomme
```

**Reset settings:**

```bash
dconf reset -f /org/gnome/shell/extensions/cssgnomme/
```

## Next Steps

-   Experiment with different blur settings
-   Try light/dark theme toggle
-   Check color extraction with various wallpapers
-   Explore ZorinOS integration (if available)

Enjoy your customized GNOME desktop!
