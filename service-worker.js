// NoteFlow Service Worker
// This file enables offline support, caching, and PWA functionality

const CACHE_NAME = 'noteflow-v2';
const RUNTIME_CACHE = 'noteflow-runtime-v2';
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/local-app.js',
  '/features-starter.js',
  '/calendar.js',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Playfair+Display:wght@600&display=swap'
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests differently
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || new Response('Offline - Data not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        })
    );
  } else {
    // Cache first strategy for static assets
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }

          return fetch(request).then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            const responseClone = response.clone();
            
            if (request.url.includes('/fonts/')) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            } else {
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseClone);
              });
            }

            return response;
          });
        })
        .catch(() => {
          // Return offline page or cached asset
          return caches.match('/index.html');
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    event.waitUntil(syncNotes());
  }
  if (event.tag === 'sync-goals') {
    event.waitUntil(syncGoals());
  }
  if (event.tag === 'sync-habits') {
    event.waitUntil(syncHabits());
  }
});

// Helper functions for syncing
async function syncNotes() {
  try {
    const db = await openIndexedDB('noteflow');
    const notes = await db.getAll('notes');
    
    await Promise.all(notes.map(note => 
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      })
    ));
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function syncGoals() {
  try {
    const db = await openIndexedDB('noteflow');
    const goals = await db.getAll('goals');
    
    await Promise.all(goals.map(goal => 
      fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal)
      })
    ));
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

async function syncHabits() {
  try {
    const db = await openIndexedDB('noteflow');
    const habits = await db.getAll('habits');
    
    await Promise.all(habits.map(habit => 
      fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(habit)
      })
    ));
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '🌸',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 180 180%22><text y=%22160%22 font-size=%22180%22 fill=%22%23E8A87C%22>🌸</text></svg>',
    tag: data.tag,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification('NoteFlow', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
