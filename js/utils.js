/**
 * Utility functions for the Vibration PWA
 */

class Utils {
    /**
     * Check if the device is iOS
     * @returns {boolean}
     */
    static isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
    }

    /**
     * Check if the app is running in standalone mode (installed PWA)
     * @returns {boolean}
     */
    static isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true;
    }

    /**
     * Get the correct base path for GitHub Pages or local development
     * @returns {string}
     */
    static getBasePath() {
        const path = window.location.pathname;
        if (path.includes('.github.io/') && !path.endsWith('.github.io/')) {
            // Extract repository name for GitHub Pages
            const parts = path.split('/');
            const repoIndex = parts.findIndex(part => part.includes('.github.io'));
            if (repoIndex !== -1 && parts[repoIndex + 1]) {
                return `/${parts[repoIndex + 1]}/`;
            }
        }
        return './';
    }

    /**
     * Create a wave effect element at specified position
     * @param {number} x - X position (percentage)
     * @param {number} y - Y position (percentage)
     * @param {number} size - Size of the wave in pixels
     * @param {HTMLElement} container - Container element to append wave to
     */
    static createWave(x, y, size, container) {
        const wave = document.createElement('div');
        wave.className = 'wave';
        wave.style.left = x + '%';
        wave.style.top = y + '%';
        wave.style.width = size + 'px';
        wave.style.height = size + 'px';
        wave.style.marginLeft = -(size / 2) + 'px';
        wave.style.marginTop = -(size / 2) + 'px';
        
        container.appendChild(wave);
        
        setTimeout(() => {
            if (wave.parentNode) {
                wave.remove();
            }
        }, 3000);
    }

    /**
     * Calculate distance between two points
     * @param {number} x1 
     * @param {number} y1 
     * @param {number} x2 
     * @param {number} y2 
     * @returns {number}
     */
    static calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Check if a point is inside a circular element
     * @param {number} pointX 
     * @param {number} pointY 
     * @param {DOMRect} elementRect 
     * @returns {boolean}
     */
    static isPointInsideCircle(pointX, pointY, elementRect) {
        const centerX = elementRect.left + elementRect.width / 2;
        const centerY = elementRect.top + elementRect.height / 2;
        const radius = elementRect.width / 2;

        const distance = this.calculateDistance(pointX, pointY, centerX, centerY);
        return distance <= radius;
    }

    /**
     * Debounce function to limit function calls
     * @param {Function} func 
     * @param {number} wait 
     * @returns {Function}
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function to limit function calls
     * @param {Function} func 
     * @param {number} limit 
     * @returns {Function}
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Show a temporary status message
     * @param {HTMLElement} element 
     * @param {string} message 
     * @param {number} duration 
     */
    static showTemporaryStatus(element, message, duration = 3000) {
        element.textContent = message;
        element.classList.add('show');
        
        setTimeout(() => {
            element.classList.remove('show');
        }, duration);
    }

    /**
     * Handle URL parameters and return parsed object
     * @returns {Object}
     */
    static getUrlParams() {
        return Object.fromEntries(new URLSearchParams(window.location.search));
    }

    /**
     * Safe localStorage wrapper
     * @param {string} key 
     * @param {*} value 
     */
    static setLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('LocalStorage not available:', e);
        }
    }

    /**
     * Safe localStorage getter
     * @param {string} key 
     * @param {*} defaultValue 
     * @returns {*}
     */
    static getLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.warn('LocalStorage not available:', e);
            return defaultValue;
        }
    }

    /**
     * Generate a random ID
     * @param {number} length 
     * @returns {string}
     */
    static generateId(length = 8) {
        return Math.random().toString(36).substring(2, length + 2);
    }

    /**
     * Log with timestamp (for debugging)
     * @param  {...any} args 
     */
    static log(...args) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}]`, ...args);
    }
}
