/**
 * VibrationPWA - Main Application Class
 * Orchestrates all components of the Vibration PWA
 */

class VibrationPWA {
    constructor() {
        // Get DOM elements
        this.vibrateBtn = document.getElementById('vibrateBtn');
        this.status = document.getElementById('status');
        this.debugInfo = document.getElementById('debugInfo');
        this.installPrompt = document.getElementById('installPrompt');
        this.installBtn = document.getElementById('installBtn');
        this.closeBtn = document.getElementById('closeBtn');
        this.swStatus = document.getElementById('swStatus');
        
        // Initialize components
        this.vibrationHandler = null;
        this.pwaManager = null;
        this.backgroundAnimationInterval = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }

    initializeApp() {
        // Initialize component managers
        this.vibrationHandler = new VibrationHandler(
            this.vibrateBtn,
            this.status,
            this.debugInfo
        );

        this.pwaManager = new PWAManager(
            this.installPrompt,
            this.installBtn,
            this.closeBtn,
            this.swStatus
        );

        // Setup additional event listeners
        this.setupGlobalEventListeners();
        
        // Initialize background animation
        this.createBackgroundAnimation();
        
        // Handle URL-based vibration trigger
        this.handleUrlVibration();
        
        // Show PWA install prompt for iOS after delay
        this.handleIOSInstallPrompt();
        
        Utils.log('Vibration PWA initialized successfully');
    }

    setupGlobalEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && navigator.vibrate) {
                navigator.vibrate(0); // Stop any ongoing vibration when page is hidden
            }
        });

        // Handle URL-based vibration
        window.addEventListener('urlVibrate', () => {
            this.vibrationHandler.quickVibrate();
        });

        // Handle keyboard shortcuts (for desktop)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (!this.vibrationHandler.isVibrating) {
                    this.vibrationHandler.startVibration();
                    setTimeout(() => {
                        this.vibrationHandler.stopAllVibration();
                    }, 500);
                }
            }
        });

        // Handle app focus/blur
        window.addEventListener('focus', () => {
            Utils.log('App gained focus');
        });

        window.addEventListener('blur', () => {
            Utils.log('App lost focus');
            this.vibrationHandler.stopAllVibration();
        });
    }

    createBackgroundAnimation() {
        const backgroundAnim = document.querySelector('.background-animation');
        
        this.backgroundAnimationInterval = setInterval(() => {
            if (!this.vibrationHandler.isVibrating && Math.random() > 0.7) {
                Utils.createWave(
                    Math.random() * 100,  // x position (%)
                    Math.random() * 100,  // y position (%)
                    50,                   // size (px)
                    backgroundAnim
                );
            }
        }, 2000);
    }

    handleUrlVibration() {
        const urlParams = Utils.getUrlParams();
        if (urlParams.action === 'vibrate') {
            setTimeout(() => {
                this.vibrationHandler.quickVibrate();
            }, 500);
        }
    }

    handleIOSInstallPrompt() {
        // Show install prompt for iOS Safari (after delay)
        if (Utils.isIOS() && !Utils.isStandalone() && !this.pwaManager.isInstalled) {
            setTimeout(() => {
                this.pwaManager.showInstallPrompt();
            }, 5000);
        }
    }

    // Public API methods for external access
    getVibrationHandler() {
        return this.vibrationHandler;
    }

    getPWAManager() {
        return this.pwaManager;
    }

    // Method to trigger vibration programmatically
    vibrate(pattern = [200, 100, 200]) {
        this.vibrationHandler.quickVibrate(pattern);
    }

    // Method to toggle debug mode
    toggleDebug() {
        this.vibrationHandler.toggleDebugMode();
    }

    // Method to get app status
    getAppStatus() {
        return {
            vibrationSupported: !!navigator.vibrate,
            isVibrating: this.vibrationHandler.isVibrating,
            activeTouches: this.vibrationHandler.activeTouches.size,
            pwaStatus: this.pwaManager.getInstallationStatus(),
            debugMode: this.vibrationHandler.debugMode
        };
    }

    // Cleanup method
    destroy() {
        if (this.backgroundAnimationInterval) {
            clearInterval(this.backgroundAnimationInterval);
        }
        this.vibrationHandler.stopAllVibration();
        Utils.log('Vibration PWA destroyed');
    }
}

// Global app instance
let vibrationApp = null;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    vibrationApp = new VibrationPWA();
    
    // Make app available globally for debugging
    if (typeof window !== 'undefined') {
        window.vibrationApp = vibrationApp;
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (vibrationApp) {
        vibrationApp.destroy();
    }
});

// Export for module systems (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VibrationPWA;
}