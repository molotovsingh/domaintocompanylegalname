import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Globe, User, BarChart3, Trash2, GitBranch, Network, Zap } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "@/components/stats-cards";
import FileUpload from "@/components/file-upload";
import ProcessingStatus from "@/components/processing-status";
import ResultsTable from "@/components/results-table";
import ActivityFeed from "@/components/activity-feed";
import SessionResults from "@/components/session-results";
import SingleDomainTest from "@/components/single-domain-test";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Clock, XCircle, Upload, Play, Square, BarChart3, Settings, Globe, Network, TestTube } from "lucide-react";


export default function Dashboard() {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Reduced from 30s to 60s
    staleTime: 45000,
  });

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
    staleTime: 90000,
  });

  const deleteDatabaseMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/database/clear', {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to clear database');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Database cleared",
        description: "All domain data has been successfully deleted.",
      });
      setCurrentBatchId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear database. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBatchUploaded = (batchId: string) => {
    setCurrentBatchId(batchId);
    refetchStats();
  };

  const handleTestCompleted = () => {
    // Switch to the shared single domain tests batch
    setCurrentBatchId('single-domain-tests');
  };

  // Auto-select the most recent batch if none is selected
  useEffect(() => {
    if (!currentBatchId && batches && Array.isArray(batches) && batches.length > 0) {
      // Use the most recent batch (first in the list)
      setCurrentBatchId(batches[0].id);
    }
  }, [batches, currentBatchId]);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-surface shadow-material border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-custom text-white rounded-lg p-2">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-medium text-gray-900">Domain Extractor</h1>
                <p className="text-sm text-gray-600">Extract company names from domains at scale</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <Link href="/parsing-rules" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors">
                Parsing Rules
              </Link>
              <Link href="/jurisdictional-guide" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors">
                Jurisdictions
              </Link>
              <Link href="/knowledge-graph" className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors">
                <GitBranch className="h-4 w-4" />
                Knowledge Graph
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteDatabaseMutation.mutate()}
                disabled={deleteDatabaseMutation.isPending}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4" />
                {deleteDatabaseMutation.isPending ? "Clearing..." : "Clear DB"}
              </Button>
              <div className="w-8 h-8 bg-primary-custom rounded-full flex items-center justify-center text-white text-sm font-medium">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards stats={stats as any} />



        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Upload Section */}
          <FileUpload onBatchUploaded={handleBatchUploaded} />

          {/* Single Domain Test */}
          <SingleDomainTest onTestCompleted={handleTestCompleted} />

          {/* Processing Status */}
          <ProcessingStatus currentBatchId={currentBatchId} />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="results" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Results & Export</TabsTrigger>
            <TabsTrigger value="session">Session Stats</TabsTrigger>
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="mt-0">
            <ResultsTable currentBatchId={currentBatchId} />
          </TabsContent>

          <TabsContent value="session" className="mt-0">
            {currentBatchId ? (
              <SessionResults batchId={currentBatchId} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
                <p className="text-lg">Select a batch to view session statistics</p>
                <p className="text-sm mt-2">Upload and process a file to see detailed metrics including duplicate detection stats</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityFeed />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}