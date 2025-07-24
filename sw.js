// Vibration PWA Service Worker
const CACHE_NAME = 'vibration-pwa-v1';
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'  
];
// Install event - cache resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        // Ensure the service worker takes control of all clients immediately
        return self.clients.claim();
      })
      .catch(error => {
        console.error('Service Worker: Activation failed', error);
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version or fetch from network
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }

        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response since it can only be consumed once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            
            // Return a basic offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Offline - Vibration PWA</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
                      color: white;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      margin: 0;
                      padding: 2rem;
                      text-align: center;
                    }
                    .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                    .offline-title { font-size: 2rem; margin-bottom: 1rem; color: #e94560; }
                    .offline-message { font-size: 1.1rem; opacity: 0.8; margin-bottom: 2rem; }
                    .retry-button {
                      background: linear-gradient(145deg, #e94560, #c73650);
                      color: white;
                      border: none;
                      padding: 1rem 2rem;
                      border-radius: 8px;
                      font-size: 1rem;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.3s ease;
                    }
                    .retry-button:hover {
                      background: linear-gradient(145deg, #c73650, #a82d42);
                      transform: translateY(-2px);
                    }
                  </style>
                </head>
                <body>
                  <div class="offline-icon">📳</div>
                  <h1 class="offline-title">You're Offline</h1>
                  <p class="offline-message">
                    The Vibration PWA needs an internet connection to load new content.<br>
                    Check your connection and try again.
                  </p>
                  <button class="retry-button" onclick="window.location.reload()">
                    Try Again
                  </button>
                </body>
                </html>
              `, {
                headers: { 'Content-Type': 'text/html' }
              });
            }
            
            throw error;
          });
      })
  );
});

// Handle background sync (if supported)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'vibration-sync') {
    event.waitUntil(
      // Perform any background sync tasks here
      Promise.resolve()
    );
  }
});

// Handle push notifications (if you want to add them later)
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Vibration PWA notification',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="%231a1a2e" rx="42"/><text x="96" y="130" font-size="86" text-anchor="middle" fill="white">📳</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" fill="%231a1a2e" rx="16"/><text x="36" y="50" font-size="32" text-anchor="middle" fill="white">📳</text></svg>',
    vibrate: [200, 100, 200],
    tag: 'vibration-pwa',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('Vibration PWA', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked', event);
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle message events from the main app
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting();
        break;
      case 'GET_VERSION':
        event.ports[0].postMessage({ version: CACHE_NAME });
        break;
      case 'VIBRATE':
        // Could trigger a notification or other background task
        break;
    }
  }
});

// Error handling
self.addEventListener('error', event => {
  console.error('Service Worker: Error occurred', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
});

console.log('Service Worker: Script loaded successfully');