import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Globe, User, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatsCards from "@/components/stats-cards";
import FileUpload from "@/components/file-upload";
import ProcessingStatus from "@/components/processing-status";
import ResultsTable from "@/components/results-table";
import ActivityFeed from "@/components/activity-feed";
import SessionResults from "@/components/session-results";

export default function Dashboard() {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 10000,
  });

  const handleBatchUploaded = (batchId: string) => {
    setCurrentBatchId(batchId);
    refetchStats();
  };

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
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Admin User</p>
                <p className="text-xs text-gray-600">Administrator</p>
              </div>
              <div className="w-8 h-8 bg-primary-custom rounded-full flex items-center justify-center text-white text-sm font-medium">
                <User className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Upload Section */}
          <FileUpload onBatchUploaded={handleBatchUploaded} />

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
