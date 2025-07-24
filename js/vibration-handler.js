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
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkVibrationSupport();
    }

    setupEventListeners() {
        // Global touch events to track finger movement anywhere on screen
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));

        // Mouse events for desktop testing
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // Handle app state changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllVibration();
            }
        });

        // Debug toggle (double tap title)
        let tapCount = 0;
        document.querySelector('.title').addEventListener('click', () => {
            tapCount++;
            if (tapCount === 2) {
                this.debugMode = !this.debugMode;
                this.updateDebugInfo();
                tapCount = 0;
            }
            setTimeout(() => tapCount = 0, 500);
        });

        // Prevent context menu on long press
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    handleTouchStart(e) {
        e.preventDefault();
        
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
        for (let touch of e.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                const touchState = this.activeTouches.get(touch.identifier);
                
                // Always stop vibration when a touch is lifted, regardless of position
                if (this.isVibrating) {
                    this.stopVibration();
                    this.vibrateBtn.classList.remove('active', 'hover');
                }
                
                this.activeTouches.delete(touch.identifier);
            }
        }

        this.updateDebugInfo();
    }

    // Mouse events for desktop (simulate single touch)
    handleMouseDown(e) {
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
        if (this.activeTouches.has('mouse')) {
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
    }

    handleMouseUp(e) {
        if (this.activeTouches.has('mouse')) {
            const touchState = this.activeTouches.get('mouse');
            
            // Always stop vibration when mouse is lifted, regardless of position
            if (this.isVibrating) {
                this.stopVibration();
                this.vibrateBtn.classList.remove('active', 'hover');
            }
            this.activeTouches.delete('mouse');
        }

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
            // Continuous vibration pattern
            this.vibrationInterval = setInterval(() => {
                navigator.vibrate(50);
            }, 100);
            
            this.showStatus('Vibrating... 📳');
        } else {
            this.showStatus('Vibration not supported 😕');
        }
    }

    stopVibration() {
        if (!this.isVibrating) return;
        
        this.isVibrating = false;
        this.vibrateBtn.classList.remove('vibrating');
        
        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
        
        if (navigator.vibrate) {
            navigator.vibrate(0);
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

        this.debugInfo.innerHTML = `
            Active Touches: ${touches.length}<br>
            Vibrating: ${this.isVibrating}<br>
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
}