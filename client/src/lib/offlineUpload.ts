// Offline file upload handling utilities

export interface OfflineUploadData {
  id: string;
  filename: string;
  content: string;
  fileSize: number;
  timestamp: number;
  isTextContent: boolean;
  customFilename?: string;
}

export class OfflineUploadManager {
  private static STORAGE_KEY = 'offline_uploads';

  // Store file for offline upload
  static async storeUpload(data: {
    file?: File;
    content?: string;
    filename?: string;
  }): Promise<string> {
    try {
      console.log('Starting storeUpload with:', { 
        hasFile: !!data.file, 
        hasContent: !!data.content, 
        filename: data.filename 
      });
      
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      let content = '';
      let filename = '';
      let fileSize = 0;
      let isTextContent = false;

      if (data.file) {
        console.log('Processing file upload:', data.file.name, data.file.size);
        // Convert file to base64 for storage
        content = await this.fileToBase64(data.file);
        console.log('File converted to base64, length:', content.length);
        filename = data.file.name;
        fileSize = data.file.size;
        isTextContent = false;
      } else if (data.content) {
        console.log('Processing text content, length:', data.content.length);
        content = data.content;
        filename = data.filename || `transcript_${new Date().toISOString().split('T')[0]}.txt`;
        fileSize = new Blob([content]).size;
        isTextContent = true;
      } else {
        throw new Error('No file or content provided');
      }

      const uploadData: OfflineUploadData = {
        id: uploadId,
        filename,
        content,
        fileSize,
        timestamp: Date.now(),
        isTextContent,
        customFilename: data.filename
      };

      console.log('Storing upload data:', { 
        id: uploadId, 
        filename, 
        fileSize, 
        isTextContent 
      });

      // Store in localStorage
      const existingUploads = this.getStoredUploads();
      existingUploads.push(uploadData);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingUploads));
      
      console.log('Upload stored successfully with ID:', uploadId);
      return uploadId;
    } catch (error) {
      console.error('Failed to store offline upload:', error);
      throw new Error(`Failed to store upload for offline sync: ${error.message}`);
    }
  }

  // Get all stored uploads
  static getStoredUploads(): OfflineUploadData[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored uploads:', error);
      return [];
    }
  }

  // Sync all stored uploads
  static async syncUploads(): Promise<{ success: number; failed: number }> {
    const uploads = this.getStoredUploads();
    let success = 0;
    let failed = 0;

    for (const upload of uploads) {
      try {
        await this.uploadToServer(upload);
        success++;
      } catch (error) {
        console.error('Failed to sync upload:', upload.filename, error);
        failed++;
      }
    }

    // Clear successfully synced uploads
    if (success > 0) {
      const remainingUploads = uploads.slice(success);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remainingUploads));
    }

    return { success, failed };
  }

  // Upload a single file to server
  private static async uploadToServer(upload: OfflineUploadData): Promise<void> {
    const formData = new FormData();
    
    if (upload.isTextContent) {
      formData.append("content", upload.content);
      if (upload.customFilename) {
        formData.append("filename", upload.customFilename);
      }
    } else {
      // Convert base64 back to file
      const file = this.base64ToFile(upload.content, upload.filename);
      formData.append("file", file);
    }

    const response = await fetch("/api/transcripts/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
  }

  // Remove a specific upload from storage
  static removeUpload(uploadId: string): void {
    const uploads = this.getStoredUploads();
    const filtered = uploads.filter(upload => upload.id !== uploadId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  // Clear all stored uploads
  static clearAllUploads(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Convert file to base64
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('Starting file to base64 conversion for:', file.name);
      const reader = new FileReader();
      reader.onload = () => {
        console.log('FileReader onload triggered');
        const base64 = reader.result as string;
        console.log('Base64 conversion complete, length:', base64?.length || 0);
        resolve(base64);
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        reject(error);
      };
      console.log('Calling readAsDataURL...');
      reader.readAsDataURL(file);
    });
  }

  // Convert base64 back to file
  private static base64ToFile(base64: string, filename: string): File {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'text/plain';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  // Get total storage size
  static getStorageSize(): number {
    const uploads = this.getStoredUploads();
    return uploads.reduce((total, upload) => total + upload.fileSize, 0);
  }

  // Check storage quota (rough estimate)
  static isStorageAvailable(additionalSize: number = 0): boolean {
    try {
      const currentSize = this.getStorageSize();
      const totalSize = currentSize + additionalSize;
      
      // Conservative estimate: 5MB limit for localStorage
      const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB
      
      return totalSize < STORAGE_LIMIT;
    } catch (error) {
      return false;
    }
  }

  // Clean up successfully uploaded data
  static cleanupSyncedData(): void {
    try {
      // Remove all successfully uploaded data
      const currentUploads = this.getStoredUploads();
      const stillPending = currentUploads.filter(upload => !upload.synced);
      
      if (stillPending.length === 0) {
        localStorage.removeItem(this.STORAGE_KEY);
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stillPending));
      }
    } catch (error) {
      console.error('Error cleaning up synced data:', error);
    }
  }
}