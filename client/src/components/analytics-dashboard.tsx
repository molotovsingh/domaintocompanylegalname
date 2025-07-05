import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Clock, Database, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface AnalyticsData {
  batchId: string;
  fileName: string;
  completedAt: string;
  totalDomains: number;
  successRate: number;
  medianConfidence: number;
  averageConfidence: number;
  domainMappingPercentage: number;
  avgProcessingTimePerDomain: number;
  highConfidencePercentage: number;
  totalProcessingTimeMs: number;
  totalProcessingTimeFormatted: string;
}

export default function AnalyticsDashboard() {
  const { data: analyticsData, isLoading, refetch } = useQuery<AnalyticsData[]>({
    queryKey: ['/api/analytics'],
    refetchInterval: 60000, // Analytics don't need frequent updates
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  if (isLoading && !analyticsData) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData || analyticsData.length === 0) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
        <p className="text-gray-600">Process some domains to see performance analytics.</p>
      </div>
    );
  }

  // Get latest batch data
  const latestBatch = analyticsData[0];
  const previousBatch = analyticsData[1];
  
  // Calculate cumulative averages (excluding latest batch for comparison)
  const historicalData = analyticsData.slice(1); // All batches except the latest
  const historicalAvgConfidence = historicalData.length > 0 
    ? Math.round(historicalData.reduce((sum, batch) => sum + batch.medianConfidence, 0) / historicalData.length)
    : 0;
  const historicalAvgSuccess = historicalData.length > 0
    ? Math.round(historicalData.reduce((sum, batch) => sum + batch.successRate, 0) / historicalData.length)
    : 0;
  const historicalAvgDomainMapping = historicalData.length > 0
    ? Math.round(historicalData.reduce((sum, batch) => sum + batch.domainMappingPercentage, 0) / historicalData.length)
    : 0;
  const historicalAvgProcessingTime = historicalData.length > 0
    ? Math.round(historicalData.reduce((sum, batch) => sum + batch.avgProcessingTimePerDomain, 0) / historicalData.length)
    : 0;
  
  // Calculate performance vs historical average
  const confidencePerformance = historicalAvgConfidence > 0 ? latestBatch.medianConfidence - historicalAvgConfidence : 0;
  const successPerformance = historicalAvgSuccess > 0 ? latestBatch.successRate - historicalAvgSuccess : 0;
  const domainMappingPerformance = historicalAvgDomainMapping > 0 ? latestBatch.domainMappingPercentage - historicalAvgDomainMapping : 0;
  const processingTimePerformance = historicalAvgProcessingTime > 0 ? historicalAvgProcessingTime - latestBatch.avgProcessingTimePerDomain : 0; // Inverted: lower is better
  
  // Overall averages for summary
  const avgConfidence = Math.round(analyticsData.reduce((sum, batch) => sum + batch.medianConfidence, 0) / analyticsData.length);
  const avgSuccessRate = Math.round(analyticsData.reduce((sum, batch) => sum + batch.successRate, 0) / analyticsData.length);
  const totalDomains = analyticsData.reduce((sum, batch) => sum + batch.totalDomains, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="text-sm text-gray-600">{analyticsData.length} batches • {totalDomains.toLocaleString()} total domains</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Last updated: {format(new Date(), 'HH:mm:ss')}
          </Badge>
          <button 
            onClick={() => refetch()} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cumulative Performance Comparison */}
      {historicalData.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Latest Run vs Historical Average</CardTitle>
            <p className="text-sm text-gray-600">Performance comparison against {historicalData.length} previous batches</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{latestBatch.medianConfidence}%</p>
                <p className="text-xs text-gray-500">Latest Confidence</p>
                <div className={`text-sm font-medium ${confidencePerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {confidencePerformance >= 0 ? '+' : ''}{confidencePerformance} vs avg ({historicalAvgConfidence}%)
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{latestBatch.successRate}%</p>
                <p className="text-xs text-gray-500">Latest Success</p>
                <div className={`text-sm font-medium ${successPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {successPerformance >= 0 ? '+' : ''}{successPerformance} vs avg ({historicalAvgSuccess}%)
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{latestBatch.domainMappingPercentage}%</p>
                <p className="text-xs text-gray-500">Domain Mapping</p>
                <div className={`text-sm font-medium ${domainMappingPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {domainMappingPerformance >= 0 ? '+' : ''}{domainMappingPerformance} vs avg ({historicalAvgDomainMapping}%)
                </div>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {latestBatch.avgProcessingTimePerDomain > 1000 
                    ? `${Math.round(latestBatch.avgProcessingTimePerDomain / 1000)}s`
                    : `${latestBatch.avgProcessingTimePerDomain}ms`
                  }
                </p>
                <p className="text-xs text-gray-500">Processing Time</p>
                <div className={`text-sm font-medium ${processingTimePerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {processingTimePerformance >= 0 ? 'Faster' : 'Slower'} by {Math.abs(processingTimePerformance)}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Confidence</p>
                <p className="text-xl font-bold text-blue-600">{latestBatch.medianConfidence}%</p>
                {historicalData.length > 0 && (
                  <p className={`text-xs ${confidencePerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {confidencePerformance >= 0 ? '+' : ''}{confidencePerformance} vs avg
                  </p>
                )}
              </div>
              <Target className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Success Rate</p>
                <p className="text-xl font-bold text-green-600">{latestBatch.successRate}%</p>
                {historicalData.length > 0 && (
                  <p className={`text-xs ${successPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {successPerformance >= 0 ? '+' : ''}{successPerformance} vs avg
                  </p>
                )}
              </div>
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Domain Mapping</p>
                <p className="text-xl font-bold text-purple-600">{latestBatch.domainMappingPercentage}%</p>
                {historicalData.length > 0 && (
                  <p className={`text-xs ${domainMappingPerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {domainMappingPerformance >= 0 ? '+' : ''}{domainMappingPerformance} vs avg
                  </p>
                )}
              </div>
              <Database className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Per Domain</p>
                <p className="text-xl font-bold text-orange-600">
                  {latestBatch.avgProcessingTimePerDomain > 1000 
                    ? `${Math.round(latestBatch.avgProcessingTimePerDomain / 1000)}s`
                    : `${latestBatch.avgProcessingTimePerDomain}ms`
                  }
                </p>
                {historicalData.length > 0 && (
                  <p className={`text-xs ${processingTimePerformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {processingTimePerformance >= 0 ? 'Faster' : 'Slower'} by {Math.abs(processingTimePerformance)}ms
                  </p>
                )}
              </div>
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total Time</p>
                <p className="text-xl font-bold text-indigo-600">{latestBatch.totalProcessingTimeFormatted}</p>
                <p className="text-xs text-gray-500">{latestBatch.totalDomains} domains</p>
              </div>
              <Clock className="h-6 w-6 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analyticsData.slice(0, 8).map((batch, index) => (
              <div key={batch.batchId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div>
                    <p className="font-medium text-sm">{batch.fileName}</p>
                    <p className="text-xs text-gray-600">
                      {batch.completedAt ? (() => {
                        const date = new Date(batch.completedAt);
                        return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM dd, HH:mm');
                      })() : 'In progress'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-medium">{batch.totalDomains}</p>
                    <p className="text-xs text-gray-500">domains</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-green-600">{batch.successRate}%</p>
                    <p className="text-xs text-gray-500">success</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-blue-600">{batch.medianConfidence}%</p>
                    <p className="text-xs text-gray-500">confidence</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-purple-600">{batch.domainMappingPercentage}%</p>
                    <p className="text-xs text-gray-500">mapped</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-orange-600">
                      {batch.avgProcessingTimePerDomain > 1000 
                        ? `${Math.round(batch.avgProcessingTimePerDomain / 1000)}s`
                        : `${batch.avgProcessingTimePerDomain}ms`
                      }
                    </p>
                    <p className="text-xs text-gray-500">time</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{avgConfidence}%</p>
            <p className="text-sm text-gray-600">Average Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{avgSuccessRate}%</p>
            <p className="text-sm text-gray-600">Average Success Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{latestBatch.highConfidencePercentage}%</p>
            <p className="text-sm text-gray-600">High Confidence (Latest)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}