# CSSGnomme - GNOME Shell Extension Makefile
# For manual installation from source

EXTENSION_UUID = cssgnomme@dr.drummie
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)

# Files to include in extension package
SOURCE_FILES = \
	extension.js \
	prefs.js \
	overlayThemeManager.js \
	colorPalette.js \
	ZorinStyler.js \
	cssTemplates.js \
	themeUtils.js \
	loggingUtils.js \
	constants.js \
	signalHandler.js \
	metadata.json

SCHEMA_DIR = schemas
LOCALE_DIR = locale

.PHONY: all build install clean package help

all: build

help:
	@echo "CSSGnomme Extension - Available targets:"
	@echo ""
	@echo "  make build      - Compile GSettings schema"
	@echo "  make install    - Install extension to user directory"
	@echo "  make clean      - Remove compiled schema"
	@echo "  make package    - Create ZIP file for manual installation"
	@echo "  make uninstall  - Remove extension from user directory"
	@echo ""
	@echo "After installation, restart GNOME Shell:"
	@echo "  X11:     Press Alt+F2, type 'r', press Enter"
	@echo "  Wayland: Log out and log back in"

# Compile GSettings schema
build:
	@echo "Compiling GSettings schema..."
	glib-compile-schemas $(SCHEMA_DIR)/

# Install extension to user directory
install: build
	@echo "Installing extension to $(INSTALL_DIR)..."
	@mkdir -p $(INSTALL_DIR)
	@cp $(SOURCE_FILES) $(INSTALL_DIR)/
	@cp -r $(SCHEMA_DIR) $(INSTALL_DIR)/
	@cp -r $(LOCALE_DIR) $(INSTALL_DIR)/
	@echo ""
	@echo "✅ Extension installed successfully!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Restart GNOME Shell (Alt+F2 → r on X11, or log out/in on Wayland)"
	@echo "  2. Enable extension: gnome-extensions enable $(EXTENSION_UUID)"
	@echo "  3. Configure: gnome-extensions prefs $(EXTENSION_UUID)"

# Remove extension from user directory
uninstall:
	@echo "Uninstalling extension..."
	@rm -rf $(INSTALL_DIR)
	@echo "✅ Extension uninstalled."

# Create ZIP package for manual installation
package: build
	@echo "Creating ZIP package..."
	@zip -r $(EXTENSION_UUID).zip \
		$(SOURCE_FILES) \
		$(SCHEMA_DIR) \
		$(LOCALE_DIR) \
		-x "*.po" "*.pot" "*.md"
	@echo ""
	@echo "✅ Package created: $(EXTENSION_UUID).zip"
	@echo ""
	@echo "To install manually:"
	@echo "  1. Extract to: ~/.local/share/gnome-shell/extensions/$(EXTENSION_UUID)/"
	@echo "  2. Restart GNOME Shell"
	@echo "  3. Enable extension: gnome-extensions enable $(EXTENSION_UUID)"

# Clean compiled files
clean:
	@echo "Cleaning compiled files..."
	@rm -f $(SCHEMA_DIR)/gschemas.compiled
	@rm -f $(EXTENSION_UUID).zip
	@echo "✅ Clean complete."
