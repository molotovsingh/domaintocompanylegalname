import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Download, FileCode, Globe, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Domain } from "@shared/schema";

interface ResultsTableProps {
  currentBatchId: string | null;
}

export default function ResultsTable({ currentBatchId }: ResultsTableProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: resultsData, isLoading } = useQuery({
    queryKey: ["/api/results", currentBatchId, page, statusFilter, searchQuery],
    queryFn: () => {
      if (!currentBatchId) return null;
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(searchQuery && { search: searchQuery })
      });
      
      return fetch(`/api/results/${currentBatchId}?${params}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch results');
          return res.json();
        });
    },
    enabled: !!currentBatchId && currentBatchId !== null,
    refetchInterval: 5000,
  });

  const domains = resultsData?.domains || [];
  const batch = resultsData?.batch;
  const pagination = resultsData?.pagination;

  const handleExport = async (format: 'csv' | 'json') => {
    if (!currentBatchId) return;

    try {
      const response = await apiRequest('GET', `/api/export/${currentBatchId}?format=${format}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `domains_${currentBatchId}.${format}`;
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
            </h2>
            <p className="text-sm text-gray-600 mt-1">Latest processed domains with confidence scores</p>
          </div>
          <div className="flex space-x-2">
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
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company Name
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {domains.map((domain: Domain) => (
                <tr key={domain.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      <Globe className="text-gray-400 mr-2 h-4 w-4" />
                      <span className="text-sm font-medium text-gray-900">{domain.domain}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {domain.status === 'processing' ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-custom mr-2"></div>
                        <span className="text-sm text-gray-500">Processing...</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-900">{domain.companyName || '-'}</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">
                      {domain.extractionMethod ? getSourceLabel(domain.extractionMethod) : '-'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {domain.confidenceScore ? (
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-success h-2 rounded-full"
                            style={{ width: `${domain.confidenceScore}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">{Math.round(domain.confidenceScore)}%</span>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-4 px-6">
                    {getStatusBadge(domain.status)}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {domain.processingTimeMs ? (
                      domain.processingTimeMs > 1000 
                        ? `${Math.round(domain.processingTimeMs / 1000)}s`
                        : `${domain.processingTimeMs}ms`
                    ) : '-'}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-500">
                    {domain.processedAt ? new Date(domain.processedAt).toLocaleString() : '-'}
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
    </Card>
  );
}
