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
        // This kills all ghost mouse events for the lifetime of the page.
        this.isTouchDevice = true;

        for (let touch of e.changedTouches) {
            const isInside = this.isTouchInsideButton(touch);

            this.activeTouches.set(touch.identifier, {
                isInside: isInside,
                x: touch.clientX,
                y: touch.clientY
            });

            if (isInside) {
                this.onTouchEnterButton(touch.identifier);
            }
        }

        this.updateDebugInfo();
    }

    handleTouchMove(e) {
        e.preventDefault();

        for (let touch of e.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                const touchState = this.activeTouches.get(touch.identifier);
                const wasInside = touchState.isInside;
                const isInside = this.isTouchInsideButton(touch);

                // Update touch position
                touchState.x = touch.clientX;
                touchState.y = touch.clientY;
                touchState.isInside = isInside;

                // Handle enter/exit events
                if (!wasInside && isInside) {
                    this.onTouchEnterButton(touch.identifier);
                } else if (wasInside && !isInside) {
                    this.onTouchExitButton(touch.identifier);
                }
            }
        }

        this.updateDebugInfo();
    }

    handleTouchEnd(e) {
        // Remove ended touches
        for (let touch of e.changedTouches) {
            this.activeTouches.delete(touch.identifier);
        }

        // Check if any remaining touches are inside the button
        const hasInsideTouch = Array.from(this.activeTouches.values())
            .some(touch => touch.isInside);

        // Debug logging
        if (this.debugMode) {
            console.log('Touch end. Remaining touches:', this.activeTouches.size, 'Inside:', hasInsideTouch);
        }

        // Only stop vibration if NO touches are inside (and we were vibrating)
        if (!hasInsideTouch && this.isVibrating) {
            this.stopVibration();
            this.vibrateBtn.classList.remove('active', 'hover');

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
    // Ghost mouse events are the #1 cause of "stuck vibration" on
    // mobile. The only reliable filter is the permanent isTouchDevice
    // flag set on first touchstart.
    // ---------------------------------------------------------------

    handleMouseDown(e) {
        if (this.isTouchDevice) return;

        const isInside = this.isMouseInsideButton(e);

        this.activeTouches.set('mouse', {
            isInside: isInside,
            x: e.clientX,
            y: e.clientY
        });

        if (isInside) {
            this.onTouchEnterButton('mouse');
        }

        this.updateDebugInfo();
    }

    handleMouseMove(e) {
        if (this.isTouchDevice) return;
        if (!this.activeTouches.has('mouse')) return;

        const touchState = this.activeTouches.get('mouse');
        const wasInside = touchState.isInside;
        const isInside = this.isMouseInsideButton(e);

        touchState.x = e.clientX;
        touchState.y = e.clientY;
        touchState.isInside = isInside;

        if (!wasInside && isInside) {
            this.onTouchEnterButton('mouse');
        } else if (wasInside && !isInside) {
            this.onTouchExitButton('mouse');
        }

        this.updateDebugInfo();
    }

    handleMouseUp(e) {
        if (this.isTouchDevice) return;
        if (!this.activeTouches.has('mouse')) return;

        if (this.isVibrating) {
            this.stopVibration();
            this.vibrateBtn.classList.remove('active', 'hover');
        }
        this.activeTouches.delete('mouse');

        this.updateDebugInfo();
    }

    isTouchInsideButton(touch) {
        const rect = this.vibrateBtn.getBoundingClientRect();
        return Utils.isPointInsideCircle(touch.clientX, touch.clientY, rect);
    }

    isMouseInsideButton(e) {
        const rect = this.vibrateBtn.getBoundingClientRect();
        return Utils.isPointInsideCircle(e.clientX, e.clientY, rect);
    }

    onTouchEnterButton(touchId) {
        if (!this.isVibrating) {
            this.startVibration();
        }
        this.vibrateBtn.classList.add('active', 'hover');
        this.createWaveEffect();
    }

    onTouchExitButton(touchId) {
        // Check if any other touches are still inside the button
        const hasInsideTouch = Array.from(this.activeTouches.values())
            .some(touch => touch.isInside);

        // Only stop vibration if no touches are inside the button
        if (!hasInsideTouch && this.isVibrating) {
            this.stopVibration();
            this.vibrateBtn.classList.remove('active', 'hover');
        }
    }

    startVibration() {
        if (this.isVibrating) return;

        this.isVibrating = true;
        this.vibrateBtn.classList.add('vibrating');

        if (navigator.vibrate) {
            if (this.debugMode) console.log('Starting pattern vibration');

            // Use a short repeating pattern instead of continuous vibration
            // 150ms on, 50ms off - much more robust and responsive to stop
            const success = navigator.vibrate([150, 50]);
            if (this.debugMode) console.log('Pattern vibrate success:', success);

            // Store pattern interval to keep it going
            this.vibrationInterval = setInterval(() => {
                if (this.isVibrating) {
                    navigator.vibrate([150, 50]);
                }
            }, 200);

            this.showStatus('Vibrating... 📳');
        } else {
            this.showStatus('Vibration not supported 😕');
        }
    }

    stopVibration() {
        this.isVibrating = false;
        this.vibrateBtn.classList.remove('vibrating');

        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }

        if (navigator.vibrate) {
            if (this.debugMode) console.log('Stopping vibration');

            // Use multiple stop methods for maximum compatibility
            navigator.vibrate(0);
            navigator.vibrate([]);

            // Add a short delay and try again (some devices need this)
            setTimeout(() => navigator.vibrate(0), 10);

            if (this.debugMode) console.log('Vibration stop signals sent');
        }

        this.showStatus('Stopped vibrating');
        setTimeout(() => {
            this.hideStatus();
        }, 2000);
    }

    stopAllVibration() {
        this.activeTouches.clear();
        this.stopVibration();
        this.vibrateBtn.classList.remove('active', 'hover');
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