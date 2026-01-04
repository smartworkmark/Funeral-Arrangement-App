// Service Worker for offline functionality - UPDATED VERSION TO FORCE REFRESH
const CACHE_NAME = 'funeral-app-v2-fixed';
const STATIC_CACHE = 'funeral-app-static-v2-fixed';
const API_CACHE = 'funeral-app-api-v2-fixed';

// Files to cache for offline access
const STATIC_FILES = [
  '/',
  '/offline.html',
  '/manifest.json'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/auth/me',
  '/api/transcripts',
  '/api/dashboard/stats',
  '/api/dashboard/recent'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        return cache.addAll(STATIC_FILES);
      }),
      caches.open(API_CACHE)
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method === 'GET') {
    if (url.pathname.startsWith('/api/')) {
      // API requests - cache with network first strategy
      event.respondWith(handleApiRequest(request));
    } else {
      // Static files - cache first strategy
      event.respondWith(handleStaticRequest(request));
    }
  } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    // CRITICAL FIX: Block all write requests with null authorization headers
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader === 'Bearer null' || authHeader === null || authHeader === 'null') {
      console.log('🚫 BLOCKING WRITE REQUEST WITH NULL TOKEN:', request.url);
      event.respondWith(
        new Response(
          JSON.stringify({ error: 'Authentication required - request blocked by service worker' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      );
      return;
    }
    
    // Handle write operations for offline sync
    event.respondWith(handleWriteRequest(request));
  }
});

// Network first strategy for API requests
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    
    // Fall back to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response if no cache
    return new Response(
      JSON.stringify({ 
        error: 'Offline - data not available',
        offline: true 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache first strategy for static files
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Handle write operations - DISABLED offline storage to prevent null token issues
async function handleWriteRequest(request) {
  try {
    // Try network first - if it fails, just fail rather than storing offline
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('Write operation failed - NOT storing for sync to prevent auth issues:', request.url);
    
    // Don't store offline requests anymore - this was causing the null token issues
    // Just return an error instead
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Network request failed and offline storage disabled',
        message: 'Please check your connection and try again'
      }),
      {
        status: 503, // Service Unavailable
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Store offline requests in IndexedDB
async function storeOfflineRequest(request) {
  const headers = Object.fromEntries(request.headers.entries());
  
  // Don't store requests with null authorization tokens
  if (headers.authorization === 'Bearer null' || headers.Authorization === 'Bearer null') {
    console.log('🚫 Refusing to store request with null token:', request.url);
    return;
  }
  
  const requestData = {
    url: request.url,
    method: request.method,
    headers: headers,
    body: await request.text(),
    timestamp: Date.now()
  };

  // Use IndexedDB to store the request
  const db = await openOfflineDB();
  const transaction = db.transaction(['offline_requests'], 'readwrite');
  const store = transaction.objectStore('offline_requests');
  await store.add(requestData);
  console.log('✅ Stored offline request:', request.url);
}

// Open IndexedDB for offline storage
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FuneralAppOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('offline_requests')) {
        const store = db.createObjectStore('offline_requests', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('offline_data')) {
        db.createObjectStore('offline_data', { keyPath: 'key' });
      }
    };
  });
}

// Listen for messages from client
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
    await syncOfflineRequests();
  } else if (event.data && event.data.type === 'CLEAR_OFFLINE_REQUESTS') {
    await clearOfflineRequests();
    console.log('✅ Service worker cleared offline requests');
  } else if (event.data && event.data.type === 'FORCE_CLEANUP') {
    // Force immediate cleanup of all stored requests
    await clearOfflineRequests();
    await syncOfflineRequests(); // This will clean up null token requests
    console.log('🧹 Force cleanup completed');
  }
});

// Clear all stored offline requests
async function clearOfflineRequests() {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['offline_requests'], 'readwrite');
    const store = transaction.objectStore('offline_requests');
    await store.clear();
    console.log('🧹 Cleared all offline requests from IndexedDB');
  } catch (error) {
    console.error('Failed to clear offline requests:', error);
  }
}

// Sync offline requests when back online
async function syncOfflineRequests() {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['offline_requests'], 'readwrite');
    const store = transaction.objectStore('offline_requests');
    const requests = await store.getAll();
    
    console.log('🔍 Found', requests.length, 'offline requests to sync');
    
    // First, clean up any requests with null tokens
    let cleaned = 0;
    for (const request of requests) {
      const headers = request.headers || {};
      if (headers.authorization === 'Bearer null' || headers.Authorization === 'Bearer null') {
        await store.delete(request.id);
        cleaned++;
        console.log('🧹 Removed request with null token:', request.url);
      }
    }
    
    if (cleaned > 0) {
      console.log(`✅ Cleaned up ${cleaned} requests with null tokens`);
      // Reload the remaining requests
      const remainingRequests = await store.getAll();
      console.log('📝 Remaining requests to sync:', remainingRequests.length);
      return; // Exit early after cleanup
    }
    
    for (const requestData of requests) {
      try {
        // Skip requests with null authorization tokens
        const headers = requestData.headers || {};
        if (headers.authorization === 'Bearer null' || headers.Authorization === 'Bearer null') {
          console.log('🚫 Skipping request with null token:', requestData.url);
          await store.delete(requestData.id);
          continue;
        }
        
        console.log('🔄 Syncing request:', requestData.url, 'with headers:', headers);
        
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Successfully synced, remove from offline storage
          await store.delete(requestData.id);
          console.log('Synced offline request:', requestData.url);
        }
      } catch (error) {
        console.error('Failed to sync request:', requestData.url, error);
      }
    }
    
    // Notify the main thread about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        syncedCount: requests.length
      });
    });
    
  } catch (error) {
    console.error('Sync failed:', error);
  }
}