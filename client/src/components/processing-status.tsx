import { useQuery } from "@tanstack/react-query";
import { Settings, Server, Plus } from "lucide-react";
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

        {/* Processing Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">Rate</p>
            <p className="text-lg font-bold text-gray-900">
              {stats?.processingRate?.toLocaleString() || 0}/min
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 uppercase tracking-wide">ETA</p>
            <p className="text-lg font-bold text-gray-900">
              {stats?.eta || '--'}
            </p>
          </div>
        </div>

        {/* Worker Status */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <Server className="text-gray-400 mr-2 h-4 w-4" />
            Active Workers
          </h3>

          {/* Mock Worker Status - would be replaced with real data */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-success rounded-full mr-3"></div>
              <span className="text-sm font-medium text-gray-700">Worker-01</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Processing</p>
              <p className="text-xs text-gray-500">156/min</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-success rounded-full mr-3"></div>
              <span className="text-sm font-medium text-gray-700">Worker-02</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Processing</p>
              <p className="text-xs text-gray-500">142/min</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-warning rounded-full mr-3"></div>
              <span className="text-sm font-medium text-gray-700">Worker-03</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600">Throttled</p>
              <p className="text-xs text-gray-500">Rate limited</p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-primary-custom border-primary-custom hover:bg-primary-custom hover:bg-opacity-5"
          >
            <Plus className="mr-2 h-4 w-4" />
            Scale Workers
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
