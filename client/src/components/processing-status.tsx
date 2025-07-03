import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Play, Square, AlertTriangle, CheckCircle, Settings, Clock, AlertCircle, Server, StopCircle, RefreshCw } from "lucide-react";

interface ProcessingStatusProps {
  currentBatchId: string | null;
}

export default function ProcessingStatus({ currentBatchId }: ProcessingStatusProps) {
  const [isAborting, setIsAborting] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 120000, // Reduced to 2 minutes
    staleTime: 90000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 60000, // Reduced to 1 minute
    staleTime: 45000,
  });

  // Type-safe batch data access
  const batchesList = Array.isArray(batches) ? batches : [];
  const activeBatch = batchesList.find((b: any) => b.status === 'processing');
  const pendingBatches = batchesList.filter((b: any) => b.status === 'pending');
  const completedBatches = batchesList.filter((b: any) => b.status === 'completed');

  // Determine system status
  const getSystemStatus = () => {
    if (activeBatch) return { status: 'processing', label: 'Processing', color: 'bg-blue-500', icon: Clock };
    if (pendingBatches.length > 0) return { status: 'pending', label: 'Pending', color: 'bg-yellow-500', icon: AlertCircle };
    if (completedBatches.length > 0) return { status: 'idle', label: 'Ready', color: 'bg-green-500', icon: CheckCircle };
    return { status: 'idle', label: 'Ready', color: 'bg-gray-500', icon: Server };
  };

  const systemStatus = getSystemStatus();
  const StatusIcon = systemStatus.icon;

  const totalDomains = (stats as any)?.totalDomains || 0;
  const processedDomains = (stats as any)?.processedDomains || 0;
  const progressPercentage = totalDomains > 0 ? Math.round((processedDomains / totalDomains) * 100) : 0;
  const currentElapsedTime = (stats as any)?.elapsedTime;
  const currentEta = (stats as any)?.eta;

const abortProcessing = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/processing/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to stop processing");
      }

      return response.json();
    },
    onMutate: () => {
      setIsAborting(true);
    },
    onSuccess: (data) => {
      setIsAborting(false);
      if (data.stopped) {
        toast({
          title: "Processing stopped",
          description: "Batch processing has been gracefully aborted",
        });
      } else {
        toast({
          title: "No active processing",
          description: "There was no active processing to stop",
          variant: "destructive",
        });
      }
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    },
    onError: (error: Error) => {
      setIsAborting(false);
      toast({
        title: "Abort failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetLevel2 = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`/api/batches/${batchId}/reset-level2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to reset Level 2");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Level 2 Reset Complete",
        description: `Reset ${data.resetCount} domains for Level 2 reprocessing`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const triggerLevel2 = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`/api/batches/${batchId}/trigger-level2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to trigger Level 2");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Level 2 Processing Started",
        description: `Processing ${data.eligibleCount} eligible domains`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Level 2 trigger failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const recoverBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const response = await fetch(`/api/batches/${batchId}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to recover batch");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Batch Recovery Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Recovery failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Settings className="text-primary-custom mr-2 h-5 w-5" />
          Processing Status
        </h2>
        <p className="text-sm text-gray-600 mt-1">Real-time processing progress and system status</p>
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
          <Badge variant="outline" className="text-xs">
            {processedDomains.toLocaleString()} total processed
          </Badge>
        </div>

        {/* Active Processing */}
        {activeBatch && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Processing: {activeBatch.fileName}
              </span>
              <span className="text-sm text-gray-600">
                {progressPercentage}%
              </span>
            </div>
            <Progress value={progressPercentage} className="w-full h-3" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{processedDomains?.toLocaleString()}</span>
              <span>{totalDomains?.toLocaleString()} domains</span>
            </div>

            {/* Processing Time Counters */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <div className="flex items-center text-xs text-gray-600 mb-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Elapsed Time</span>
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {currentElapsedTime || "0s"}
                </div>
              </div>
              <div className={`p-2 rounded-lg ${currentEta === "Stalled" ? "bg-red-50" : "bg-green-50"}`}>
                <div className="flex items-center text-xs text-gray-600 mb-1">
                  <Settings className="h-3 w-3 mr-1" />
                  <span>ETA</span></div>
                <div className={`text-sm font-medium ${currentEta === "Stalled" ? "text-red-700" : "text-gray-900"}`}>
                  {currentEta || "Unknown"}
                </div>
              </div>
            </div>

            {/* Batch Recovery Button - Show when stalled */}
            {currentEta === "Stalled" && (
              <div className="mt-4 pt-3 border-t border-red-200">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700"
                      disabled={recoverBatch.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {recoverBatch.isPending ? "Recovering..." : "Restart Stuck Batch"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Restart Stuck Batch?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        The batch appears to be stalled with no progress. This will:
                        <br />• Clear any domains stuck in "processing" status
                        <br />• Mark stuck domains as failed with timeout error
                        <br />• Allow processing to continue with remaining domains
                        <br /><br />
                        <strong>Current Progress:</strong> {processedDomains}/{totalDomains} domains ({progressPercentage}%)
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => recoverBatch.mutate(activeBatch.id)}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        Restart Batch
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* Graceful Abort Button */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    disabled={isAborting}
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    {isAborting ? "Stopping..." : "Stop Processing"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Stop Processing?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will gracefully stop the current batch processing. Domains that are currently being processed will be allowed to complete, but no new domains will be started.
                      <br /><br />
                      <strong>Current Progress:</strong> {processedDomains}/{totalDomains} domains ({progressPercentage}%)
                      <br />
                      <strong>Remaining:</strong> {(totalDomains || 0) - (processedDomains || 0)} domains
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => abortProcessing.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, Stop Processing
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        {/* Level 2 Controls for Recent Completed Batch */}
        {completedBatches.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Level 2 Controls</h4>
            <div className="space-y-2">
              <div className="text-xs text-gray-600 mb-2">
                Recent batch: <span className="font-medium">{completedBatches[0].fileName}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetLevel2.mutate(completedBatches[0].id)}
                  disabled={resetLevel2.isPending}
                  className="flex-1"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {resetLevel2.isPending ? "Resetting..." : "Reset Level 2"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => triggerLevel2.mutate(completedBatches[0].id)}
                  disabled={triggerLevel2.isPending}
                  className="flex-1"
                >
                  <Play className="h-3 w-3 mr-1" />
                  {triggerLevel2.isPending ? "Starting..." : "Trigger Level 2"}
                </Button>
              </div>
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
            <StatusIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
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