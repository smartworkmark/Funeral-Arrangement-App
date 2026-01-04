import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import UploadModal from "@/components/UploadModal";
import ArrangementView from "@/components/ArrangementView";
import {
  Search,
  Plus,
  FileText,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  Sparkles,
  User,
  Calendar,
  MapPin,
  FileEdit,
  MoreVertical,
  Copy,
  ChevronUp,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import type { Transcript } from "@shared/schema";
import { useHover } from "@/hooks/use-hover";

export default function Transcripts() {
  const [, setLocation] = useLocation();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [transcriptToDelete, setTranscriptToDelete] = useState<Transcript | null>(null);
  const [showArrangementView, setShowArrangementView] = useState(false);
  const [arrangementData, setArrangementData] = useState<any>(null);
  const [arrangementTranscript, setArrangementTranscript] = useState<Transcript | null>(null);
  const [transcriptSearchQuery, setTranscriptSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [downloadingTranscripts, setDownloadingTranscripts] = useState<Set<number>>(new Set());
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

  const { data: transcripts = [], isLoading, isError } = useQuery<Transcript[]>({
    queryKey: ["/api/transcripts"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if offline
      if (!navigator.onLine) return false;
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Fetch arrangement data for each transcript to show approval status
  const { data: arrangements = {} } = useQuery({
    queryKey: ["/api/arrangements/status"],
    queryFn: async () => {
      const arrangementsMap: Record<number, any> = {};

      for (const transcript of transcripts) {
        if (transcript.status === 'processed') {
          try {
            const response = await fetch(`/api/transcripts/${transcript.id}/arrangement`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              }
            });
            if (response.ok) {
              const arrangement = await response.json();
              arrangementsMap[transcript.id] = arrangement;
            }
          } catch (error) {
            // Silently handle errors for individual arrangements
          }
        }
      }

      return arrangementsMap;
    },
    enabled: transcripts.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      if (!navigator.onLine) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transcripts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      toast({
        title: "Success",
        description: "Transcript deleted successfully",
      });
      setTranscriptToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transcript",
        variant: "destructive",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/transcripts/${id}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcripts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/arrangements/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      toast({
        title: "AI Processing Complete",
        description: "Transcript has been processed and arrangement data extracted",
      });
      // Refresh the current transcript view if open
      if (selectedTranscript) {
        viewTranscript(selectedTranscript);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process transcript with AI",
        variant: "destructive",
      });
    },
  });

  const viewTranscript = async (transcript: Transcript) => {
    try {
      const response = await apiRequest("GET", `/api/transcripts/${transcript.id}`);
      const fullTranscript = await response.json();
      setSelectedTranscript(fullTranscript);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load transcript",
        variant: "destructive",
      });
    }
  };

  const copyTranscriptContent = async () => {
    if (selectedTranscript?.content) {
      try {
        await navigator.clipboard.writeText(selectedTranscript.content);
        toast({
          title: "Copied",
          description: "Transcript content copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Failed to copy transcript content",
          variant: "destructive",
        });
      }
    }
  };

  const highlightSearchText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    let matchCount = 0;

    return text.replace(regex, (match) => {
      const isCurrentMatch = matchCount === currentMatchIndex;
      matchCount++;

      if (isCurrentMatch) {
        return `<mark class="bg-blue-500 text-white current-match" data-match-index="${currentMatchIndex}">${match}</mark>`;
      } else {
        return `<mark class="bg-yellow-200 text-yellow-900">${match}</mark>`;
      }
    });
  };

  const searchMatches = useMemo(() => {
    if (!transcriptSearchQuery.trim() || !selectedTranscript?.content) return 0;

    const regex = new RegExp(transcriptSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = selectedTranscript.content.match(regex);
    return matches ? matches.length : 0;
  }, [transcriptSearchQuery, selectedTranscript?.content]);

  // Clear search when transcript changes
  useEffect(() => {
    setTranscriptSearchQuery("");
    setCurrentMatchIndex(0);
  }, [selectedTranscript]);

  // Reset current match index when search query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [transcriptSearchQuery]);

  // Scroll to current match when index changes
  useEffect(() => {
    if (searchMatches > 0 && transcriptSearchQuery) {
      const currentMatch = document.querySelector('.current-match');
      if (currentMatch) {
        currentMatch.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  }, [currentMatchIndex, searchMatches, transcriptSearchQuery]);

  const navigateToNextMatch = () => {
    if (searchMatches > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % searchMatches);
    }
  };

  const navigateToPreviousMatch = () => {
    if (searchMatches > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + searchMatches) % searchMatches);
    }
  };

  const viewArrangement = (transcript: Transcript) => {
    setLocation(`/arrangement/${transcript.id}`);
  };

  const downloadAllDocuments = async (transcriptId: number) => {
    // Add transcript to downloading state
    setDownloadingTranscripts(prev => new Set([...prev, transcriptId]));

    try {
      // Get the arrangement ID for this transcript
      const arrangement = arrangements[transcriptId];
      if (!arrangement || arrangement.approvalStatus !== 'approved') {
        toast({
          title: "Download Failed",
          description: "Arrangement must be approved to download documents.",
          variant: "destructive",
        });
        return;
      }

      // Fetch all documents for this arrangement
      const response = await fetch(`/api/arrangements/${arrangement.id}/documents`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const documents = await response.json();

      if (documents.length === 0) {
        toast({
          title: "No Documents",
          description: "No documents are available for download.",
          variant: "destructive",
        });
        return;
      }

      // Group documents by type and get the latest of each type
      const latestDocumentsByType: Record<string, any> = {};
      documents.forEach((doc: any) => {
        if (!latestDocumentsByType[doc.type] || 
            new Date(doc.createdAt) > new Date(latestDocumentsByType[doc.type].createdAt)) {
          latestDocumentsByType[doc.type] = doc;
        }
      });

      const latestDocuments = Object.values(latestDocumentsByType);

      // Initial toast
      toast({
        title: "Bulk Download Started",
        description: `Processing ${latestDocuments.length} documents...`,
      });

      let successCount = 0;
      let failedCount = 0;

      // Download each document with webhook processing
      for (let i = 0; i < latestDocuments.length; i++) {
        const doc = latestDocuments[i];
        try {
          // Show processing toast
          toast({
            title: "Processing Document",
            description: `Processing "${doc.title}" (${i + 1} of ${latestDocuments.length})...`,
          });

          const token = localStorage.getItem("auth_token");

          // Get user information
          const userResponse = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!userResponse.ok) {
            throw new Error('Failed to get user information');
          }

          const user = await userResponse.json();

          // Get document content
          const docResponse = await fetch(`/api/documents/${doc.id}/content`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!docResponse.ok) {
            throw new Error(`Failed to get content for ${doc.title}`);
          }

          const docData = await docResponse.json();

          // Send webhook request
          const webhookPayload = {
            docName: doc.type,
            markdownText: docData.plainTextContent || docData.content,
            userId: user.id.toString(),
            userEmail: user.email
          };

          const webhookResponse = await fetch('https://hook.us2.make.com/1hsglqsybtqd88jxtq88ghvijr61vw4l', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookPayload)
          });

          if (!webhookResponse.ok) {
            throw new Error(`Failed to process ${doc.title} through webhook`);
          }

          const webhookResult = await webhookResponse.json();

          // Download from webhook URL
          if (webhookResult.downloadUrl) {
            if (webhookResult.downloadUrl.includes('docs.google.com')) {
              // For Google Docs URLs, open in new tab
              window.open(webhookResult.downloadUrl, '_blank');
            } else {
              try {
                const downloadResponse = await fetch(webhookResult.downloadUrl);

                if (!downloadResponse.ok) {
                  throw new Error(`Failed to download processed ${doc.title}`);
                }

                const blob = await downloadResponse.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${doc.title}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch (downloadError) {
                console.error(`Direct download failed for ${doc.title}, opening in tab:`, downloadError);
                window.open(webhookResult.downloadUrl, '_blank');
              }
            }
          }

          successCount++;

          // Show success toast for individual document
          toast({
            title: "Document Downloaded",
            description: `"${doc.title}" downloaded successfully`,
          });

          // Delay between downloads to prevent overwhelming the webhook
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to download document ${doc.title}:`, error);
          failedCount++;

          // Show error toast for individual document
          toast({
            title: "Download Failed",
            description: `Failed to download "${doc.title}"`,
            variant: "destructive",
          });
        }
      }

      // Final summary toast
      if (successCount > 0) {
        toast({
          title: "Download Complete",
          description: `Downloaded ${successCount} of ${latestDocuments.length} documents${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
        });
      } else {
        toast({
          title: "Download Failed",
          description: "No documents were successfully downloaded.",
          variant: "destructive",
        });
      }

    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Remove transcript from downloading state
      setDownloadingTranscripts(prev => {
        const newSet = new Set(prev);
        newSet.delete(transcriptId);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string, transcript?: Transcript) => {
    const isProcessing = processMutation.isPending && processMutation.variables === transcript?.id;

    switch (status) {
      case "processed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 cursor-default pointer-events-none">
            <CheckCircle className="w-3 h-3 mr-1" />
            Processed
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge 
            className={`${isProcessing 
              ? 'bg-amber-100 text-amber-800 cursor-default' 
              : 'bg-blue-100 text-blue-800 hover:bg-blue-300 cursor-pointer'
            }`}
            onClick={() => !isProcessing && transcript && processMutation.mutate(transcript.id)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FileText className="w-3 h-3 mr-1" />
                Process with AI
              </>
            )}
          </Badge>
        );
    }
  };

  const filteredTranscripts = transcripts.filter((transcript) =>
    transcript.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatDate(transcript.uploadDate).toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-900">All Transcripts</h2>
            {!isOnline && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Offline Mode
              </Badge>
            )}
            {isError && isOnline && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Connection Error
              </Badge>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Transcript
            </Button>
          </div>
        </div>
      </div>

      {/* Transcripts List */}
      <Card>
        <CardContent className="p-0">
          {filteredTranscripts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                {searchQuery ? "No transcripts found" : 
                 isError && !isOnline ? "Transcripts unavailable offline" :
                 isError ? "Unable to load transcripts" : 
                 "No transcripts yet"}
              </h3>
              <p className="text-slate-500 mb-6">
                {searchQuery
                  ? "Try adjusting your search query"
                  : isError && !isOnline 
                    ? "Connect to the internet to view your transcripts"
                    : isError
                      ? "There was a problem loading your transcripts. Please try refreshing the page."
                      : "Upload your first transcript to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsUploadModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Transcript
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div className="col-span-4">File Name</div>
                  <div className="col-span-2">Upload Date</div>
                  <div className="col-span-1">Size</div>
                  <div className="col-span-2">Processing</div>
                  <div className="col-span-2">Approval</div>
                  <div className="col-span-1">Actions</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-200">
                {filteredTranscripts.map((transcript) => {
                  return (
                    <TranscriptRow
                      key={transcript.id}
                      transcript={transcript}
                      formatDate={formatDate}
                      formatFileSize={formatFileSize}
                      getStatusBadge={getStatusBadge}
                      arrangements={arrangements}
                      viewArrangement={viewArrangement}
                      viewTranscript={viewTranscript}
                      downloadAllDocuments={downloadAllDocuments}
                      downloadingTranscripts={downloadingTranscripts}
                      setTranscriptToDelete={setTranscriptToDelete}
                      setLocation={setLocation}
                    />
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* View Transcript Modal */}
      <Dialog
        open={!!selectedTranscript}
        onOpenChange={() => setSelectedTranscript(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{selectedTranscript?.filename}</DialogTitle>
              <div className="flex items-center gap-2">
                <TooltipProvider delayDuration={350}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyTranscriptContent}
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Copy</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {selectedTranscript && getStatusBadge(selectedTranscript.status)}
                {selectedTranscript && selectedTranscript.status === "uploaded" && (
                  <Button
                    onClick={() => processMutation.mutate(selectedTranscript.id)}
                    disabled={processMutation.isPending}
                    size="sm"
                  >
                    {processMutation.isPending ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Process with AI
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Search Box */}
            <div className="flex items-center justify-center mt-4">
              <div className="relative flex items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search transcript..."
                    value={transcriptSearchQuery}
                    onChange={(e) => setTranscriptSearchQuery(e.target.value)}
                    className="pl-10 pr-4 w-80"
                  />
                </div>
                {transcriptSearchQuery && searchMatches > 0 && (
                  <div className="ml-3 flex items-center gap-2">
                    <div className="text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded">
                      {currentMatchIndex + 1} of {searchMatches}
                    </div>
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={navigateToPreviousMatch}
                        disabled={searchMatches === 0}
                        className="h-5 w-6 p-0 hover:bg-slate-200"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={navigateToNextMatch}
                        disabled={searchMatches === 0}
                        className="h-5 w-6 p-0 hover:bg-slate-200"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {transcriptSearchQuery && searchMatches === 0 && (
                  <div className="ml-3 text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded">
                    No matches
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto custom-scrollbar">
              <pre
                className="whitespace-pre-wrap text-sm text-slate-700"
                dangerouslySetInnerHTML={{
                  __html: selectedTranscript?.content
                    ? highlightSearchText(selectedTranscript.content, transcriptSearchQuery)
                    : ''
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!transcriptToDelete}
        onOpenChange={() => setTranscriptToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transcript</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{transcriptToDelete?.filename}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (transcriptToDelete) {
                  deleteMutation.mutate(transcriptToDelete.id);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Arrangement View Dialog */}
      <Dialog open={showArrangementView} onOpenChange={setShowArrangementView}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Funeral Arrangement Details</DialogTitle>
          </DialogHeader>
          {arrangementData && (
            <ArrangementView
              arrangementData={arrangementData}
              onSave={async (updatedData) => {
                try {
                  const response = await apiRequest("PUT", `/api/arrangements/${arrangementTranscript?.id}`, {
                    extractedData: JSON.stringify(updatedData)
                  });

                  if (response.ok) {
                    toast({
                      title: "Arrangement Updated",
                      description: "The arrangement details have been saved successfully.",
                    });
                    setArrangementData(updatedData);
                  } else {
                    throw new Error("Failed to save arrangement");
                  }
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to save arrangement",
                    variant: "destructive",
                  });
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TranscriptRow({
  transcript,
  formatDate,
  formatFileSize,
  getStatusBadge,
  arrangements,
  viewArrangement,
  viewTranscript,
  downloadAllDocuments,
  downloadingTranscripts,
  setTranscriptToDelete,
  setLocation,
}: any) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Set a small delay before hiding to allow smooth transitions
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      hoverTimeoutRef.current = null;
    }, 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      key={transcript.id}
      className="px-6 py-4 hover:bg-slate-50 transition-colors relative"
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        <div className="col-span-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-slate-500" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {transcript.filename}
              </p>
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <p className="text-sm text-slate-600">
            {formatDate(transcript.uploadDate)}
          </p>
        </div>
        <div className="col-span-1">
          <p className="text-sm text-slate-600">
            {formatFileSize(transcript.fileSize)}
          </p>
        </div>
        <div className="col-span-2">
          {getStatusBadge(transcript.status, transcript)}
        </div>
        <div className="col-span-2">
          {transcript.status === 'processed' && arrangements[transcript.id] ? (
            arrangements[transcript.id].approvalStatus === 'approved' ? (
              <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 cursor-default pointer-events-none">
                <CheckCircle className="w-3 h-3 mr-1" />
                Approved
              </Badge>
            ) : (
              <Badge
                className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-400 cursor-pointer"
                onClick={() => viewArrangement(transcript)}
              >
                <Clock className="w-3 h-3 mr-1" />
            Review Details
              </Badge>
            )
          ) : transcript.status === 'processed' ? (
            <Badge
              className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-400 cursor-pointer"
              onClick={() => viewArrangement(transcript)}
            >
              <Clock className="w-3 h-3 mr-1" />
            Review Details
            </Badge>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </div>
        <div className="col-span-1">
          <div
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="inline-block relative"
          >
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-slate-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            
            {/* Custom hover menu */}
            {isHovered && (
              <div 
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 z-50"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <div className="py-1">
                  <button
                    onClick={() => viewTranscript(transcript)}
                    className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Transcript
                  </button>
                  
                  {transcript.status === "processed" && (
                    <button
                      onClick={() => viewArrangement(transcript)}
                      className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    >
                      <FileEdit className="mr-2 h-4 w-4" />
                      View Arrangement
                    </button>
                  )}
                  
                  {transcript.status === "processed" &&
                    arrangements[transcript.id] &&
                    arrangements[transcript.id].approvalStatus === 'approved' && (
                      <button
                        onClick={() => setLocation(`/arrangement/${transcript.id}?tab=documents`)}
                        className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Docs
                      </button>
                    )}
                  
                  <div className="border-t border-slate-100 my-1"></div>
                  
                  <button
                    onClick={() => setTranscriptToDelete(transcript)}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}