import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { TrendingUp, Target, Clock, Database } from "lucide-react";
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
}

export default function AnalyticsDashboard() {
  const { data: analyticsData, isLoading } = useQuery<AnalyticsData[]>({
    queryKey: ['/api/analytics'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData || analyticsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No completed batches available for analysis. Process some domains to see analytics.</p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for charts (reverse chronological for timeline view)
  const chartData = analyticsData
    .slice()
    .reverse()
    .map((item, index) => ({
      ...item,
      index: index + 1,
      date: format(new Date(item.completedAt), 'MMM dd'),
      shortFileName: item.fileName.length > 15 ? `${item.fileName.substring(0, 12)}...` : item.fileName,
    }));

  // Calculate trends
  const latestBatch = analyticsData[0];
  const previousBatch = analyticsData[1];
  const confidenceTrend = previousBatch 
    ? latestBatch.medianConfidence - previousBatch.medianConfidence 
    : 0;
  const successTrend = previousBatch 
    ? latestBatch.successRate - previousBatch.successRate 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <div className="text-sm text-gray-600">
          {analyticsData.length} batches analyzed
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Latest Confidence</p>
                <p className="text-2xl font-bold text-blue-600">{latestBatch.medianConfidence}%</p>
                {confidenceTrend !== 0 && (
                  <p className={`text-xs ${confidenceTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {confidenceTrend > 0 ? '+' : ''}{confidenceTrend}% from previous
                  </p>
                )}
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Latest Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{latestBatch.successRate}%</p>
                {successTrend !== 0 && (
                  <p className={`text-xs ${successTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {successTrend > 0 ? '+' : ''}{successTrend}% from previous
                  </p>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Domain Mapping Usage</p>
                <p className="text-2xl font-bold text-purple-600">{latestBatch.domainMappingPercentage}%</p>
                <p className="text-xs text-gray-500">Primary extraction method</p>
              </div>
              <Database className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Time/Domain</p>
                <p className="text-2xl font-bold text-orange-600">{Math.round(latestBatch.avgProcessingTimePerDomain / 1000)}s</p>
                <p className="text-xs text-gray-500">Processing efficiency</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="confidence" className="space-y-4">
        <TabsList>
          <TabsTrigger value="confidence">Confidence Trends</TabsTrigger>
          <TabsTrigger value="success">Success Metrics</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="methods">Extraction Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="confidence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Confidence Score Evolution</CardTitle>
              <p className="text-sm text-gray-600">Tracking median and average confidence scores over time</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.shortFileName} (${label})` : label;
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="medianConfidence" stroke="#2563eb" strokeWidth={3} name="Median Confidence" />
                  <Line type="monotone" dataKey="averageConfidence" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" name="Average Confidence" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="success" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate & Quality Trends</CardTitle>
              <p className="text-sm text-gray-600">Success rates and high-confidence extraction percentages</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.shortFileName} (${label})` : label;
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="successRate" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Success Rate %" />
                  <Area type="monotone" dataKey="highConfidencePercentage" stackId="2" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="High Confidence %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Performance</CardTitle>
              <p className="text-sm text-gray-600">Average processing time per domain across batches</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.shortFileName} (${label})` : label;
                    }}
                    formatter={(value: number) => [`${Math.round(value / 1000)}s`, 'Processing Time']}
                  />
                  <Legend />
                  <Bar dataKey="avgProcessingTimePerDomain" fill="#f59e0b" name="Avg Time per Domain (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extraction Method Usage</CardTitle>
              <p className="text-sm text-gray-600">Percentage of domains processed using domain mapping vs HTML extraction</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.shortFileName} (${label})` : label;
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="domainMappingPercentage" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.8} name="Domain Mapping %" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}