// signalHandler.js - Global Signal Management
// Pattern adopted from zorin-taskbar@zorinos.com/utils.js

import GObject from "gi://GObject";

/**
 * GlobalSignalsHandler - Centralized signal connection management
 *
 * Handles signal connections with automatic tracking and cleanup.
 * Prevents memory leaks by ensuring all signals are properly disconnected.
 *
 * Usage:
 *   this._signalsHandler = new GlobalSignalsHandler();
 *
 *   // Add single signal
 *   this._signalsHandler.add(
 *       [object, 'signal-name', callback]
 *   );
 *
 *   // Add multiple signals to same object
 *   this._signalsHandler.add(
 *       [object, ['signal-1', 'signal-2'], callback]
 *   );
 *
 *   // Add many signals at once
 *   this._signalsHandler.add(
 *       [obj1, 'signal-a', callbackA],
 *       [obj2, 'signal-b', callbackB],
 *       [obj3, ['signal-c', 'signal-d'], callbackC]
 *   );
 *
 *   // Cleanup - disconnect all tracked signals
 *   this._signalsHandler.destroy();
 *
 * @class GlobalSignalsHandler
 */
export class GlobalSignalsHandler {
    /**
     * Create new signal handler
     */
    constructor() {
        this._signals = [];
    }

    /**
     * Add signal connections to tracking
     *
     * Accepts variable number of signal definitions. Each definition is an array:
     * - [object, signalName, callback] - Single signal
     * - [object, [signalNames...], callback] - Multiple signals to same callback
     *
     * All connections are automatically tracked for cleanup.
     *
     * @param {...Array} signals - Signal definitions to add
     *
     * @example
     * // Single signal
     * handler.add([settings, 'changed::key', () => this._onSettingChanged()]);
     *
     * @example
     * // Multiple signals
     * handler.add(
     *     [Main.overview, 'showing', () => this._onShow()],
     *     [Main.overview, 'hiding', () => this._onHide()]
     * );
     *
     * @example
     * // Multiple signal names to same callback
     * handler.add([settings, ['changed::key1', 'changed::key2'], () => this._update()]);
     */
    add(...signals) {
        signals.forEach(entry => {
            let object = entry[0];
            let signalNames = entry[1];
            let callback = entry[2];

            // Ensure signalNames is array
            if (!Array.isArray(signalNames)) {
                signalNames = [signalNames];
            }

            // Connect each signal and track connection ID
            signalNames.forEach(signal => {
                if (!object || !signal || !callback) {
                    console.warn("[GlobalSignalsHandler] Invalid signal entry:", entry);
                    return;
                }

                try {
                    let signalId = object.connect(signal, callback);
                    this._signals.push({ object, signalId });
                } catch (e) {
                    console.error(`[GlobalSignalsHandler] Failed to connect signal '${signal}':`, e.message);
                }
            });
        });
    }

    /**
     * Remove specific signal connection
     *
     * @param {GObject.Object} object - Object that emitted the signal
     * @param {number} signalId - Signal connection ID to remove
     */
    remove(object, signalId) {
        const index = this._signals.findIndex(s => s.object === object && s.signalId === signalId);
        if (index !== -1) {
            try {
                if (object && signalId) {
                    object.disconnect(signalId);
                }
            } catch (e) {
                console.warn("[GlobalSignalsHandler] Failed to disconnect signal:", e.message);
            }
            this._signals.splice(index, 1);
        }
    }

    /**
     * Remove all signals from specific object
     *
     * @param {GObject.Object} object - Object to disconnect all signals from
     */
    removeAll(object) {
        const toRemove = this._signals.filter(s => s.object === object);
        toRemove.forEach(({ signalId }) => this.remove(object, signalId));
    }

    /**
     * Disconnect all tracked signals and clear tracking
     *
     * MUST be called in destroy() method to prevent memory leaks!
     */
    destroy() {
        this._signals.forEach(({ object, signalId }) => {
            try {
                if (object && signalId) {
                    object.disconnect(signalId);
                }
            } catch (e) {
                // Object may already be destroyed - that's OK
                console.debug("[GlobalSignalsHandler] Signal already disconnected:", e.message);
            }
        });
        this._signals = [];
    }

    /**
     * Check if handler has any tracked signals
     * @returns {boolean} True if signals are tracked
     */
    hasSignals() {
        return this._signals.length > 0;
    }

    /**
     * Get count of tracked signals
     * @returns {number} Number of tracked signal connections
     */
    getSignalCount() {
        return this._signals.length;
    }
}
