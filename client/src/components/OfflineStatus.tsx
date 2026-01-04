import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WifiOff, Wifi, RefreshCw, CheckCircle, Upload } from 'lucide-react';
import { OfflineUploadManager } from '@/lib/offlineUpload';

interface OfflineData {
  pendingRequests: number;
  pendingUploads: number;
  lastSync: Date | null;
  storageSize?: number;
}

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData>({
    pendingRequests: 0,
    pendingUploads: 0,
    lastSync: null
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>('');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically sync when coming back online
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Service worker message listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        setIsSyncing(false);
        setSyncMessage(`Synced ${event.data.syncedCount} changes`);
        setOfflineData(prev => ({
          ...prev,
          pendingRequests: 0,
          lastSync: new Date()
        }));
        setTimeout(() => setSyncMessage(''), 3000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Check for pending offline data on mount
    checkOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const checkOfflineData = async () => {
    try {
      // Check localStorage for pending requests
      const pendingRequests = JSON.parse(localStorage.getItem('offline_requests') || '[]');
      
      // Check for pending uploads
      const pendingUploads = OfflineUploadManager.getStoredUploads();
      
      // Get total storage size
      const storageSize = OfflineUploadManager.getStorageSize();
      
      setOfflineData(prev => ({
        ...prev,
        pendingRequests: pendingRequests.length,
        pendingUploads: pendingUploads.length,
        storageSize
      }));
    } catch (error) {
      console.error('Error checking offline data:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('Syncing offline changes...');
    
    try {
      let totalSynced = 0;
      
      // Sync regular requests
      const pendingRequests = JSON.parse(localStorage.getItem('offline_requests') || '[]');
      for (const request of pendingRequests) {
        try {
          const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body
          });
          
          if (response.ok) {
            totalSynced++;
          }
        } catch (error) {
          console.error('Failed to sync request:', request.url, error);
        }
      }
      
      // Sync uploads
      const uploadResult = await OfflineUploadManager.syncUploads();
      totalSynced += uploadResult.success;
      
      // Clear synced requests
      if (totalSynced > 0) {
        localStorage.removeItem('offline_requests');
        setOfflineData(prev => ({
          ...prev,
          pendingRequests: 0,
          pendingUploads: uploadResult.failed, // Keep failed uploads
          lastSync: new Date()
        }));
        setSyncMessage(`Synced ${totalSynced} changes`);
      } else {
        setSyncMessage('No changes to sync');
      }
      
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (error) {
      console.error('Sync failed:', error);
      setIsSyncing(false);
      setSyncMessage('Sync failed. Please try again.');
      setTimeout(() => setSyncMessage(''), 3000);
    }
  };

  const hasPendingUploads = offlineData.pendingUploads > 0;
  const hasPendingRequests = offlineData.pendingRequests > 0;
  const hasActiveSyncWork = hasPendingUploads || hasPendingRequests;
  
  // Only show when offline, has pending work, currently syncing, or has sync message
  if (isOnline && !hasActiveSyncWork && !isSyncing && !syncMessage) {
    return null; // Don't show anything when online with no active work
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card className="w-80 shadow-lg border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={isOnline ? "default" : "destructive"}>
                  {isOnline ? "Online" : "Offline"}
                </Badge>
                
                <div className="flex gap-1 flex-wrap">
                  {offlineData.pendingRequests > 0 && (
                    <Badge variant="secondary">
                      {offlineData.pendingRequests} requests
                    </Badge>
                  )}
                  {offlineData.pendingUploads > 0 && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Upload className="h-2 w-2" />
                      {offlineData.pendingUploads} uploads
                    </Badge>
                  )}
                  {(offlineData.storageSize || 0) > 0 && (
                    <Badge variant="outline">
                      {((offlineData.storageSize || 0) / (1024 * 1024)).toFixed(1)} MB
                    </Badge>
                  )}
                </div>
              </div>
              
              {syncMessage && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  {isSyncing ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  )}
                  {syncMessage}
                </p>
              )}
              
              {!isOnline && (
                <p className="text-sm text-muted-foreground mt-1">
                  Changes will sync when reconnected
                </p>
              )}
            </div>
            
            <div className="flex gap-1">
              {isOnline && (offlineData.pendingRequests > 0 || offlineData.pendingUploads > 0) && !isSyncing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Sync
                </Button>
              )}
              {isOnline && (offlineData.storageSize || 0) > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    OfflineUploadManager.clearAllUploads();
                    localStorage.removeItem('offline_requests');
                    checkOfflineData();
                  }}
                  className="flex-shrink-0 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}