import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Globe, User, BarChart3, Trash2, Settings, ChevronDown, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StatsCards from "@/components/stats-cards";
import FileUpload from "@/components/file-upload";
import ProcessingStatus from "@/components/processing-status";
import ResultsTable from "@/components/results-table";
import LiveTimestamp from "@/components/live-timestamp";

export default function Dashboard() {
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 600000,
    staleTime: 45000,
  });

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 600000,
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

  // Auto-select the most recent batch if none is selected
  useEffect(() => {
    if (!currentBatchId && batches && Array.isArray(batches) && batches.length > 0) {
      setCurrentBatchId(batches[0].id);
    }
  }, [batches, currentBatchId]);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Simplified Header */}
      <header className="bg-surface shadow-material border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-primary-custom text-white rounded-lg p-2">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-medium text-gray-900">Domain Extractor</h1>
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-600">Extract company names from domains at scale</p>
                  <LiveTimestamp 
                    format="display"
                    className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md"
                    showIcon={true}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/analytics" className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/beta-testing" className="w-full">
                      Beta Testing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/beta-testing-v2" className="w-full">
                      Beta Testing v2
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/knowledge-graph" className="w-full">
                      Knowledge Graph
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/parsing-rules" className="w-full">
                      Parsing Rules
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/jurisdictional-guide" className="w-full">
                      Jurisdictions
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/recent-changes" className="w-full">
                      Recent Changes
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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

        {/* Upload and Processing Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          <FileUpload onBatchUploaded={handleBatchUploaded} />
          <ProcessingStatus currentBatchId={currentBatchId} />
        </div>

        {/* Results Section */}
        <ResultsTable currentBatchId={currentBatchId} />
      </main>
    </div>
  );
}