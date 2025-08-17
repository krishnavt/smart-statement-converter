// Service Worker for Splitzee - Background Sync and Notifications

const CACHE_NAME = 'splitzee-cache-v1';
const urlsToCache = [
  '/',
  '/app-offline.html',
  '/expense-form-offline.html',
  '/offline-storage.js',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Splitzee: Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Background sync for expense data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get offline storage data
    const data = await getOfflineData();
    
    if (data && data.syncQueue && data.syncQueue.length > 0) {
      console.log('Background sync: Processing', data.syncQueue.length, 'items');
      
      // In production, sync with cloud service
      await syncWithCloud(data.syncQueue);
      
      // Clear sync queue
      await clearSyncQueue();
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getOfflineData() {
  // In a real implementation, this would access IndexedDB
  // For demo, we'll return a mock sync queue
  return {
    syncQueue: []
  };
}

async function syncWithCloud(syncQueue) {
  // Simulate cloud sync
  console.log('Syncing', syncQueue.length, 'items to cloud');
  
  // In production, this would make HTTP requests to sync service
  for (const item of syncQueue) {
    console.log('Synced:', item.type, item.timestamp);
  }
}

async function clearSyncQueue() {
  console.log('Sync queue cleared');
}

// Push notification handling
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'You have a new update',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icon-96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Splitzee Update', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/app-offline.html')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/app-offline.html')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic background sync (for browsers that support it)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'content-sync') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    console.log('Periodic sync: Checking for updates');
    
    // In production, this would check for updates from friends
    const hasUpdates = Math.random() < 0.1; // 10% chance for demo
    
    if (hasUpdates) {
      // Show notification about updates
      self.registration.showNotification('Splitzee Update', {
        body: 'Your friends have made some changes to expenses',
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: 'expense-update'
      });
    }
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
}

console.log('🔔 Splitzee Service Worker loaded - Ready for notifications and background sync');