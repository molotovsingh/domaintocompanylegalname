import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react";

interface SessionResultsProps {
  batchId: string;
}

interface SessionResults {
  batchId: string;
  fileName: string;
  totalDomains: number;
  successfulDomains: number;
  failedDomains: number;
  successRate: number;
  averageConfidence: number;
  extractionMethods: Record<string, number>;
  processingTime: number;
  completedAt: string;
  qualityMetrics: {
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
    domainParseCount: number;
    htmlExtractionCount: number;
  };
  failureReasons: Record<string, number>;
}

export default function SessionResults({ batchId }: SessionResultsProps) {
  const { data: sessionResults, isLoading } = useQuery<SessionResults>({
    queryKey: ['/api/session-results', batchId],
    enabled: !!batchId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Session Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sessionResults) {
    return null;
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Session Results: {sessionResults.fileName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Performance */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {sessionResults.successfulDomains}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <CheckCircle className="h-4 w-4" />
              Successful
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {sessionResults.failedDomains}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <XCircle className="h-4 w-4" />
              Failed
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {sessionResults.successRate}%
            </div>
            <div className="text-sm text-gray-600">Success Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {sessionResults.averageConfidence}%
            </div>
            <div className="text-sm text-gray-600">Avg Confidence</div>
          </div>
        </div>

        <Separator />

        {/* Quality Metrics */}
        <div>
          <h4 className="font-semibold mb-3">Quality Breakdown</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">High Confidence (90%+)</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(sessionResults.qualityMetrics.highConfidenceCount / sessionResults.totalDomains) * 100} 
                  className="w-20 h-2" 
                />
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {sessionResults.qualityMetrics.highConfidenceCount}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Medium Confidence (70-89%)</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(sessionResults.qualityMetrics.mediumConfidenceCount / sessionResults.totalDomains) * 100} 
                  className="w-20 h-2" 
                />
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {sessionResults.qualityMetrics.mediumConfidenceCount}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Low Confidence (&lt;70%)</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(sessionResults.qualityMetrics.lowConfidenceCount / sessionResults.totalDomains) * 100} 
                  className="w-20 h-2" 
                />
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  {sessionResults.qualityMetrics.lowConfidenceCount}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Extraction Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Extraction Methods</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Domain Mapping</span>
                <Badge variant="outline" className="bg-blue-50">
                  {sessionResults.qualityMetrics.domainParseCount}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">HTML Extraction</span>
                <Badge variant="outline" className="bg-gray-50">
                  {sessionResults.qualityMetrics.htmlExtractionCount}
                </Badge>
              </div>
            </div>
          </div>

          {/* Failure Analysis */}
          {sessionResults.failedDomains > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Failure Reasons</h4>
              <div className="space-y-2">
                {Object.entries(sessionResults.failureReasons).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between">
                    <span className="text-sm truncate">{reason}</span>
                    <Badge variant="destructive" className="bg-red-100 text-red-800">
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Processing Info */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Processing Time: {formatDuration(sessionResults.processingTime)}
          </div>
          <div>
            Completed: {new Date(sessionResults.completedAt).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}