# CSS Gnommé - Dynamic Theme Overlay

GNOME Shell extension for advanced panel transparency, blur effects, and wallpaper color extraction.

## Features

-   **Automatic Color Extraction** - Analyzes wallpaper and extracts dominant colors using K-means clustering
-   **Dynamic Theme Overlay** - Non-destructive theme system that inherits from your current GTK theme
-   **Advanced Blur Effects** - Full control over blur radius, saturation, contrast, and brightness
-   **Customizable Transparency** - Per-component opacity control (panel, menus, notifications)
-   **Panel Styling** - Border radius, shadows, and accent colors
-   **ZorinOS Integration** - Seamless integration with Zorin Taskbar (floating mode, border radius sync)

## Requirements

-   GNOME Shell 45, 46, or 47
-   ZorinOS 18 (recommended for full Zorin Taskbar integration)
-   Any modern Linux distribution with GNOME 46+

## Installation

### From extensions.gnome.org (Recommended)

Visit [extensions.gnome.org](https://extensions.gnome.org/) and search for "CSS Gnommé"

### Manual Installation

```bash
# Download latest release
wget https://github.com/drdrummie/CSSGnomme/releases/latest/download/cssgnomme@dr.drummie.zip

# Install extension
gnome-extensions install cssgnomme@dr.drummie.zip

# Enable extension
gnome-extensions enable cssgnomme@dr.drummie

# Restart GNOME Shell
# X11: Alt+F2, type 'r', press Enter
# Wayland: Log out and log back in
```

## Quick Start

1. Enable extension from GNOME Extensions app
2. Click CSSGnomme icon in system tray
3. Toggle "Enable Overlay Theme" to activate
4. Click "Extract Colors from Wallpaper" to customize
5. Adjust settings in Preferences to your liking

## Settings

Access preferences via:

-   Extension menu → "Open Preferences"
-   GNOME Extensions app → CSS Gnommé → Settings icon

Key settings:

-   **Panel Transparency** - Adjust opacity (0-100%)
-   **Blur Effects** - Customize radius, saturation, contrast
-   **Border Radius** - Round corners for modern look
-   **Color Extraction** - Manual or automatic on wallpaper change
-   **Zorin Panel Margin** - Enable floating mode (ZorinOS 18 only)

## Troubleshooting

**Extension not appearing after install:**

-   Restart GNOME Shell (Alt+F2 → 'r' on X11, or logout/login on Wayland)
-   Check if enabled: `gnome-extensions list --enabled | grep cssgnomme`

**Colors not extracting:**

-   Ensure wallpaper is set (not solid color background)
-   Try manual extraction via extension menu
-   Check logs: `journalctl -f -o cat /usr/bin/gnome-shell | grep CSSGnomme`

**Zorin integration not working:**

-   Ensure Zorin Taskbar extension is enabled
-   Check both extensions are on same GNOME Shell version
-   Restart GNOME Shell after enabling both

**Performance issues:**

-   Reduce blur radius (lower values = better performance)
-   Disable "Auto-extract on wallpaper change" if not needed
-   Clear cache via Preferences → Advanced → Clear Theme Cache

## Known Limitations

-   Overlay theme inherits from current GTK theme (some themes may have compatibility issues)
-   Color extraction requires valid image wallpaper (not solid colors or gradients)
-   Zorin Taskbar integration requires ZorinOS 18 / GNOME 46+

## Contributing

Bug reports and feature requests: [GitHub Issues](https://github.com/drdrummie/CSSGnomme/issues)

## License

GPL-2.0-or-later

## Credits

Developed by Dr. Drummie for ZorinOS 18 / GNOME 46+

Original color extraction pattern inspired by openbar extension.
