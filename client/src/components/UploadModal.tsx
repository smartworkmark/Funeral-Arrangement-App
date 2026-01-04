import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { OfflineUploadManager } from "@/lib/offlineUpload";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CloudUpload, FolderOpen, Upload, X, WifiOff } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [textContent, setTextContent] = useState("");
  const [customFilename, setCustomFilename] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async (data: { file?: File; content?: string; filename?: string }) => {
      console.log('Upload mutation started, navigator.onLine:', navigator.onLine);

      // Test connectivity with a quick ping before attempting upload
      if (!navigator.onLine) {
        console.log('navigator.onLine is false, going offline immediately');
        
        const offlineId = `offline_${Date.now()}`;
        const filename = data.filename || data.file?.name || "transcript";
        
        setTimeout(async () => {
          try {
            await OfflineUploadManager.storeUpload(data);
            console.log('Background offline storage completed');
          } catch (error) {
            console.error('Background offline storage failed:', error);
          }
        }, 0);
        
        return {
          id: offlineId,
          offline: true,
          message: "No internet connection - saved offline",
          filename: filename
        };
      }

      // Quick connectivity test
      try {
        console.log('Testing connectivity...');
        const pingController = new AbortController();
        setTimeout(() => pingController.abort(), 2000); // Very short timeout for ping
        
        await fetch('/api/auth/me', {
          method: 'HEAD',
          signal: pingController.signal
        });
        console.log('Connectivity test passed');
      } catch (error) {
        console.log('Connectivity test failed:', error);
        
        const offlineId = `offline_${Date.now()}`;
        const filename = data.filename || data.file?.name || "transcript";
        
        setTimeout(async () => {
          try {
            await OfflineUploadManager.storeUpload(data);
            console.log('Background offline storage completed');
          } catch (error) {
            console.error('Background offline storage failed:', error);
          }
        }, 0);
        
        return {
          id: offlineId,
          offline: true,
          message: "Connection test failed - saved offline",
          filename: filename
        };
      }

      // Check storage availability for large files
      if (data.file && !OfflineUploadManager.isStorageAvailable(data.file.size)) {
        throw new Error("File too large for offline storage. Please try when online.");
      }

      try {
        const formData = new FormData();
        
        if (data.file) {
          formData.append("file", data.file);
        } else if (data.content) {
          formData.append("content", data.content);
          if (data.filename) {
            formData.append("filename", data.filename);
          }
        }

        console.log('Attempting to upload to server...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('Upload timeout reached, aborting...');
          controller.abort();
        }, 3000); // 3 second timeout for main upload

        const response = await fetch("/api/transcripts/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message);
        }

        console.log('Upload successful');
        return response.json();
      } catch (error) {
        console.log('Upload failed, error:', error);
        
        // Check for network-related errors (fetch failure, timeout, abort)
        const isNetworkError = 
          error instanceof TypeError || 
          error.name === 'AbortError' || 
          error.name === 'NetworkError' ||
          error.message?.includes('fetch') ||
          error.message?.includes('network') ||
          !navigator.onLine;

        if (isNetworkError) {
          console.log('Network error detected, storing offline');
          
          // Create immediate offline response
          const offlineId = `offline_${Date.now()}`;
          const filename = data.filename || data.file?.name || "transcript";
          
          // Store in background
          setTimeout(async () => {
            try {
              await OfflineUploadManager.storeUpload(data);
              console.log('Background offline storage completed');
            } catch (error) {
              console.error('Background offline storage failed:', error);
            }
          }, 0);
          
          return {
            id: offlineId,
            offline: true,
            message: "Network error - saved offline for sync when connected",
            filename: filename
          };
        }
        
        throw error;
      }
    },
    onSuccess: (result) => {
      if (result.offline) {
        toast({
          title: "Upload Saved",
          description: `"${result.filename}" stored offline and will sync when connected`,
          variant: "default",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/transcripts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
        toast({
          title: "Success",
          description: "Transcript uploaded successfully",
        });
      }
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Upload failed",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setTextContent("");
    setCustomFilename("");
    setSelectedFile(null);
    setDragOver(false);
    uploadMutation.reset(); // Reset mutation state
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }
      if (!file.name.endsWith(".txt")) {
        toast({
          title: "Error",
          description: "Only .txt files are supported. For PDF files, please copy and paste the text content.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setTextContent("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.createElement("input");
      input.type = "file";
      input.files = e.dataTransfer.files;
      handleFileChange({ target: input } as any);
    }
  };

  const handleUpload = async () => {
    // Validate input first
    if (!selectedFile && !textContent.trim()) {
      toast({
        title: "Error",
        description: "Please select a file or enter text content",
        variant: "destructive",
      });
      return;
    }

    // Check offline state BEFORE starting mutation to prevent hanging
    const isReallyOffline = !navigator.onLine;
    
    console.log('handleUpload called, isReallyOffline:', isReallyOffline, 'navigator.onLine:', navigator.onLine);
    
    if (isReallyOffline) {
      console.log('Detected offline mode, handling immediately without mutation');
      
      // Handle offline immediately without using the hanging mutation
      const uploadData = selectedFile 
        ? { file: selectedFile }
        : { content: textContent.trim(), filename: customFilename || undefined };
      
      const offlineId = `offline_${Date.now()}`;
      const filename = uploadData.filename || uploadData.file?.name || "transcript";
      
      // Store in background without waiting
      setTimeout(async () => {
        try {
          await OfflineUploadManager.storeUpload(uploadData);
          console.log('Background offline storage completed');
        } catch (error) {
          console.error('Background offline storage failed:', error);
        }
      }, 0);
      
      // Show success immediately
      toast({
        title: "Upload Saved",
        description: `"${filename}" stored offline and will sync when connected`,
        variant: "default",
      });
      
      handleClose();
      return;
    }

    // Only use mutation for online uploads
    console.log('Using online upload mutation');
    if (selectedFile) {
      uploadMutation.mutate({ file: selectedFile });
    } else if (textContent.trim()) {
      uploadMutation.mutate({
        content: textContent,
        filename: customFilename || undefined,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Upload New Transcript</DialogTitle>
            {!isOnline && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline Mode
              </Badge>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {!isOnline && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 mb-4">
              <p className="font-medium">Working offline</p>
              <p>Your transcript will be saved locally and uploaded automatically when you reconnect.</p>
            </div>
          )}
          
          <div className="space-y-6">
          {/* Text Input - Primary Option */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="filename">Transcript Name (Optional)</Label>
              <Input
                id="filename"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="Enter a custom transcript name..."
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="content">Transcript Content</Label>
              <Textarea
                id="content"
                value={textContent}
                onChange={(e) => {
                  setTextContent(e.target.value);
                  setSelectedFile(null);
                }}
                rows={8}
                placeholder="Paste or type your transcript content here..."
                className="mt-2 font-mono text-sm"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or upload a file
              </span>
            </div>
          </div>

          {/* File Upload Area - Secondary Option */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-slate-300 hover:border-primary/40"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <div className="w-12 h-12 mx-auto bg-primary-100 rounded-lg flex items-center justify-center mb-3">
              <CloudUpload className="h-6 w-6 text-primary-600" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">
              {selectedFile ? selectedFile.name : "Upload .txt file"}
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Support for .txt files up to 10MB
            </p>
            <Button type="button" variant="outline" size="sm">
              <FolderOpen className="mr-2 h-3 w-3" />
              Browse Files
            </Button>
            <input
              id="file-input"
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
        </div>

        <div className="shrink-0 flex justify-end space-x-3 pt-4 border-t bg-background">
          <Button 
            variant="outline" 
            onClick={() => {
              if (uploadMutation.isPending) {
                uploadMutation.reset();
              }
              handleClose();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent border-white" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {!navigator.onLine ? "Save Offline" : "Upload Transcript"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
