import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import ArrangementView from "@/components/ArrangementView";
import DocumentsManager from "@/components/DocumentsManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, Clock, Loader2, FileText, CheckCheck } from "lucide-react";

export default function ArrangementPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApproved, setIsApproved] = useState(false);
  const [showProcessingDialog, setShowProcessingDialog] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState("");

  // Get URL search parameters for tab selection
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'arrangement';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Fetch transcript and arrangement data
  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: [`/api/transcripts/${id}`],
    enabled: !!id,
  });

  const { data: arrangement, isLoading: arrangementLoading } = useQuery({
    queryKey: [`/api/transcripts/${id}/arrangement`],
    enabled: !!id,
  });

  // Update arrangement data
  const updateArrangementMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("=== UPDATE MUTATION STARTED ===");
      console.log("Data to save:", data);
      
      return apiRequest('PUT', `/api/transcripts/${id}/arrangement`, { extractedData: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transcripts/${id}/arrangement`] });
      toast({
        title: "Arrangement Updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error) => {
      console.error("=== UPDATE MUTATION ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", (error as Error).message);
      toast({
        title: "Update Failed",
        description: `Failed to save changes: ${(error as Error).message}`,
        variant: "destructive",
      });
    },
  });

  // Approve arrangement and generate documents
  const approveArrangementMutation = useMutation({
    mutationFn: async () => {
      console.log('Approval mutation triggered');
      const arrangementObj = arrangement as any;
      console.log('Arrangement ID:', arrangementObj.id);

      // Show processing dialog and start progress simulation
      setShowProcessingDialog(true);
      setProcessingProgress(0);
      setProcessingStep("Initializing document generation...");

      // Simulate progress updates during the long API call
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 12, 90);
          if (newProgress < 20) {
            setProcessingStep("Analyzing arrangement data...");
          } else if (newProgress < 40) {
            setProcessingStep("Generating contract and summary documents...");
          } else if (newProgress < 60) {
            setProcessingStep("Creating obituary and death certificate info...");
          } else if (newProgress < 80) {
            setProcessingStep("Generating funeral director task list...");
          } else {
            setProcessingStep("Creating family arranger to-do list...");
          }
          return newProgress;
        });
      }, 8000);

      try {
        const token = localStorage.getItem("auth_token");
        console.log('Auth token exists:', !!token);
        console.log('Making request to:', `/api/arrangements/${arrangementObj.id}/approve`);

        const response = await apiRequest('POST', `/api/arrangements/${arrangementObj.id}/approve`);
        console.log('API response received:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        // Complete the progress
        clearInterval(progressInterval);
        setProcessingProgress(100);
        setProcessingStep("Documents generated successfully!");

        // Keep dialog open briefly to show completion
        setTimeout(() => {
          setShowProcessingDialog(false);
        }, 1500);

        return data;
      } catch (error) {
        clearInterval(progressInterval);
        setShowProcessingDialog(false);
        console.error('API request failed:', error);
        console.error('Error details:', (error as Error).message);
        throw error;
      }
    },
    onSuccess: (data) => {
      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [`/api/transcripts/${id}/arrangement`] });
      const arrangementObj = arrangement as any;
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementObj.id}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/arrangements/${arrangementObj.id}/tasks`] });
      // Invalidate the arrangements status query to update transcript list
      queryClient.invalidateQueries({ queryKey: ["/api/arrangements/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transcripts"] });

      // Switch to documents tab after successful approval
      setActiveTab("documents");

      toast({
        title: "Arrangement Approved",
        description: `Documents generated successfully. ${data.documents?.length || 0} documents created.`,
      });
    },
    onError: (error) => {
      console.error('Approval mutation error:', error);
      toast({
        title: "Approval Failed",
        description: `Failed to approve arrangement: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // PDF export
  const exportPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/transcripts/${id}/export-pdf`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arrangement-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "The arrangement PDF has been downloaded successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (arrangement && typeof arrangement === 'object' && 'approvalStatus' in arrangement) {
      setIsApproved((arrangement as any).approvalStatus === 'approved');
    }
  }, [arrangement]);

  if (transcriptLoading || arrangementLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading arrangement details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!transcript || !arrangement) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Arrangement Not Found</h2>
          <p className="text-gray-600 mb-6">The requested arrangement could not be found.</p>
          <Button onClick={() => setLocation('/transcripts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transcripts
          </Button>
        </div>
      </Layout>
    );
  }

  const arrangementObj = arrangement as any;
  const arrangementData = arrangementObj?.extractedData ? JSON.parse(arrangementObj.extractedData) : null;

  if (!arrangementData) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">No Arrangement Data</h2>
          <p className="text-gray-600 mb-6">This transcript has not been processed yet.</p>
          <Button onClick={() => setLocation('/transcripts')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Transcripts
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={() => setLocation('/transcripts')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Transcripts
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Arrangement Details
              </h1>
              <p className="text-gray-600">
                {arrangementData.arrangement?.basic_information?.deceased_name ? 
                  `${arrangementData.arrangement.basic_information.deceased_name.first} ${arrangementData.arrangement.basic_information.deceased_name.last}` : 
                  'Unnamed Arrangement'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isApproved ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-md border border-green-200">
                <CheckCircle className="w-4 h-4" />
                Approved
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-md border border-yellow-200">
                <Clock className="w-4 h-4" />
                Pending Approval
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="arrangement">1. Arrangement Details</TabsTrigger>
            <TabsTrigger value="documents">2. Documents & Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="arrangement" className="space-y-6">
            <ArrangementView
              arrangementData={arrangementData}
              onSave={(data) => updateArrangementMutation.mutate(data)}
              onDownloadPDF={() => exportPDFMutation.mutate()}
              onApprove={() => {
                console.log('Approve button clicked');
                approveArrangementMutation.mutate();
              }}
              isApproved={isApproved}
            />
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <DocumentsManager
              arrangementId={(arrangement as any).id}
              isApproved={isApproved}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Processing Dialog */}
      <Dialog open={showProcessingDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              Processing Arrangement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-gray-600">
              {processingStep}
            </div>
            <Progress value={processingProgress} className="w-full" />
            <div className="text-xs text-gray-500 text-center">
              {Math.round(processingProgress)}% complete
            </div>
            {processingProgress === 100 && (
              <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                <CheckCircle className="w-4 h-4" />
                All documents generated successfully!
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}