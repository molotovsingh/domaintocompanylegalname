import { useQuery } from "@tanstack/react-query";
import { Settings, Server } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ProcessingStatusProps {
  currentBatchId: string | null;
}

export default function ProcessingStatus({ currentBatchId }: ProcessingStatusProps) {
  const { data: batchData } = useQuery({
    queryKey: ["/api/results", currentBatchId],
    enabled: !!currentBatchId,
    refetchInterval: 2000, // Refetch every 2 seconds for real-time updates
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  const batch = batchData?.batch;
  const progressPercentage = batch ? (batch.processedDomains / batch.totalDomains) * 100 : 0;

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
        {/* Current Job Progress */}
        {batch && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Current Batch: {batch.fileName}
              </span>
              <span className="text-sm text-gray-600">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="w-full h-3" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{batch.processedDomains?.toLocaleString()}</span>
              <span>{batch.totalDomains?.toLocaleString()} domains</span>
            </div>
          </div>
        )}

        {/* System Status */}
        {!batch && (
          <div className="text-center p-6 bg-gray-50 rounded-lg">
            <Server className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No active processing</p>
            <p className="text-xs text-gray-500 mt-1">Upload a file to begin</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
