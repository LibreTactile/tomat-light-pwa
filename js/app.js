/**
 * VibrationPWA - Main Application Class with WebRTC Support
 * Orchestrates all components of the Vibration PWA including peer connections
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
        
        // WebRTC elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.webrtcControls = document.getElementById('webrtcControls');
        this.reconnectBtn = document.getElementById('reconnectBtn');
        this.debugBtn = document.getElementById('debugBtn');
        
        // Initialize components
        this.vibrationHandler = null;
        this.pwaManager = null;
        this.webrtcManager = null;
        this.backgroundAnimationInterval = null;
        this.debugMode = false;
        
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

        // Initialize WebRTC manager
        this.webrtcManager = new WebRTCManager(
            (isConnected, state) => this.onConnectionChange(isConnected, state),
            (data) => this.onDataReceived(data)
        );

        // Setup additional event listeners
        this.setupGlobalEventListeners();
        this.setupWebRTCEventListeners();
        
        // Initialize background animation
        this.createBackgroundAnimation();
        
        // Handle URL-based vibration trigger
        this.handleUrlVibration();
        
        // Show PWA install prompt for iOS after delay
        this.handleIOSInstallPrompt();
        
        Utils.log('Vibration PWA with WebRTC initialized successfully');
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
                    this.triggerVibration();
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

    setupWebRTCEventListeners() {
        // Reconnect button
        this.reconnectBtn.addEventListener('click', () => {
            this.reconnectWebRTC();
        });

        // Debug button
        this.debugBtn.addEventListener('click', () => {
            this.toggleDebugMode();
        });

    }

    onConnectionChange(isConnected, state) {
        // Update connection status UI
        this.updateConnectionStatus(isConnected, state);
        
        // Show/hide WebRTC controls
        this.webrtcControls.style.display = 'block';
        
        // Update vibration handler with connection status
        if (this.vibrationHandler) {
            this.vibrationHandler.setWebRTCStatus(isConnected);
        }
        
        Utils.log(`WebRTC connection changed: ${isConnected} (${state})`);
    }

    onDataReceived(data) {
        Utils.log('Received data from peer:', data);
        
        // Handle different types of incoming data
        switch (data.type) {
            case 'control':
                // Handle control commands
                this.handleControlCommand(data);
                break;
                
            default:
                Utils.log('Unknown data type received:', data.type);
        }
    }

    updateConnectionStatus(isConnected, state) {
        const indicators = {
            'new': '⚫',
            'connecting': '🟡',
            'connected': '🟢',
            'disconnected': '🔴',
            'failed': '❌',
            'closed': '⚫'
        };
        
        const messages = {
            'new': 'Initializing...',
            'connecting': 'Connecting to peer...',
            'connected': 'Connected to navigator',
            'disconnected': 'Disconnected',
            'failed': 'Connection failed',
            'closed': 'Connection closed'
        };
        
        this.statusIndicator.textContent = indicators[state] || '⚫';
        this.statusText.textContent = messages[state] || 'Unknown state';
        
        // Update connection status styling
        this.connectionStatus.className = `connection-status ${state}`;
    }

    handleControlCommand(data) {
        switch (data.command) {
            case 'ping':
                // Respond to ping
                if (this.webrtcManager) {
                    this.webrtcManager.sendData({
                        type: 'control',
                        command: 'pong',
                        timestamp: Date.now()
                    });
                }
                break;
                
            case 'vibrate_pattern':
                if (data.pattern) {
                    this.vibrationHandler.quickVibrate(data.pattern);
                }
                break;
                
            default:
                Utils.log('Unknown control command:', data.command);
        }
    }

    async reconnectWebRTC() {
        this.statusText.textContent = 'Reconnecting...';
        this.statusIndicator.textContent = '🟡';
        
        try {
            if (this.webrtcManager) {
                await this.webrtcManager.restart();
            }
        } catch (error) {
            console.error('Failed to reconnect WebRTC:', error);
            this.statusText.textContent = 'Reconnection failed';
            this.statusIndicator.textContent = '❌';
        }
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        
        if (this.debugMode) {
            this.showDebugInfo();
            this.debugBtn.textContent = '🐛 Hide Debug';
        } else {
            this.debugInfo.style.display = 'none';
            this.debugBtn.textContent = '🐛 Debug';
        }
    }

    showDebugInfo() {
        const webrtcStatus = this.webrtcManager ? this.webrtcManager.getConnectionStatus() : null;
        const vibrationStatus = this.vibrationHandler ? this.vibrationHandler.getStatus() : null;
        
        const debugData = {
            timestamp: new Date().toISOString(),
            webrtc: webrtcStatus,
            vibration: vibrationStatus,
            userAgent: navigator.userAgent,
            screen: {
                width: screen.width,
                height: screen.height,
                orientation: screen.orientation?.type || 'unknown'
            }
        };
        
        this.debugInfo.innerHTML = `
            <h3>Debug Information</h3>
            <pre>${JSON.stringify(debugData, null, 2)}</pre>
        `;
        this.debugInfo.style.display = 'block';
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

    getWebRTCManager() {
        return this.webrtcManager;
    }

    // Method to trigger vibration programmatically
    vibrate(pattern = [200, 100, 200]) {
        this.vibrationHandler.quickVibrate(pattern);
    }

    // Method to send data to connected peer
    sendToPeer(data) {
        if (this.webrtcManager && this.webrtcManager.isConnected) {
            return this.webrtcManager.sendData(data);
        }
        return false;
    }

    // Method to get app status
    getAppStatus() {
        const webrtcStatus = this.webrtcManager ? this.webrtcManager.getConnectionStatus() : null;
        
        return {
            vibrationSupported: !!navigator.vibrate,
            isVibrating: this.vibrationHandler.isVibrating,
            activeTouches: this.vibrationHandler.activeTouches.size,
            pwaStatus: this.pwaManager.getInstallationStatus(),
            webrtcStatus: webrtcStatus,
            debugMode: this.debugMode
        };
    }

    // Cleanup method
    destroy() {
        if (this.backgroundAnimationInterval) {
            clearInterval(this.backgroundAnimationInterval);
        }
        
        if (this.vibrationHandler) {
            this.vibrationHandler.stopAllVibration();
        }
        
        if (this.webrtcManager) {
            this.webrtcManager.cleanup();
        }
        
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