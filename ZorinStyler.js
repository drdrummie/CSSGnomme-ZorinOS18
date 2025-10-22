/**
 * ZorinStyler.js
 *
 * CSS Gnommé Extension Module - GNOME 46+
 * Manages Zorin OS Taskbar integration
 */

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gio from "gi://Gio";
import Meta from "gi://Meta";
import St from "gi://St";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { GlobalSignalsHandler } from "./signalHandler.js";

/**
 * ZorinStyler - Manages Zorin OS taskbar panel styling
 * Integrates with Zorin OS Taskbar extension for transparency control
 * Only active when enable-zorin-integration setting is enabled
 */
export const ZorinStyler = GObject.registerClass(
    class ZorinStyler extends GObject.Object {
        /**
         * Initialize ZorinStyler
         * @param {Gio.Settings} settings - Extension settings object
         * @param {Logger} logger - Logger instance for standardized logging
         */
        _init(settings, logger = null) {
            super._init();

            this._settings = settings;
            this._zorinSettings = null;
            this._isConnected = false;
            this._signalsHandler = new GlobalSignalsHandler(); // Centralized signal management (ready for Master Mode)

            // Use provided logger or create fallback log function
            if (logger) {
                this._logger = logger;
            } else {
                // Fallback if no logger provided (shouldn't happen but safe)
                this._logger = {
                    info: msg => log(`[CSSGnomme:ZorinStyler:INFO] ${msg}`),
                    warn: msg => log(`[CSSGnomme:ZorinStyler:WARN] ${msg}`),
                    error: msg => log(`[CSSGnomme:ZorinStyler:ERROR] ${msg}`),
                    debug: msg => log(`[CSSGnomme:ZorinStyler:DEBUG] ${msg}`)
                };
            }

            this._connectToZorinSettings();
        }

        /**
         * Attempts to connect to Zorin Taskbar settings via GSettings
         */
        _connectToZorinSettings() {
            try {
                this._zorinSettings = new Gio.Settings({ schema: "org.gnome.shell.extensions.zorin-taskbar" });

                if (this._zorinSettings) {
                    this._isConnected = true;
                    this._logger.info("Successfully connected to Zorin Taskbar settings via GSettings");
                } else {
                    this._logger.warn("Could not access Zorin Taskbar GSettings");
                }
            } catch (error) {
                this._logger.error(`Error accessing Zorin Taskbar GSettings: ${error}`);
            }
        }

        /**
         * Updates panel opacity on Zorin Taskbar
         * @param {number} opacity - Opacity value (0.0 - 1.0)
         */
        updateOpacity(opacity) {
            if (!this._isConnected) return;

            this._zorinSettings.set_boolean("trans-use-custom-opacity", true);
            this._zorinSettings.set_double("trans-panel-opacity", opacity);

            this._logger.debug(`Panel opacity updated to: ${opacity}`);
        }

        /**
         * Sets dynamic opacity settings
         * @private
         */
        _updateDynamicOpacity() {
            if (!this._isConnected) return;

            this._zorinSettings.set_boolean("trans-use-dynamic-opacity", false);
        }

        /**
         * Sets base opacity settings
         * @private
         */
        _updateOpacity() {
            if (!this._isConnected) return;

            this._zorinSettings.set_boolean("trans-use-custom-opacity", true);
            const defaultOpacity = this._settings.get_double("panel-opacity");
            this._zorinSettings.set_double("trans-panel-opacity", defaultOpacity);
        }

        /**
         * Sync panel margin to Zorin Taskbar
         * Replaces legacy intellihide approach with direct panel-margin control
         * Border radius only makes sense when margin > 0 (floating mode)
         * @param {number} margin - Panel margin in pixels (0-20)
         */
        syncPanelMargin(margin) {
            if (!this._isConnected) {
                this._logger.warn("Zorin Taskbar not connected - cannot sync panel margin");
                return;
            }

            try {
                // Clamp to safe range
                const clampedMargin = Math.max(0, Math.min(20, margin));

                this._zorinSettings.set_int("panel-margin", clampedMargin);
                this._logger.debug(`Panel margin synced to Zorin: ${clampedMargin}px`);
            } catch (e) {
                this._logger.error(`Error syncing panel margin: ${e.message}`);
            }
        }

        /**
         * Sync border radius to Zorin Taskbar
         * Always syncs the radius value - Zorin handles visual effect based on panel layout
         * @param {number} radius - Border radius in pixels (0-25)
         */
        syncBorderRadius(radius) {
            if (!this._isConnected) {
                this._logger.warn("Zorin Taskbar not connected - cannot sync border radius");
                return;
            }

            try {
                // Clamp to CSSGnomme range (0-25 px)
                const clampedRadius = Math.max(0, Math.min(25, radius));

                // Zorin Taskbar uses multiplier (0-5), not pixels
                // globalBorderRadius * 5 = CSS class (br5, br10, br15, br20, br25)
                const zorinValue = Math.round(clampedRadius / 5);

                this._zorinSettings.set_int("global-border-radius", zorinValue);
                this._logger.debug(`Border radius synced to Zorin: ${clampedRadius}px (Zorin value: ${zorinValue})`);
            } catch (e) {
                this._logger.error(`Error syncing border radius: ${e.message}`);
            }
        }

        /**
         * Destroys the ZorinStyler instance
         */
        destroy() {
            // Disconnect all tracked signals
            if (this._signalsHandler) {
                this._signalsHandler.destroy();
                this._signalsHandler = null;
            }

            if (this._zorinSettings) {
                // GNOME Review Guidelines: run_dispose() necessary to immediately free GSettings
                // when Zorin Taskbar extension may be disabled/unloaded before CSSGnomme
                this._zorinSettings.run_dispose();
                this._zorinSettings = null;
            }
            this._isConnected = false;

            this._logger.info("ZorinStyler destroyed");
        }
    }
);
