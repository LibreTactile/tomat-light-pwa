/**
 * PWAManager - Handles Progressive Web App functionality
 */

class PWAManager {
    constructor(installPromptElement, installBtnElement, closeBtnElement, swStatusElement) {
        this.installPrompt = installPromptElement;
        this.installBtn = installBtnElement;
        this.closeBtn = closeBtnElement;
        this.swStatus = swStatusElement;
        
        this.deferredPrompt = null;
        this.isInstalled = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.registerServiceWorker();
        this.checkIfInstalled();
        this.handleUrlActions();
    }

    setupEventListeners() {
        // PWA install events
        this.installBtn.addEventListener('click', () => {
            this.installPWA();
        });

        this.closeBtn.addEventListener('click', () => {
            this.hideInstallPrompt();
        });

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (!this.isInstalled) {
                setTimeout(() => this.showInstallPrompt(), 3000);
            }
        });

        // Handle app installation
        window.addEventListener('appinstalled', () => {
            Utils.log('PWA was installed');
            this.isInstalled = true;
            this.hideInstallPrompt();
            this.showServiceWorkerStatus('🎉 App installed successfully!');
        });

        // Handle service worker updates
        window.addEventListener('load', () => {
            this.checkForServiceWorkerUpdates();
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const basePath = Utils.getBasePath();
                const registration = await navigator.serviceWorker.register('./sw.js', {
                    scope: basePath
                });
                
                Utils.log('Service Worker registered successfully:', registration);
                this.showServiceWorkerStatus('✅ Service Worker registered');
                
                // Handle service worker updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showServiceWorkerStatus('🔄 App updated! Refresh to see changes', 5000);
                        }
                    });
                });
                
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                this.showServiceWorkerStatus('❌ Service Worker registration failed');
            }
        } else {
            Utils.log('Service Workers not supported');
            this.showServiceWorkerStatus('⚠️ Service Workers not supported');
        }
    }

    checkForServiceWorkerUpdates() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
    }

    checkIfInstalled() {
        // Check if running as standalone (installed PWA)
        if (Utils.isStandalone()) {
            this.isInstalled = true;
            Utils.log('App is running as standalone (installed)');
        }
        
        // Check if beforeinstallprompt has been fired and dismissed
        if (Utils.getLocalStorage('pwa-dismissed')) {
            this.isInstalled = true;
        }
    }

    handleUrlActions() {
        // Handle URL parameters for shortcuts
        const urlParams = Utils.getUrlParams();
        const action = urlParams.action;
        
        if (action === 'vibrate') {
            // This will be handled by the main app
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('urlVibrate'));
            }, 500);
        }
    }

    showInstallPrompt() {
        if (!this.isInstalled) {
            this.installPrompt.classList.add('show');
        }
    }

    hideInstallPrompt() {
        this.installPrompt.classList.remove('show');
        Utils.setLocalStorage('pwa-dismissed', true);
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            Utils.log(`User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                this.isInstalled = true;
                this.showServiceWorkerStatus('🎉 Installing app...');
            }
            
            this.deferredPrompt = null;
            this.hideInstallPrompt();
        } else if (Utils.isIOS()) {
            // Show detailed iOS install instructions
            const instructions = this.isInstalled ? 
                'App is already added to your home screen!' :
                'To install this app on iOS:\n\n1. Tap the Share button (⎋) at the bottom of the screen\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right corner\n\nThe app will then appear on your home screen!';
            
            alert(instructions);
            this.hideInstallPrompt();
        } else {
            // For other browsers that don't support install prompt
            this.hideInstallPrompt();
            this.showServiceWorkerStatus('ℹ️ Install not available on this browser');
        }
    }

    showServiceWorkerStatus(message, duration = 3000) {
        Utils.showTemporaryStatus(this.swStatus, message, duration);
    }

    // Public method to check if PWA features are available
    isPWASupported() {
        return 'serviceWorker' in navigator && 'Promise' in window;
    }

    // Public method to get installation status
    getInstallationStatus() {
        return {
            isInstalled: this.isInstalled,
            isStandalone: Utils.isStandalone(),
            canInstall: !!this.deferredPrompt,
            isIOS: Utils.isIOS()
        };
    }
}