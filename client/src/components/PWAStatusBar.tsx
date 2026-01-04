import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Download, RefreshCw } from 'lucide-react';

interface PWAStatusBarProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export default function PWAStatusBar({ onInstall, onDismiss }: PWAStatusBarProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebAppiOS);
    
    console.log('PWA Status:', { isStandalone, isInWebAppiOS, isInstalled: isStandalone || isInWebAppiOS });

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event triggered');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
        onInstall?.();
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error installing PWA:', error);
    }
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    onDismiss?.();
  };

  // Don't show anything if already installed
  if (isInstalled) {
    return (
      <div className="bg-green-50 border-green-200 border-b p-2 text-center">
        <Badge variant="default" className="bg-green-600">
          App Installed
        </Badge>
      </div>
    );
  }

  // Show manual install hint if no automatic prompt
  if (!showInstallPrompt) {
    return (
      <div className="bg-blue-50 border-blue-200 border-b p-2 text-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="secondary">PWA Ready</Badge>
          <span className="text-sm text-blue-700">
            Install manually: Chrome menu ⋮ → More tools → Create shortcut → ✓ Open as window
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white p-3 shadow-lg">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Download className="h-5 w-5" />
          <div>
            <p className="font-medium">Install Funeral App</p>
            <p className="text-sm text-blue-100">
              Add to home screen for quick access and offline support
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-500 text-white border-blue-400">
            <RefreshCw className="h-3 w-3 mr-1" />
            Offline Ready
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstall}
            className="bg-transparent border-white text-white hover:bg-white hover:text-blue-600"
          >
            Install
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-white hover:bg-blue-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}