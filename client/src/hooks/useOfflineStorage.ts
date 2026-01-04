import { useState, useEffect } from 'react';

interface OfflineStorageOptions {
  key: string;
  defaultValue?: any;
  syncOnReconnect?: boolean;
}

export function useOfflineStorage<T>({
  key,
  defaultValue,
  syncOnReconnect = true
}: OfflineStorageOptions) {
  const [data, setData] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
  }, [key]);

  useEffect(() => {
    if (syncOnReconnect) {
      const handleOnline = () => {
        syncWithServer();
      };

      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
    }
  }, [syncOnReconnect]);

  const loadFromStorage = async () => {
    try {
      setIsLoading(true);
      const stored = localStorage.getItem(`offline_${key}`);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch (err) {
      setError('Failed to load offline data');
      console.error('Error loading from offline storage:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToStorage = async (newData: T) => {
    try {
      localStorage.setItem(`offline_${key}`, JSON.stringify(newData));
      setData(newData);
      setError(null);
    } catch (err) {
      setError('Failed to save offline data');
      console.error('Error saving to offline storage:', err);
    }
  };

  const syncWithServer = async () => {
    // Implementation would depend on specific sync requirements
    console.log('Syncing with server for key:', key);
  };

  const clearStorage = () => {
    localStorage.removeItem(`offline_${key}`);
    setData(defaultValue);
  };

  return {
    data,
    setData: saveToStorage,
    isLoading,
    error,
    clearStorage,
    syncWithServer
  };
}

// Hook for managing offline form data
export function useOfflineForm(formKey: string) {
  const {
    data: formData,
    setData: setFormData,
    isLoading,
    clearStorage
  } = useOfflineStorage({
    key: `form_${formKey}`,
    defaultValue: {},
    syncOnReconnect: false
  });

  const saveFormField = (fieldName: string, value: any) => {
    setFormData({
      ...formData,
      [fieldName]: value,
      lastModified: new Date().toISOString()
    });
  };

  const hasUnsavedChanges = () => {
    return Object.keys(formData).length > 0;
  };

  return {
    formData,
    saveFormField,
    hasUnsavedChanges,
    clearForm: clearStorage,
    isLoading
  };
}