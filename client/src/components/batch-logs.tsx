import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Download, FileText, BarChart } from "lucide-react";

interface BatchLog {
  batchId: string;
  fileName: string;
  totalEvents: number;
  startTime: string;
  lastEvent: string;
  lastEventType: string;
  size: number;
}

interface LogEntry {
  timestamp: string;
  batchId: string;
  event: string;
  context: Record<string, any>;
}

export function BatchLogs() {
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  const { data: batchLogs, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['/api/logs/batches'],
    refetchInterval: 30000
  });

  const { data: selectedLogData, isLoading: isLoadingLog } = useQuery({
    queryKey: ['/api/logs/batch', selectedBatch],
    enabled: !!selectedBatch
  });

  const { data: analysisData, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['/api/logs/analysis', selectedBatch],
    enabled: !!selectedBatch
  });

  const toggleEntry = (index: number) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEntries(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'batch_start': return 'bg-blue-100 text-blue-800';
      case 'batch_complete': return 'bg-green-100 text-green-800';
      case 'domain_success': return 'bg-green-100 text-green-800';
      case 'domain_failure': return 'bg-red-100 text-red-800';
      case 'domain_timeout': return 'bg-orange-100 text-orange-800';
      case 'batch_progress': return 'bg-gray-100 text-gray-800';
      case 'performance_anomaly': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoadingBatches) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Logs</CardTitle>
          <CardDescription>Loading batch logs...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Batch Processing Logs
          </CardTitle>
          <CardDescription>
            Structured logs for AI post-mortem analysis and performance optimization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchLogs?.batches?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No batch logs available</p>
              <p className="text-sm">Process a batch to generate structured logs for AI analysis</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {batchLogs?.batches?.map((batch: BatchLog) => (
                <div
                  key={batch.batchId}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedBatch === batch.batchId 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedBatch(batch.batchId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{batch.fileName}</div>
                      <div className="text-sm text-muted-foreground">
                        {batch.totalEvents} events • {formatFileSize(batch.size)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Started: {new Date(batch.startTime).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getEventBadgeColor(batch.lastEventType)}>
                        {batch.lastEventType}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(batch.lastEvent).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Batch Details */}
      {selectedBatch && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI Analysis Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                AI Analysis Summary
              </CardTitle>
              <CardDescription>
                AI-ready performance analysis for Perplexity integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAnalysis ? (
                <div className="text-center py-4">Loading analysis...</div>
              ) : analysisData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium">Duration</div>
                      <div className="text-2xl font-bold">
                        {analysisData.overview?.duration ? 
                          `${Math.round(analysisData.overview.duration / 60000)}m` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium">Success Rate</div>
                      <div className="text-2xl font-bold">
                        {analysisData.performance?.successCount && analysisData.performance?.totalProcessed ?
                          `${Math.round((analysisData.performance.successCount / analysisData.performance.totalProcessed) * 100)}%` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  {analysisData.recommendations?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-2">AI Recommendations</div>
                      <div className="space-y-1">
                        {analysisData.recommendations.map((rec: string, index: number) => (
                          <div key={index} className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded">
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const data = JSON.stringify(analysisData, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `analysis-${selectedBatch}.json`;
                      a.click();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Analysis
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Analysis not available</p>
                  <p className="text-sm">Complete the batch to generate AI analysis</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raw Log Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Raw Log Entries</CardTitle>
              <CardDescription>
                Structured JSON logs for detailed analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLog ? (
                <div className="text-center py-4">Loading log entries...</div>
              ) : selectedLogData?.entries ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedLogData.entries.slice(0, 50).map((entry: LogEntry, index: number) => (
                    <Collapsible key={index}>
                      <CollapsibleTrigger
                        className="w-full text-left p-2 border rounded hover:bg-gray-50 flex items-center justify-between"
                        onClick={() => toggleEntry(index)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedEntries.has(index) ? 
                            <ChevronDown className="h-4 w-4" /> : 
                            <ChevronRight className="h-4 w-4" />}
                          <Badge className={getEventBadgeColor(entry.event)}>
                            {entry.event}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-3 bg-gray-50 border border-t-0 rounded-b">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(entry.context, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                  {selectedLogData.entries.length > 50 && (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      Showing first 50 of {selectedLogData.entries.length} entries
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No log entries found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}