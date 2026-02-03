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
        this.messageLog = document.getElementById('messageLog');

        // WebRTC elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.testVibrateBtn = document.getElementById('testVibrateBtn');

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
        // Handle page visibility changes — route through VibrationHandler so
        // isVibrating state stays consistent. Previously this called
        // navigator.vibrate(0) directly, which stopped the device but left
        // isVibrating=true, corrupting state for all subsequent events.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.vibrationHandler.stopAllVibration();
            }
        });

        // Robust Debug Toggle (Double tap title)
        // Using both touchstart (for instant mobile response) and click (for desktop)
        const title = document.querySelector('.title');
        let lastTapTime = 0;
        const handleTap = (e) => {
            const currentTime = Date.now();
            const tapGap = currentTime - lastTapTime;

            if (tapGap < 300 && tapGap > 0) {
                this.toggleDebugMode();
                lastTapTime = 0; // Reset
            } else {
                lastTapTime = currentTime;
            }
        };

        title.addEventListener('touchstart', (e) => handleTap(e), { passive: true });
        title.addEventListener('click', (e) => handleTap(e));

        // Handle URL-based vibration
        window.addEventListener('urlVibrate', () => {
            this.vibrationHandler.quickVibrate();
        });

        // Handle keyboard shortcuts (for desktop)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                // triggerVibration() did not exist — was a silent crash that
                // broke the keydown listener. Use quickVibrate() instead.
                if (!this.vibrationHandler.isVibrating) {
                    this.vibrationHandler.quickVibrate();
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
        // Test Vibrate button
        if (this.testVibrateBtn) {
            this.testVibrateBtn.addEventListener('click', () => {
                if (this.vibrationHandler) {
                    this.vibrationHandler.testVibration();
                }
            });
        }
    }

    onConnectionChange(isConnected, state, signalingState) {
        // Update connection status UI
        this.updateConnectionStatus(isConnected, state, signalingState);

        Utils.log(`WebRTC connection changed: ${isConnected} (${state}), signaling: ${signalingState}`);
    }

    onDataReceived(data) {
        Utils.log('Received data from peer:', data);

        // Handle string messages
        if (typeof data === 'string' || data.message) {
            const msg = typeof data === 'string' ? data : data.message;
            this.logMessage(msg);

            // Echo back to peer
            this.sendToPeer({
                type: 'echo',
                message: `Echo: ${msg}`,
                timestamp: Date.now()
            });
        }

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

    updateConnectionStatus(isConnected, state, signalingState) {
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

        const signalingMessages = {
            'initializing': 'Initializing signaling...',
            'registering': 'Registering as available peer...',
            'waiting': 'Waiting for peers...',
            'received_offer': 'Signal received, connecting...',
            'connecting': 'Establishing peer connection...',
            'reconnecting': 'Trying to reconnect...'
        };

        this.statusIndicator.textContent = indicators[state] || '⚫';

        // Use signaling message if not connected/connecting at WebRTC level
        let message = messages[state] || 'Unknown state';
        if (state === 'new' || state === 'connecting' || signalingState === 'reconnecting') {
            message = signalingMessages[signalingState] || message;
        }
        this.statusText.textContent = message;

        // Update details
        const details = document.getElementById('statusDetails');
        if (details && this.webrtcManager) {
            const status = this.webrtcManager.getConnectionStatus();
            let detailsHtml = '';
            if (status.publicIP) detailsHtml += `<span>IP: ${status.publicIP}</span>`;
            if (status.peerId) detailsHtml += `<span>ID: ${status.peerId.split('_').pop()}</span>`;
            details.innerHTML = detailsHtml;
        }

        // Update connection status styling
        this.connectionStatus.className = `connection-status ${state} ${signalingState}`;
    }

    logMessage(message) {
        if (!this.messageLog) return;

        Utils.log(`Message from peer: ${message}`);
        this.messageLog.textContent = `Peer: ${message}`;
        this.messageLog.classList.add('new-message');

        // Remove highlight after a delay
        setTimeout(() => {
            this.messageLog.classList.remove('new-message');
        }, 2000);
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


    toggleDebugMode() {
        this.debugMode = !this.debugMode;

        // Sync with vibration handler
        if (this.vibrationHandler) {
            this.vibrationHandler.debugMode = this.debugMode;
            this.vibrationHandler.updateDebugInfo();
        }

        if (this.debugMode) {
            this.showDebugInfo();
        } else {
            this.debugInfo.classList.remove('show');
        }
    }

    showDebugInfo() {
        const webrtcStatus = this.webrtcManager ? this.webrtcManager.getConnectionStatus() : null;

        const debugData = {
            timestamp: new Date().toISOString(),
            webrtc: webrtcStatus,
            vibration: {
                isVibrating: this.vibrationHandler?.isVibrating || false,
                activeTouches: this.vibrationHandler?.activeTouches?.size || 0,
                isTouchDevice: this.vibrationHandler?.isTouchDevice || false
            },
            userAgent: navigator.userAgent,
            screen: {
                width: screen.width,
                height: screen.height,
                orientation: screen.orientation?.type || 'unknown'
            }
        };

        const debugContent = this.debugInfo.querySelector('#debugContent') || this.debugInfo;
        debugContent.innerHTML = `
            <h3>Debug Information</h3>
            <pre>${JSON.stringify(debugData, null, 2)}</pre>
        `;
        this.debugInfo.classList.add('show');
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