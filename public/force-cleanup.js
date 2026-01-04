// EMERGENCY CLEANUP SCRIPT - Run this in browser console
// This will completely remove service worker and all cached data

async function emergencyCleanup() {
  console.log('🚨 Starting emergency cleanup...');
  
  try {
    // 1. Unregister ALL service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        console.log('Unregistering service worker:', registration.scope);
        await registration.unregister();
      }
    }
    
    // 2. Clear ALL caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        console.log('Deleting cache:', cacheName);
        await caches.delete(cacheName);
      }
    }
    
    // 3. Clear ALL storage
    localStorage.clear();
    sessionStorage.clear();
    
    // 4. Delete ALL IndexedDB databases
    const dbNames = ['FuneralAppOffline'];
    for (const dbName of dbNames) {
      try {
        indexedDB.deleteDatabase(dbName);
        console.log('Deleted database:', dbName);
      } catch (error) {
        console.error('Failed to delete database:', dbName, error);
      }
    }
    
    console.log('✅ Emergency cleanup completed!');
    console.log('🔄 Reloading page in 2 seconds...');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
  }
}

// Run the cleanup
emergencyCleanup();