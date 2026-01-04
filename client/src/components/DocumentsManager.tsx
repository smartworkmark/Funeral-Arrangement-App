import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, CheckCircle, Clock, AlertCircle, Trash2, Loader2, RefreshCw, FileEdit, Settings } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Document {
  id: number;
  arrangementId: number;
  type: string;
  title: string;
  content: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: number;
  arrangementId: number;
  type: string;
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  completed?: boolean;
  completedAt?: string;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DocumentsManagerProps {
  arrangementId: number;
  isApproved: boolean;
}

export default function DocumentsManager({ arrangementId, isApproved }: DocumentsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingDocType, setGeneratingDocType] = useState<string | null>(null);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState(0);
  const [regenerateStep, setRegenerateStep] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [editContent, setEditContent] = useState("");
  const [enhancedFormatting, setEnhancedFormatting] = useState(true);
  const [downloadingDocuments, setDownloadingDocuments] = useState<Set<number>>(new Set());
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Fetch documents for this arrangement
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: [`/api/arrangements/${arrangementId}/documents`],
    enabled: isApproved && !!arrangementId,
  });

  // Fetch tasks for this arrangement
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: [`/api/arrangements/${arrangementId}/tasks`],
    enabled: isApproved && !!arrangementId,
  });

  // Style options for obituary
  const styleOptions = [
    "Formal",
    "Informal", 
    "Ironic",
    "Sarcastic",
    "Humorous",
    "Witty",
    "Serious",
    "Solemn",
    "Optimistic",
    "Hopeful",
    "Cynical",
    "Critical",
    "Sympathetic",
    "Empathetic",
    "Detached",
    "Objective"
  ];

  // Generate individual document
  const generateDocumentMutation = useMutation({
    mutationFn: async ({ type, styles }: { type: string; styles?: string[] }) => {
      setGeneratingDocType(type);

      const payload: any = { 
        arrangementId, 
        type, 
        enhanced: enhancedFormatting 
      };

      if (styles && styles.length > 0) {
        payload.styleSpecifications = styles;
      }

      const response = await fetch('/api/documents/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to generate document');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      setGeneratingDocType(null);
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementId}/documents`] });
      toast({
        title: "Document Generated",
        description: `${getDocumentTypeDisplay(variables.type)} has been generated successfully.`,
      });
    },
    onError: (error, variables) => {
      setGeneratingDocType(null);
      toast({
        title: "Generation Failed",
        description: `Failed to generate ${getDocumentTypeDisplay(variables.type)}. Please try again.`,
        variant: "destructive",
      });
    },
  });

  // Regenerate all documents
  const regenerateAllDocumentsMutation = useMutation({
    mutationFn: async () => {
      // Show processing dialog and start progress simulation
      setShowRegenerateDialog(true);
      setRegenerateProgress(0);
      setRegenerateStep("Initializing document regeneration...");

      // Simulate progress updates during the long API call
      const progressInterval = setInterval(() => {
        setRegenerateProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 12, 90);
          if (newProgress < 20) {
            setRegenerateStep("Analyzing arrangement data...");
          } else if (newProgress < 40) {
            setRegenerateStep("Regenerating contract and summary documents...");
          } else if (newProgress < 60) {
            setRegenerateStep("Recreating obituary and death certificate info...");
          } else if (newProgress < 80) {
            setRegenerateStep("Regenerating funeral director task list...");
          } else {
            setRegenerateStep("Recreating family arranger to-do list...");
          }
          return newProgress;
        });
      }, 4000);

      try {
        const response = await fetch(`/api/arrangements/${arrangementId}/regenerate-all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to regenerate documents');
        }

        const data = await response.json();

        // Complete the progress
        clearInterval(progressInterval);
        setRegenerateProgress(100);
        setRegenerateStep("All documents regenerated successfully!");

        // Keep dialog open briefly to show completion
        setTimeout(() => {
          setShowRegenerateDialog(false);
        }, 1500);

        return data;
      } catch (error) {
        clearInterval(progressInterval);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementId}/documents`] });
      toast({
        title: "Documents Regenerated",
        description: `All documents regenerated successfully. ${data.documents?.length || 6} documents created.`,
      });
    },
    onError: (error) => {
      setShowRegenerateDialog(false);
      toast({
        title: "Regeneration Failed",
        description: `Failed to regenerate documents: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Edit document content
  const editDocumentMutation = useMutation({
    mutationFn: async ({ documentId, plainTextContent }: { documentId: number; plainTextContent: string }) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ plainTextContent, enhanced: enhancedFormatting })
      });

      if (!response.ok) {
        throw new Error('Failed to update document');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementId}/documents`] });
      toast({
        title: "Document Updated",
        description: "Document content has been updated successfully.",
      });
      setEditingDocument(null);
      setEditContent("");
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update task status
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<Task> }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementId}/tasks`] });
      toast({
        title: "Task Updated",
        description: "The task has been updated successfully.",
      });
    },
  });

  // Delete document
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementId}/documents`] });
      toast({
        title: "Document Deleted",
        description: "Document has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk download documents
  const bulkDownloadDocuments = async () => {
    if (selectedDocuments.size === 0) return;

    setBulkDownloading(true);
    const selectedDocs = documents.filter(doc => selectedDocuments.has(doc.id));
    let successCount = 0;
    let failedCount = 0;

    // Initial toast
    toast({
      title: "Bulk Download Started",
      description: `Processing ${selectedDocs.length} documents...`,
    });

    try {
      for (let i = 0; i < selectedDocs.length; i++) {
        const doc = selectedDocs[i];
        try {
          // Show processing toast
          toast({
            title: "Processing Document",
            description: `Processing "${doc.title}" (${i + 1} of ${selectedDocs.length})...`,
          });

          await downloadDocument(doc);
          successCount++;

          // Show success toast for individual document
          toast({
            title: "Document Downloaded",
            description: `"${doc.title}" downloaded successfully`,
          });

          // Small delay between downloads to prevent overwhelming the webhook
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
          title: "Bulk Download Complete",
          description: `Downloaded ${successCount} of ${selectedDocs.length} documents${failedCount > 0 ? ` (${failedCount} failed)` : ''}.`,
        });
      } else {
        toast({
          title: "Bulk Download Failed",
          description: "No documents were successfully downloaded.",
          variant: "destructive",
        });
      }

      setSelectedDocuments(new Set());
    } catch (error) {
      toast({
        title: "Bulk Download Failed",
        description: "Failed to process documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkDownloading(false);
    }
  };

  // Bulk delete documents
  const bulkDeleteDocuments = async () => {
    if (selectedDocuments.size === 0) return;

    setBulkDeleting(true);
    const selectedDocIds = Array.from(selectedDocuments);

    try {
      await Promise.all(
        selectedDocIds.map(id => deleteDocumentMutation.mutateAsync(id))
      );

      toast({
        title: "Bulk Delete Complete",
        description: `Successfully deleted ${selectedDocIds.length} documents.`,
      });
      setSelectedDocuments(new Set());
    } catch (error) {
      toast({
        title: "Bulk Delete Failed",
        description: "Some documents failed to delete. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  // Toggle document selection
  const toggleDocumentSelection = (documentId: number) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else {
      newSelection.add(documentId);
    }
    setSelectedDocuments(newSelection);
  };

  // Select all documents
  const selectAllDocuments = () => {
    if (selectedDocuments.size === documents.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(documents.map(doc => doc.id)));
    }
  };

  const downloadDocument = async (doc: Document) => {
    setDownloadingDocuments(prev => new Set(prev).add(doc.id));
    try {
      const token = localStorage.getItem("auth_token");

      // First, get the user information and document content
      const userResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user information');
      }

      const user = await userResponse.json();

      // Get the document's markdown text
      const docResponse = await fetch(`/api/documents/${doc.id}/content`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!docResponse.ok) {
        throw new Error('Failed to get document content');
      }

      const docData = await docResponse.json();

      // Send webhook request
      const webhookPayload = {
        docName: doc.type,
        markdownText: docData.plainTextContent || docData.content,
        userId: user.id.toString(),
        userEmail: user.email
      };

      console.log('Sending webhook payload:', webhookPayload);

      const webhookResponse = await fetch('https://hook.us2.make.com/1hsglqsybtqd88jxtq88ghvijr61vw4l', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('Webhook error response:', errorText);
        throw new Error(`Webhook request failed: ${webhookResponse.status} ${webhookResponse.statusText}`);
      }

      const webhookResult = await webhookResponse.json();
      console.log('Webhook response:', webhookResult);

      // Download the document from the provided URL
      if (webhookResult.downloadUrl) {
        try {
          // For Google Docs URLs, we need to handle them differently
          if (webhookResult.downloadUrl.includes('docs.google.com')) {
            // Open Google Docs URL in new tab for user to download manually
            window.open(webhookResult.downloadUrl, '_blank');

            toast({
              title: "Download Ready",
              description: `${doc.title} has been processed. The document will open in a new tab for download.`,
            });
          } else {
            // Try direct download for other URLs
            const response = await fetch(webhookResult.downloadUrl);

            if (!response.ok) {
              throw new Error(`Download failed: ${response.status}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${doc.title}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
              title: "Download Complete",
              description: `${doc.title} has been downloaded successfully.`,
            });
          }
        } catch (downloadError) {
          console.error('Direct download failed, opening in new tab:', downloadError);
          // Fallback: open in new tab
          window.open(webhookResult.downloadUrl, '_blank');

          toast({
            title: "Download Ready",
            description: `${doc.title} has been processed. The document will open in a new tab for download.`,
          });
        }
      } else {
        throw new Error('No download URL received from webhook response');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to process and download document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(doc.id);
        return newSet;
      });
    }
  };

  const getDocumentTypeDisplay = (type: string) => {
    const types: Record<string, string> = {
      contract: 'Service Contract',
      summary: 'Arrangement Summary',
      obituary: 'Obituary',
      tasks: 'Funeral Director Tasks',
      arranger_tasks: 'Family Arranger To-Do List',
      death_cert: 'Death Certificate Info'
    };
    return types[type] || type;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleTaskCompletion = (task: Task) => {
    updateTaskMutation.mutate({
      taskId: task.id,
      updates: {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : undefined
      }
    });
  };

  const handleEditDocument = (doc: Document) => {
    // Use plain text content for editing, fallback to helpful message if not available
    const plainText = (doc as any).plainTextContent || 
      'Plain text content is not available for this document. Please regenerate the document to enable editing.';
    setEditContent(plainText);
    setEditingDocument(doc);
  };

  const handleSaveEditedDocument = () => {
    if (!editingDocument) return;

    editDocumentMutation.mutate({
      documentId: editingDocument.id,
      plainTextContent: editContent
    });
  };

  const handleStyleSelection = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) 
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const handleRegenerateWithStyles = () => {
    generateDocumentMutation.mutate({ 
      type: 'obituary', 
      styles: selectedStyles 
    });
    setShowStyleDialog(false);
    setSelectedStyles([]);
  };

  const openStyleDialog = () => {
    setSelectedStyles([]);
    setShowStyleDialog(true);
  };

  if (!isApproved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Documents & Tasks
          </CardTitle>
          <CardDescription>
            Documents and tasks will be available after the arrangement is approved.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          {/* PDF Formatting Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">PDF Formatting Options</CardTitle>
              <CardDescription>
                Choose your preferred formatting style for generated documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="enhanced-formatting" className="text-base font-medium">
                    Enhanced Typography & Formatting
                  </Label>
                  <p className="text-sm text-gray-600">
                    {enhancedFormatting 
                      ? "Professional layout with rich typography, improved spacing, and enhanced visual styling" 
                      : "Basic PDF layout with standard formatting"}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    {enhancedFormatting && (
                      <div className="space-y-1">
                        <div>• Professional fonts and improved typography</div>
                        <div>• Enhanced headers, spacing, and visual hierarchy</div>
                        <div>• Rich text formatting (bold, italic, underline)</div>
                        <div>• Better bullet points and list formatting</div>
                        <div>• Color-coded sections and highlight boxes</div>
                        <div>• Professional page headers and footers</div>
                      </div>
                    )}
                  </div>
                </div>
                <Switch
                  id="enhanced-formatting"
                  checked={enhancedFormatting}
                  onCheckedChange={setEnhancedFormatting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Generated Documents
                  </CardTitle>
                  <CardDescription>
                    Download or regenerate arrangement documents
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {documents.length > 0 && selectedDocuments.size > 0 && (
                    <>
                      <Button
                        onClick={bulkDownloadDocuments}
                        disabled={bulkDownloading || bulkDeleting || downloadingDocuments.size > 0}
                        variant="outline"
                        size="sm"
                      >
                        {bulkDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download Selected ({selectedDocuments.size})
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={bulkDeleteDocuments}
                        disabled={bulkDownloading || bulkDeleting || downloadingDocuments.size > 0}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        {bulkDeleting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Selected ({selectedDocuments.size})
                          </>
                        )}
                      </Button>
                    </>
                  )}
                  {documents.length > 0 && (
                    <Button
                      onClick={() => regenerateAllDocumentsMutation.mutate()}
                      disabled={regenerateAllDocumentsMutation.isPending || generateDocumentMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recreate All Documents
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="text-center py-8">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No documents generated yet.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['contract', 'summary', 'obituary', 'tasks', 'arranger_tasks', 'death_cert'].map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        onClick={() => generateDocumentMutation.mutate({ type })}
                        disabled={generateDocumentMutation.isPending || generatingDocType === type}
                      >
                        {generatingDocType === type ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          `Generate ${getDocumentTypeDisplay(type)}`
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Select All Checkbox */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <Checkbox
                      checked={documents.length > 0 && selectedDocuments.size === documents.length}
                      onCheckedChange={selectAllDocuments}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">
                      Select All ({documents.length} documents)
                    </span>
                    {selectedDocuments.size > 0 && (
                      <span className="text-sm text-blue-600">
                        {selectedDocuments.size} selected
                      </span>
                    )}
                  </div>

                  {/* Documents List */}
                  <div className="grid gap-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className={`flex items-center justify-between p-4 border rounded-lg relative ${generatingDocType === doc.type ? 'opacity-50' : ''} ${selectedDocuments.has(doc.id) ? 'bg-blue-50 border-blue-200' : ''}`}>
                        {generatingDocType === doc.type && (
                          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                            <div className="flex items-center space-x-2 text-primary">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span className="font-medium">Regenerating {getDocumentTypeDisplay(doc.type)}...</span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedDocuments.has(doc.id)}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                            className="w-4 h-4"
                          />
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="font-medium">{doc.title}</h4>
                            <p className="text-sm text-gray-500">
                              {getDocumentTypeDisplay(doc.type)} • 
                              Generated {new Date(doc.createdAt).toLocaleDateString()} at {new Date(doc.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {doc.status || 'generated'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadDocument(doc)}
                            disabled={downloadingDocuments.has(doc.id)}
                          >
                            {downloadingDocuments.has(doc.id) ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Downloading...
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDocument(doc)}
                          >
                            <FileEdit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          {doc.type === 'obituary' ? (
                            <TooltipProvider>
                              <Tooltip delayDuration={300}>
                                <TooltipTrigger asChild>
                                  <div className="relative">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => generateDocumentMutation.mutate({ type: doc.type })}
                                      disabled={generateDocumentMutation.isPending || generatingDocType === doc.type}
                                    >
                                      {generatingDocType === doc.type ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                          Creating...
                                        </>
                                      ) : (
                                        'Recreate'
                                      )}
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={openStyleDialog}
                                    className="flex items-center gap-1 p-2"
                                  >
                                    <Settings className="w-3 h-3" />
                                    Style specification
                                  </Button>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generateDocumentMutation.mutate({ type: doc.type })}
                              disabled={generateDocumentMutation.isPending || generatingDocType === doc.type}
                            >
                              {generatingDocType === doc.type ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                'Recreate'
                              )}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteDocumentMutation.mutate(doc.id)}
                            disabled={deleteDocumentMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Funeral Tasks
              </CardTitle>
              <CardDescription>
                Track and manage arrangement tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tasks available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <button
                        onClick={() => toggleTaskCompletion(task)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                          task.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {task.completed && <CheckCircle className="w-3 h-3" />}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className={`font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                          </h4>
                          {task.priority && (
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          )}
                          {task.dueDate && (
                            <span className="text-sm text-gray-500">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className={`text-sm whitespace-pre-wrap ${
                            task.completed ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>Created {new Date(task.createdAt).toLocaleDateString()}</span>
                          {task.completed && task.completedAt && (
                            <span>Completed {new Date(task.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Document Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={() => {
        setEditingDocument(null);
        setEditContent("");
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="w-5 h-5" />
              Edit Document: {editingDocument?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            <div className="text-sm text-gray-600">
              Document Type: {editingDocument ? getDocumentTypeDisplay(editingDocument.type) : ''}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Document Content:</label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-enhanced-formatting" className="text-sm">
                    Enhanced Formatting:
                  </Label>
                  <Switch
                    id="edit-enhanced-formatting"
                    checked={enhancedFormatting}
                    onCheckedChange={setEnhancedFormatting}
                  />
                </div>
              </div>
              {enhancedFormatting && (
                <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border space-y-1">
                  <div className="font-medium">Formatting Guide:</div>
                  <div><strong># Header 1</strong> • <strong>## Header 2</strong> • <strong>### Header 3</strong></div>
                  <div><strong>**Bold text**</strong> • <strong>*Italic text*</strong> • <strong>__Underlined text__</strong></div>
                  <div><strong>* Bullet point</strong> • <strong>1. Numbered list</strong></div>
                  <div><strong>{">"} Blockquote</strong> • <strong>!!! Important note</strong> • <strong>!! Info note</strong></div>
                </div>
              )}
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[350px] font-mono text-sm resize-none"
                placeholder="Document content..."              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setEditingDocument(null);
                setEditContent("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditedDocument}
              disabled={editDocumentMutation.isPending}
            >
              {editDocumentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Style Specification Dialog */}
      <Dialog open={showStyleDialog} onOpenChange={setShowStyleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Obituary Style Specification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select the tonal style(s) you want for the obituary:
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {styleOptions.map((style) => (
                <div key={style} className="flex items-center space-x-2">
                  <Checkbox
                    id={style}
                    checked={selectedStyles.includes(style)}
                    onCheckedChange={() => handleStyleSelection(style)}
                  />
                  <Label htmlFor={style} className="text-sm cursor-pointer">
                    {style}
                  </Label>
                </div>
              ))}
            </div>
            {selectedStyles.length > 0 && (
              <div className="text-sm text-blue-600">
                Selected: {selectedStyles.join(", ")}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowStyleDialog(false);
                setSelectedStyles([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateWithStyles}
              disabled={generateDocumentMutation.isPending}
            >
              {generateDocumentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Recreate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate All Documents Progress Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Recreating All Documents
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(regenerateProgress)}%</span>
              </div>
              <Progress value={regenerateProgress} className="h-2" />
            </div>
            <p className="text-sm text-muted-foreground">{regenerateStep}</p>
            <div className="text-xs text-muted-foreground">
              This process generates all 6 document types and may take up to 2-3 minutes to complete.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}