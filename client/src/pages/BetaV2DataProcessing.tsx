import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, PlayCircle, CheckCircle, Clock, AlertCircle, Database, Brain, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Types
interface AvailableDump {
  id: number;
  domain: string;
  sourceType: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump';
  createdAt: string;
  status: string;
  hasData: boolean;
}

interface ProcessingResult {
  id: number;
  domain: string;
  sourceType: string;
  sourceId: number;
  status: 'processing' | 'completed' | 'failed';
  stage1Result?: any;
  stage2Result?: any;
  stage3Result?: any;
  finalResult?: any;
  errorMessage?: string;
  processingTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

interface BetaServerStatus {
  status: 'ready' | 'starting' | 'stopped';
}

export default function BetaV2DataProcessingPage() {
  const [selectedDump, setSelectedDump] = useState<AvailableDump | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dumps');

  // Check beta server status
  const { data: serverStatus } = useQuery<BetaServerStatus>({
    queryKey: ['/api/beta/status'],
    refetchInterval: (data) => data?.status === 'ready' ? false : 2000
  });

  // Fetch available dumps
  const { data: dumpsData, isLoading: dumpsLoading, refetch: refetchDumps } = useQuery<{ data: AvailableDump[] }>({
    queryKey: ['/api/beta/processing/dumps'],
    enabled: serverStatus?.status === 'ready'
  });

  // Fetch processing results
  const { data: resultsData, isLoading: resultsLoading, refetch: refetchResults } = useQuery<{ data: ProcessingResult[] }>({
    queryKey: ['/api/beta/processing/results'],
    enabled: serverStatus?.status === 'ready',
    refetchInterval: 5000
  });

  const dumps = dumpsData?.data || [];
  const results = resultsData?.data || [];

  // Process dump mutation
  const processDumpMutation = useMutation({
    mutationFn: async (dump: AvailableDump) => {
      const response = await apiRequest('POST', '/api/beta/processing/process', {
        sourceType: dump.sourceType,
        sourceId: dump.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Processing Started",
          description: `Processing ${selectedDump?.domain} through the pipeline`,
        });
        setActiveTab('results');
        refetchResults();
      } else {
        toast({
          title: "Processing Failed",
          description: data.error || "Failed to start processing",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const getSourceTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'crawlee_dump': 'bg-blue-500',
      'scrapy_crawl': 'bg-green-500',
      'playwright_dump': 'bg-purple-500',
      'axios_cheerio_dump': 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatProcessingTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (serverStatus?.status !== 'ready') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Beta Server Starting...</CardTitle>
            <CardDescription>
              The beta server is initializing. This usually takes a few seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Please wait...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href="/beta-testing-v2">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Beta Testing V2
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Data Processing Stage 2
          </CardTitle>
          <CardDescription>
            Process collected dumps through the three-stage pipeline: Collection → Entity Extraction → GLEIF Verification
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dumps">
            <Database className="mr-2 h-4 w-4" />
            Available Dumps
          </TabsTrigger>
          <TabsTrigger value="results">
            <Search className="mr-2 h-4 w-4" />
            Processing Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dumps" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Available Dumps</CardTitle>
                <Button 
                  onClick={() => refetchDumps()} 
                  variant="outline" 
                  size="sm"
                  disabled={dumpsLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${dumpsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                Select a dump to process through the pipeline
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dumpsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : dumps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No dumps available. Collect data using one of the collection methods first.
                </div>
              ) : (
                <Table>
                  <TableCaption>
                    {dumps.length} dump{dumps.length !== 1 ? 's' : ''} available for processing
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dumps.map((dump) => (
                      <TableRow key={`${dump.sourceType}-${dump.id}`}>
                        <TableCell className="font-medium">{dump.domain}</TableCell>
                        <TableCell>
                          <Badge className={getSourceTypeColor(dump.sourceType)}>
                            {dump.sourceType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(dump.status)}
                            <span className="capitalize">{dump.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatTimestamp(dump.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            disabled={!dump.hasData || processDumpMutation.isPending}
                            onClick={() => {
                              setSelectedDump(dump);
                              processDumpMutation.mutate(dump);
                            }}
                          >
                            <PlayCircle className="mr-2 h-4 w-4" />
                            Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Processing Results</CardTitle>
                <Button 
                  onClick={() => refetchResults()} 
                  variant="outline" 
                  size="sm"
                  disabled={resultsLoading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${resultsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <CardDescription>
                View the results of processed dumps
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resultsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No processing results yet. Process a dump to see results here.
                </div>
              ) : (
                <Table>
                  <TableCaption>
                    {results.length} processing result{results.length !== 1 ? 's' : ''}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>LEI</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.domain}</TableCell>
                        <TableCell>
                          <Badge className={getSourceTypeColor(result.sourceType)}>
                            {result.sourceType.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(result.status)}
                            <span className="capitalize">{result.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.stage2Result?.entityName || 
                           result.finalResult?.primaryLegalName || 
                           '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {result.finalResult?.primaryLei || '-'}
                        </TableCell>
                        <TableCell>
                          {result.finalResult?.confidenceScore 
                            ? `${result.finalResult.confidenceScore.toFixed(1)}%`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {result.processingTimeMs 
                            ? formatProcessingTime(result.processingTimeMs)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {result.completedAt 
                            ? formatTimestamp(result.completedAt)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}