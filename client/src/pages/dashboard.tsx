import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import UploadModal from "@/components/UploadModal";
import ArrangementView from "@/components/ArrangementView";
import {
  FileText,
  CheckCircle,
  Clock,
  Calendar,
  Upload,
  Search,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
  FileEdit,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}
import type { Transcript } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [viewingTranscript, setViewingTranscript] = useState<Transcript | null>(null);
  const [arrangementData, setArrangementData] = useState<any>(null);
  const [transcriptToDelete, setTranscriptToDelete] = useState<Transcript | null>(null);
  const [showArrangementView, setShowArrangementView] = useState(false);
  const [arrangementTranscript, setArrangementTranscript] = useState<Transcript | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<{
    total: number;
    processed: number;
    pending: number;
    monthly: number;
    reviewRequired: number;
    documents: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentTranscripts = [] } = useQuery<Transcript[]>({
    queryKey: ["/api/dashboard/recent"],
  });

  // Fetch arrangement data for each transcript to show approval status
  const { data: arrangements = {} } = useQuery({
    queryKey: ["/api/arrangements/status"],
    queryFn: async () => {
      const arrangementsMap: Record<number, any> = {};

      for (const transcript of recentTranscripts) {
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
    enabled: recentTranscripts.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/transcripts/${id}`);
      await throwIfResNotOk(response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transcripts"] });
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

  const handleViewTranscript = (transcript: Transcript) => {
    setViewingTranscript(transcript);
  };

  const handleViewArrangement = async (transcript: Transcript) => {
    try {
      const response = await apiRequest("GET", `/api/arrangements/${transcript.id}`);
      const arrangement = await response.json();
      
      if (arrangement.extractedData) {
        const parsedData = JSON.parse(arrangement.extractedData);
        setArrangementData(parsedData);
        setArrangementTranscript(transcript);
        setShowArrangementView(true);
      } else {
        toast({
          title: "No arrangement data found",
          description: "This transcript has been processed but no arrangement data is available.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load arrangement data",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTranscript = (transcript: Transcript) => {
    setTranscriptToDelete(transcript);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return d.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processed":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Processed
          </Badge>
        );
      case "processing":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            <Clock className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <FileText className="w-3 h-3 mr-1" />
            Uploaded
          </Badge>
        );
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              Welcome back, {user?.name?.split(" ")[0]}
            </h2>
            <p className="mt-1 text-slate-500">
              Here's what's happening with your arrangements today.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button onClick={() => setIsUploadModalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Transcript
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500">
                    Total Transcripts
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats?.total || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500">Processed</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats?.processed || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Eye className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500">Review Required</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats?.reviewRequired || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FileEdit className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500">Documents</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats?.documents || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-500">Processed this Month</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats?.monthly || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transcripts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Transcripts</CardTitle>
                <Link href="/transcripts">
                  <a className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    View all
                  </a>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentTranscripts.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                  <p>No transcripts uploaded yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="mt-4"
                  >
                    Upload your first transcript
                  </Button>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-3 gap-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <div>Name</div>
                      <div>Processing</div>
                      <div>Approval</div>
                    </div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-200">
                    {recentTranscripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className="px-6 py-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="grid grid-cols-3 gap-4 items-center">
                          <div>
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
                                <p className="text-sm text-slate-500">
                                  {formatDate(transcript.uploadDate)} • {formatFileSize(transcript.fileSize)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div>
                            <Badge className={
                              transcript.status === "processed" 
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 cursor-default pointer-events-none"
                                : transcript.status === "processing"
                                ? "bg-amber-100 text-amber-800 hover:bg-amber-100 cursor-default pointer-events-none"
                                : "bg-blue-100 text-blue-800 hover:bg-blue-100 cursor-default pointer-events-none"
                            }>
                              {transcript.status === "processed" ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Processed
                                </>
                              ) : transcript.status === "processing" ? (
                                <>
                                  <Clock className="w-3 h-3 mr-1" />
                                  Processing
                                </>
                              ) : (
                                <>
                                  <FileText className="w-3 h-3 mr-1" />
                                  Uploaded
                                </>
                              )}
                            </Badge>
                          </div>
                          <div>
                            {transcript.status === 'processed' && arrangements[transcript.id] ? (
                              arrangements[transcript.id].approvalStatus === 'approved' ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 cursor-default pointer-events-none">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 cursor-default pointer-events-none">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </Badge>
                              )
                            ) : transcript.status === 'processed' ? (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 cursor-default pointer-events-none">
                                <Clock className="w-3 h-3 mr-1" />
                                Pending
                              </Badge>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Upload</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                onClick={() => setIsUploadModalOpen(true)}
              >
                <div className="w-12 h-12 mx-auto bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-primary-600" />
                </div>
                <p className="text-sm font-medium text-slate-900 mb-1">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Support for .txt and .pdf files up to 10MB
                </p>
              </div>

              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Enter Text Directly
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Search */}
          <Card>
            <CardHeader>
              <CardTitle>Search Transcripts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by filename or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchQuery && (
                <div className="mt-4">
                  <Link href={`/transcripts?search=${encodeURIComponent(searchQuery)}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-2 h-4 w-4" />
                      View Search Results
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* Transcript Viewing Dialog */}
      <Dialog open={!!viewingTranscript} onOpenChange={() => setViewingTranscript(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transcript: {viewingTranscript?.filename}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded border">
            {viewingTranscript?.content}
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
