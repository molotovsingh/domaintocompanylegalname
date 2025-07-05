import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Download, FileCode, Globe, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Search, Shield, Users, Eye, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import GLEIFCandidatesModal from "./gleif-candidates-modal";
import type { Domain } from "@shared/schema";

interface ResultsResponse {
  domains: Domain[];
  batch?: {
    id: string;
    fileName: string;
    domainCount: number;
    processedCount: number;
    successCount: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ResultsTableProps {
  currentBatchId: string | null;
}

export default function ResultsTable({ currentBatchId }: ResultsTableProps) {
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedDomainForGleif, setSelectedDomainForGleif] = React.useState<{ id: number; domain: string } | null>(null);
  const { toast } = useToast();

  const params = React.useMemo(() => {
    const urlParams = new URLSearchParams({
      page: page.toString(),
      limit: "50",
      ...(statusFilter !== "all" && { status: statusFilter }),
      ...(searchQuery && { search: searchQuery })
    });
    return urlParams.toString();
  }, [page, statusFilter, searchQuery]);

  const { data: resultsData, isLoading, refetch: refetchResults } = useQuery<ResultsResponse>({
    queryKey: [`/api/results/${currentBatchId}?${params}`],
    enabled: !!currentBatchId,
  });

  const domains = resultsData?.domains || [];
  const batch = resultsData?.batch;
  const pagination = resultsData?.pagination;

  // Check if any domains are still processing
  const hasProcessingDomains = domains.some((d: Domain) => 
    d.status === 'processing' || d.status === 'pending'
  );

  // Auto-refresh when domains are processing
  React.useEffect(() => {
    if (hasProcessingDomains) {
      const interval = setInterval(() => {
        refetchResults();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [hasProcessingDomains, refetchResults]);

  const handleRefresh = () => {
    refetchResults();
    toast({
      title: "Results refreshed",
      description: "Latest extraction results loaded",
    });
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!batch?.id) return;

    try {
      const response = await apiRequest('GET', `/api/export/${batch?.id}?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `domains_${batch?.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `${format.toUpperCase()} file downloaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEnhancedExport = async (format: 'csv' | 'json') => {
    if (!batch?.id) return;

    try {
      const response = await apiRequest('GET', `/api/export-enhanced/${batch?.id}?format=${format}&fields=comprehensive&includeGleifCandidates=true&includeRelationships=true`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enhanced_export_${batch?.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Enhanced Export successful",
        description: `${format.toUpperCase()} enhanced file downloaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Enhanced Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="mr-1 h-3 w-3" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="mr-1 h-3 w-3" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  const getSourceLabel = (method: string) => {
    const sourceMap = {
      'domain_parse': 'Domain',
      'footer_copyright': 'Footer',
      'html_about': 'About Page',
      'html_legal': 'Legal Page',
      'html_subpage': 'Sub-page',
      'meta_description': 'Meta Tag',
      'html_title': 'Title'
    };

    return sourceMap[method as keyof typeof sourceMap] || method;
  };

  if (!currentBatchId) {
    return (
      <Card className="mt-8 bg-surface shadow-material border border-gray-200">
        <CardContent className="p-12 text-center">
          <Table className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No batch selected</h3>
          <p className="text-sm text-gray-600">Upload a domain file to start processing and view results</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 bg-surface shadow-material border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <Table className="text-primary-custom mr-2 h-5 w-5" />
              Extraction Results
              {hasProcessingDomains && (
                <span className="ml-2 text-sm font-normal text-blue-600 flex items-center">
                  <Clock className="h-4 w-4 mr-1 animate-pulse" />
                  Processing...
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {hasProcessingDomains 
                ? `Processing ${domains.filter(d => d.status === 'processing' || d.status === 'pending').length} domains...`
                : 'Latest processed domains with confidence scores'
              }
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {!hasProcessingDomains && domains.length > 0 && (
              <>
                <Button
                  onClick={() => handleExport('csv')}
                  className="bg-success hover:bg-green-700 text-white"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  onClick={() => handleExport('json')}
                  variant="outline"
                  className="text-secondary-custom border-gray-300 hover:bg-gray-50"
                >
                  <FileCode className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button
                  onClick={() => handleEnhancedExport('csv')}
                  variant="outline"
                  className="text-secondary-custom border-gray-300 hover:bg-gray-50"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Enhanced Export
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="success">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search domains or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-custom mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading results...</p>
          </div>
        ) : domains.length === 0 ? (
          <div className="p-8 text-center">
            <Globe className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-sm text-gray-600">
              {searchQuery ? 'Try adjusting your search criteria' : 'Processing has not started yet'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company Name
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Business Category
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GLEIF Status
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LEI Code
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recommendation
                </th>
                <th className="text-left py-2 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {domains.map((domain: Domain) => (
                <tr key={domain.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <Globe className="text-gray-400 mr-2 h-3 w-3" />
                      <span className="font-medium text-gray-900">{domain.domain}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {domain.status === 'processing' ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-custom mr-2"></div>
                        <span className="text-gray-500">Processing...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-gray-900">
                          {domain.finalLegalName || domain.primaryGleifName || domain.companyName || '-'}
                        </span>
                        {domain.finalLegalName && domain.companyName && domain.finalLegalName !== domain.companyName && (
                          <span className="text-xs text-gray-500">
                            Original: {domain.companyName}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(domain.status)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-900">
                      {domain.extractionMethod ? getSourceLabel(domain.extractionMethod) : '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {domain.confidenceScore ? (
                      <div className="flex items-center">
                        <div className="w-12 bg-gray-200 rounded-full h-1.5 mr-2">
                          <div
                            className="bg-success h-1.5 rounded-full"
                            style={{ width: `${domain.confidenceScore}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-900">{Math.round(domain.confidenceScore)}%</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {domain.level2Status ? (
                      <div className="flex items-center">
                        {domain.level2Status === 'success' ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                            <Shield className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        ) : domain.level2Status === 'processing' ? (
                          <Badge variant="secondary">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                            Processing
                          </Badge>
                        ) : domain.level2Status === 'failed' ? (
                          <Badge variant="destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            No Match
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            {domain.level2Status}
                          </Badge>
                        )}
                      </div>
                    ) : domain.level2Attempted ? (
                      <Badge variant="outline" className="text-gray-500">
                        Not Applicable
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-400">
                        Level 1 Only
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {domain.primaryLeiCode ? (
                      <div className="flex items-center">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {domain.primaryLeiCode}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="ml-2 h-6 w-6 p-0"
                          onClick={() => setSelectedDomainForGleif({ id: domain.id, domain: domain.domain })}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {domain.guessedCountry ? (
                      <span className="text-gray-700">{domain.guessedCountry}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {domain.recommendation ? (
                      <span className="text-gray-700">{domain.recommendation}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {domain.processingTimeMs ? (
                      domain.processingTimeMs > 1000 
                        ? `${Math.round(domain.processingTimeMs / 1000)}s`
                        : `${domain.processingTimeMs}ms`
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-gray-600">
              <span>Showing</span>
              <span className="font-medium mx-1">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>
              <span>to</span>
              <span className="font-medium mx-1">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              <span>of</span>
              <span className="font-medium mx-1">{pagination.total.toLocaleString()}</span>
              <span>results</span>
            </div>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-1">
                <span className="px-3 py-2 text-sm bg-primary-custom text-white rounded">
                  {page}
                </span>
                <span className="px-3 py-2 text-sm text-gray-500">of</span>
                <span className="px-3 py-2 text-sm text-gray-500">
                  {Math.ceil(pagination.total / pagination.limit)}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(pagination.total / pagination.limit)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* GLEIF Candidates Modal */}
      <GLEIFCandidatesModal
        domainId={selectedDomainForGleif?.id || null}
        domain={selectedDomainForGleif?.domain || ""}
        isOpen={!!selectedDomainForGleif}
        onClose={() => setSelectedDomainForGleif(null)}
      />
    </Card>
  );
}