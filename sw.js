// Service Worker for Smart Statement Converter PWA
const CACHE_NAME = 'smart-statement-converter-v3';
const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dynamic-v3';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/profile.html',
    '/styles.css',
    '/script.js',
    '/js/ui-utils.js',
    '/manifest.json',
    '/favicon.ico'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static files');
                // Cache files individually to avoid failure on missing files
                return Promise.all(
                    STATIC_FILES.map((url) => {
                        return fetch(url)
                            .then((response) => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                } else {
                                    console.warn('Failed to cache:', url, response.status);
                                }
                            })
                            .catch((error) => {
                                console.warn('Error caching file:', url, error.message);
                            });
                    })
                );
            })
            .then(() => {
                console.log('Static files cached (with possible warnings)');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Error during cache installation:', error);
                return self.skipWaiting(); // Continue anyway
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API calls, OAuth callback, and external resources
    if (url.pathname.startsWith('/api/') ||
        url.pathname.includes('oauth-callback') ||
        url.hostname !== location.hostname) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('Serving from cache:', request.url);
                    return cachedResponse;
                }

                console.log('Fetching from network:', request.url);
                return fetch(request)
                    .then((response) => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response for caching
                        const responseToCache = response.clone();

                        caches.open(DYNAMIC_CACHE)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('Fetch failed:', error);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Background sync for failed uploads
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        event.waitUntil(
            // Handle any pending uploads or data sync
            handleBackgroundSync()
        );
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    console.log('Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New notification from Smart Statement Converter',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Details',
                icon: '/icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/icon-96x96.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Smart Statement Converter', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked');
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Helper function for background sync
async function handleBackgroundSync() {
    try {
        // Get any pending data from IndexedDB or localStorage
        const pendingData = await getPendingData();
        
        if (pendingData && pendingData.length > 0) {
            console.log('Processing pending data:', pendingData.length, 'items');
            
            for (const item of pendingData) {
                try {
                    await processPendingItem(item);
                } catch (error) {
                    console.error('Error processing pending item:', error);
                }
            }
        }
    } catch (error) {
        console.error('Background sync error:', error);
    }
}

// Helper functions (these would need to be implemented based on your data storage)
async function getPendingData() {
    // This would retrieve pending uploads or sync data
    // For now, return empty array
    return [];
}

async function processPendingItem(item) {
    // This would process individual pending items
    // For now, just log
    console.log('Processing item:', item);
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});