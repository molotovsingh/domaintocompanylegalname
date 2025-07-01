import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Building, TrendingUp, Users, CheckCircle, XCircle, Clock, Star, AlertTriangle } from "lucide-react";

interface Level2Analytics {
  totalLevel2Attempts: number;
  successfulMatches: number;
  failedMatches: number;
  averageWeightedScore: number;
  totalCandidatesFound: number;
  averageCandidatesPerDomain: number;
  topJurisdictions: Array<{ jurisdiction: string; count: number }>;
  entityStatusBreakdown: Array<{ status: string; count: number }>;
  confidenceImprovements: number;
  manualReviewQueue: number;
}

export default function Level2AnalyticsDashboard() {
  const { data: analytics, isLoading } = useQuery<Level2Analytics>({
    queryKey: ['/api/analytics/level2'],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card className="mb-8">
        <CardContent className="p-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Level 2 Analytics Available</h3>
          <p className="text-sm text-gray-600">
            GLEIF processing data will appear here once domains are processed with Level 2 enhancement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const successRate = analytics.totalLevel2Attempts > 0 
    ? (analytics.successfulMatches / analytics.totalLevel2Attempts) * 100 
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'inactive':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Shield className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Level 2 GLEIF Analytics</h2>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Real-time Insights
        </Badge>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Attempts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Level 2 Attempts</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalLevel2Attempts}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round(successRate)}%</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <Progress value={successRate} className="h-2" />
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Weighted Score</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round(analytics.averageWeightedScore)}%</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Review Queue */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Manual Review</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.manualReviewQueue}</p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Results Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Match Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm text-gray-600">Successful Matches</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">{analytics.successfulMatches}</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {Math.round((analytics.successfulMatches / analytics.totalLevel2Attempts) * 100)}%
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <XCircle className="h-4 w-4 text-red-600 mr-2" />
                  <span className="text-sm text-gray-600">Failed Matches</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">{analytics.failedMatches}</span>
                  <Badge variant="destructive">
                    {Math.round((analytics.failedMatches / analytics.totalLevel2Attempts) * 100)}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Candidates</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">{analytics.totalCandidatesFound}</span>
                  <Badge variant="outline">
                    Avg: {analytics.averageCandidatesPerDomain.toFixed(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Jurisdictions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Top Jurisdictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topJurisdictions.slice(0, 5).map((jurisdiction, index) => (
                <div key={jurisdiction.jurisdiction} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 
                      index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-sm text-gray-600">{jurisdiction.jurisdiction}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">{jurisdiction.count}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          index === 0 ? 'bg-blue-500' : 
                          index === 1 ? 'bg-green-500' : 
                          index === 2 ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}
                        style={{ 
                          width: `${(jurisdiction.count / analytics.topJurisdictions[0]?.count * 100) || 0}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Entity Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Entity Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.entityStatusBreakdown.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(status.status)}
                    <span className="text-sm text-gray-600 ml-2 capitalize">{status.status}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">{status.count}</span>
                    <Badge variant="outline">
                      {Math.round((status.count / analytics.totalCandidatesFound) * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Quality Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">Confidence Improvements</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {analytics.confidenceImprovements} domains gained higher confidence through GLEIF verification
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">LEI Code Coverage</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {analytics.successfulMatches} domains now have verified LEI codes for official identification
                </p>
              </div>

              {analytics.manualReviewQueue > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                    <span className="text-sm font-medium text-orange-800">Review Required</span>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">
                    {analytics.manualReviewQueue} domains require manual review for candidate selection
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}