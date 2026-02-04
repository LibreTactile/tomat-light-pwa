/**
 * VibrationHandler - Manages vibration functionality and touch interactions
 */

class VibrationHandler {
    constructor(buttonElement, statusElement, debugElement) {
        this.vibrateBtn = buttonElement;
        this.status = statusElement;
        this.debugInfo = debugElement;

        // Touch tracking system
        this.activeTouches = new Map(); // Maps touch identifier to touch state
        this.isVibrating = false;
        this.vibrationInterval = null;
        this.debugMode = false;

        // Once the first touchstart fires anywhere on the page, this is permanently
        // set to true. From that point on, ALL mouse events are ignored. This is the
        // only reliable way to filter out ghost mouse events — mobile browsers fire
        // synthetic mousedown/mouseup after touch sequences, and the delay before they
        // fire is not consistent (can be 0–1000ms+ depending on device/OS/browser),
        // so any timer-based suppression window will eventually fail.
        this.isTouchDevice = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkVibrationSupport();
    }

    setupEventListeners() {
        // Global touch events to track finger movement anywhere on screen
        // Use { passive: false } to allow preventing default (scrolling)
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));

        // Mouse events for desktop testing (ignored entirely on touch devices)
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Handle app state changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllVibration();
            }
        });


        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleTouchStart(e) {

        // First touch on this page — permanently mark as touch device.
        this.isTouchDevice = true;

        for (let touch of e.changedTouches) {
            const target = this.getHapticTarget(touch.clientX, touch.clientY);

            this.activeTouches.set(touch.identifier, {
                target: target,
                x: touch.clientX,
                y: touch.clientY
            });

            if (target) {
                this.onTouchEnterButton(target);
            }
        }

        this.updateDebugInfo();
    }

    handleTouchMove(e) {
        e.preventDefault();

        for (let touch of e.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                const touchState = this.activeTouches.get(touch.identifier);
                const previousTarget = touchState.target;

                // Update coordinates
                touchState.x = touch.clientX;
                touchState.y = touch.clientY;

                // Find new target
                const newTarget = this.getHapticTarget(touch.clientX, touch.clientY);
                touchState.target = newTarget;

                // Handle transitions
                if (newTarget !== previousTarget) {
                    if (previousTarget) {
                        this.onTouchExitButton(previousTarget);
                    }
                    if (newTarget) {
                        this.onTouchEnterButton(newTarget);
                    }
                }
            }
        }

        this.updateDebugInfo();
    }

    handleTouchEnd(e) {
        // Remove ended touches
        for (let touch of e.changedTouches) {
            const touchState = this.activeTouches.get(touch.identifier);
            if (touchState && touchState.target) {
                this.onTouchExitButton(touchState.target);
            }
            this.activeTouches.delete(touch.identifier);
        }

        // Stop vibration if no active haptic touches remain
        const hasActiveHaptic = Array.from(this.activeTouches.values())
            .some(t => t.target !== null);

        if (!hasActiveHaptic) {
            this.stopVibration();

            // Explicitly stop hardware vibration
            if (navigator.vibrate) {
                navigator.vibrate(0);
                navigator.vibrate([]);
            }
        }

        this.updateDebugInfo();
    }

    // ---------------------------------------------------------------
    // Mouse handlers — all bail out immediately on touch devices.
    // ---------------------------------------------------------------

    handleMouseDown(e) {
        if (this.isTouchDevice) return;

        const target = this.getHapticTarget(e.clientX, e.clientY);

        this.activeTouches.set('mouse', {
            target: target,
            x: e.clientX,
            y: e.clientY
        });

        if (target) {
            this.onTouchEnterButton(target);
        }

        this.updateDebugInfo();
    }

    handleMouseMove(e) {
        if (this.isTouchDevice) return;
        if (!this.activeTouches.has('mouse')) return;

        const touchState = this.activeTouches.get('mouse');
        const previousTarget = touchState.target;

        touchState.x = e.clientX;
        touchState.y = e.clientY;

        const newTarget = this.getHapticTarget(e.clientX, e.clientY);
        touchState.target = newTarget;

        if (newTarget !== previousTarget) {
            if (previousTarget) {
                this.onTouchExitButton(previousTarget);
            }
            if (newTarget) {
                this.onTouchEnterButton(newTarget);
            }
        }

        this.updateDebugInfo();
    }

    handleMouseUp(e) {
        if (this.isTouchDevice) return;
        if (!this.activeTouches.has('mouse')) return;

        const touchState = this.activeTouches.get('mouse');
        if (touchState.target) {
            this.onTouchExitButton(touchState.target);
        }

        this.stopVibration();
        this.activeTouches.delete('mouse');

        this.updateDebugInfo();
    }

    getHapticTarget(x, y) {
        const element = document.elementFromPoint(x, y);
        if (!element) return null;

        // Look for data-haptic attribute or specific class
        const target = element.closest('[data-haptic="true"]');
        return target;
    }

    onTouchEnterButton(target) {
        // Pulse for button entry
        this.pulseVibration();

        if (target) {
            target.classList.add('active', 'hover');

            // Optional: Send data if it's an h-btn
            // This would likely go via a callback or event, but for now just visual/haptic
        }
        this.createWaveEffect();
    }

    onTouchExitButton(target) {
        if (target) {
            target.classList.remove('active', 'hover');
        }
    }

    pulseVibration() {
        this.isVibrating = true;
        // Pulse vibration for tactile feedback
        if (navigator.vibrate) {
            navigator.vibrate(50); // 50ms pulse as per spec
        }

        // Reset state after a short delay
        setTimeout(() => {
            this.isVibrating = false;
        }, 50);
    }

    startVibration() {
        // Legacy support or long press support - redirected to pulse for now
        this.pulseVibration();
    }

    stopVibration() {
        this.isVibrating = false;
        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
        // We don't necessarily stop navigator.vibrate(0) here because we want the pulse to finish naturally
        // unless it's a long vibration.
    }

    stopAllVibration() {
        // Clear active classes from all currently touched targets
        for (const state of this.activeTouches.values()) {
            if (state.target) {
                state.target.classList.remove('active', 'hover');
            }
        }

        this.activeTouches.clear();
        this.stopVibration();

        if (navigator.vibrate) {
            navigator.vibrate(0);
        }
    }

    checkVibrationSupport() {
        if (!navigator.vibrate) {
            this.showStatus('Vibration API not supported on this device');
        } else if (!window.isSecureContext) {
            this.showStatus('HTTPS required for vibration (Secure Context missing)');
        }
    }

    showStatus(message) {
        this.status.textContent = message;
        this.status.classList.add('show');
    }

    hideStatus() {
        this.status.classList.remove('show');
    }

    createWaveEffect() {
        const backgroundAnim = document.querySelector('.background-animation');
        Utils.createWave(50, 50, 100, backgroundAnim);
    }

    updateDebugInfo() {
        if (!this.debugMode) {
            this.debugInfo.classList.remove('show');
            return;
        }

        const touches = Array.from(this.activeTouches.entries());
        const touchInfo = touches.map(([id, state]) =>
            `${id}: ${state.isInside ? 'IN' : 'OUT'} (${Math.round(state.x)},${Math.round(state.y)})`
        ).join('\n');

        const debugContent = this.debugInfo.querySelector('#debugContent') || this.debugInfo;
        debugContent.innerHTML = `
            Active Touches: ${touches.length}<br>
            Vibrating: ${this.isVibrating}<br>
            Touch device: ${this.isTouchDevice}<br>
            ${touchInfo.replace(/\n/g, '<br>')}
        `;
        this.debugInfo.classList.add('show');
    }

    // Public method to trigger quick vibration (for shortcuts)
    quickVibrate(pattern = [200, 100, 200]) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
            this.showStatus('Quick vibrate! 📳');
            setTimeout(() => this.hideStatus(), 2000);
        }
    }

    // Toggle debug mode
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        this.updateDebugInfo();
    }

    // Direct test method (longer pulse)
    testVibration() {
        if (navigator.vibrate) {
            this.showStatus('Testing physical vibration (1s)...');
            const success = navigator.vibrate(1001);
            console.log('Test vibrate (1001ms) success:', success);
            setTimeout(() => this.hideStatus(), 2000);
            return success;
        }
        return false;
    }
}