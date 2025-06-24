import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Globe, User } from "lucide-react";
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

        {/* Results Section */}
        <ResultsTable currentBatchId={currentBatchId} />

        {/* Activity Feed */}
        <ActivityFeed />
      </main>
    </div>
  );
}
