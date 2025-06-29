import { useQuery } from "@tanstack/react-query";
import { Settings, Server, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProcessingStatusProps {
  currentBatchId: string | null;
}

export default function ProcessingStatus({ currentBatchId }: ProcessingStatusProps) {
  const { data: batchData } = useQuery({
    queryKey: ["/api/results", currentBatchId],
    enabled: !!currentBatchId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  });

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 3000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  const batch = batchData?.batch;
  const progressPercentage = batch ? (batch.processedDomains / batch.totalDomains) * 100 : 0;
  
  // Find active processing batches
  const activeBatch = Array.isArray(batches) ? batches.find((b: any) => b.status === 'processing') : null;
  const pendingBatches = Array.isArray(batches) ? batches.filter((b: any) => b.status === 'pending') : [];
  const completedBatches = Array.isArray(batches) ? batches.filter((b: any) => b.status === 'completed') : [];
  
  // Determine system status
  const getSystemStatus = () => {
    if (activeBatch) return { status: 'processing', label: 'Processing', color: 'bg-blue-500' };
    if (pendingBatches.length > 0) return { status: 'pending', label: 'Pending', color: 'bg-yellow-500' };
    if (completedBatches.length > 0) return { status: 'idle', label: 'Ready', color: 'bg-green-500' };
    return { status: 'idle', label: 'Ready', color: 'bg-gray-500' };
  };
  
  const systemStatus = getSystemStatus();

  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Settings className="text-primary-custom mr-2 h-5 w-5" />
          Processing Status
        </h2>
        <p className="text-sm text-gray-600 mt-1">Real-time processing progress and worker status</p>
      </div>
      <CardContent className="p-6">
        {/* System Status Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full ${systemStatus.color} mr-2`}></div>
            <span className="text-sm font-medium text-gray-700">
              System Status: {systemStatus.label}
            </span>
          </div>
          {stats && (
            <Badge variant="outline" className="text-xs">
              {stats.totalDomains?.toLocaleString()} total processed
            </Badge>
          )}
        </div>

        {/* Active Processing */}
        {activeBatch && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Processing: {activeBatch.fileName}
              </span>
              <span className="text-sm text-gray-600">
                {Math.round((activeBatch.processedDomains / activeBatch.totalDomains) * 100)}%
              </span>
            </div>
            <Progress value={(activeBatch.processedDomains / activeBatch.totalDomains) * 100} className="w-full h-3" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{activeBatch.processedDomains?.toLocaleString()}</span>
              <span>{activeBatch.totalDomains?.toLocaleString()} domains</span>
            </div>
          </div>
        )}

        {/* Pending Batches */}
        {pendingBatches.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Pending Batches</span>
              <Badge variant="secondary">{pendingBatches.length}</Badge>
            </div>
            <div className="space-y-2">
              {pendingBatches.slice(0, 3).map((batch: any) => (
                <div key={batch.id} className="flex items-center justify-between text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                  <span>{batch.fileName}</span>
                  <span>{batch.totalDomains} domains</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Ready State */}
        {!activeBatch && pendingBatches.length === 0 && (
          <div className="text-center p-6 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-700 font-medium">System Ready</p>
            <p className="text-xs text-gray-600 mt-1">
              {completedBatches.length > 0 
                ? `${completedBatches.length} batches completed • Upload new domains to process`
                : 'Upload a file to begin processing'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
