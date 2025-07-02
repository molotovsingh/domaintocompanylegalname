import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Server, CheckCircle, AlertCircle, Clock, StopCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface ProcessingStatusProps {
  currentBatchId: string | null;
}

export default function ProcessingStatus({ currentBatchId }: ProcessingStatusProps) {
  const [elapsedTime, setElapsedTime] = useState<string>("");
  const [processingRate, setProcessingRate] = useState<number>(0);
  const [eta, setEta] = useState<string>("");
  const [isAborting, setIsAborting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: batches } = useQuery({
    queryKey: ["/api/batches"],
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 15000,
    staleTime: 10000,
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
  const elapsedTime = (stats as any)?.elapsedTime;
  const eta = (stats as any)?.eta;

  const abortProcessing = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stop-processing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to stop processing');
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
                  {elapsedTime || "0s"}
                </div>
              </div>
              <div className={`p-2 rounded-lg ${eta === "Stalled" ? "bg-red-50" : "bg-green-50"}`}>
                <div className="flex items-center text-xs text-gray-600 mb-1">
                  <Settings className="h-3 w-3 mr-1" />
                  <span>ETA</span></div>
                <div className={`text-sm font-medium ${eta === "Stalled" ? "text-red-700" : "text-gray-900"}`}>
                  {eta || "Unknown"}
                </div>
              </div>
            </div>

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