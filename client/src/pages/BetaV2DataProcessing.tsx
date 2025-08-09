import { useState, useEffect, Fragment } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, PlayCircle, CheckCircle, Clock, AlertCircle, Database, Brain, Search, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
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
  stage4Result?: {
    primaryLegalName?: string;
    primaryLei?: string;
    confidenceScore?: number;
    totalCandidates?: number;
  };
  finalResult?: any;
  errorMessage?: string;
  processingTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

interface BetaServerStatus {
  status: 'ready' | 'starting' | 'stopped';
}

interface GLEIFCandidate {
  lei_code: string;
  legal_name: string;
  entity_status: string;
  legal_form: string;
  headquarters_city: string;
  headquarters_country: string;
  weighted_total_score: number;
  selection_reason: string;
}

interface EntityClaim {
  claimType: 'extracted' | 'gleif_verified' | 'gleif_relationship' | 'generated' | 'suspect';
  entityName: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  leiCode?: string;
  evidence?: {
    type: string;
    jurisdiction?: string;
    [key: string]: any;
  };
  evidence?: {
    leiCode?: string;
    jurisdiction?: string;
    status?: string;
    city?: string;
    country?: string;
    relationshipType?: string;
  };
  reasoning?: string;
}

interface ClaimsResult {
  domain: string;
  dumpId: number;
  collectionType: string;
  claims: EntityClaim[];
  processedAt: string;
}

export default function BetaV2DataProcessingPage() {
  const [selectedDump, setSelectedDump] = useState<AvailableDump | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dumps');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [candidatesData, setCandidatesData] = useState<Record<number, GLEIFCandidate[]>>({});
  const [selectedDumpForClaims, setSelectedDumpForClaims] = useState<AvailableDump | null>(null);
  const [claimsResults, setClaimsResults] = useState<ClaimsResult[]>([]);

  // Check beta server status
  const { data: serverStatus } = useQuery<BetaServerStatus>({
    queryKey: ['/api/beta/status'],
    refetchInterval: 2000
  });

  // Fetch available dumps
  const { data: dumpsData, isLoading: dumpsLoading, refetch: refetchDumps } = useQuery<{ data: AvailableDump[] }>({
    queryKey: ['/api/beta/processing/dumps'],
    enabled: serverStatus?.status === 'ready'
  });
  
  // Separate query for GLEIF claims - only dumps with data
  const { data: claimsDumpsData } = useQuery<{ data: AvailableDump[] }>({
    queryKey: ['/api/beta/gleif-claims/available-dumps'],
    enabled: serverStatus?.status === 'ready' && activeTab === 'claims'
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
      case 'stage1':
      case 'stage2':
      case 'stage3':
      case 'stage4':
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

  const toggleCandidates = async (resultId: number) => {
    const newExpanded = new Set(expandedRows);

    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);

      // Fetch candidates if not already loaded
      if (!candidatesData[resultId]) {
        try {
          const response = await apiRequest('GET', `/api/beta/processing/result/${resultId}/candidates`);
          const data = await response.json();
          if (data.success) {
            setCandidatesData(prev => ({
              ...prev,
              [resultId]: data.data
            }));
          }
        } catch (error) {
          console.error('Failed to fetch candidates:', error);
        }
      }
    }

    setExpandedRows(newExpanded);
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dumps">
            <Database className="mr-2 h-4 w-4" />
            Available Dumps
          </TabsTrigger>
          <TabsTrigger value="results">
            <Search className="mr-2 h-4 w-4" />
            Processing Results
          </TabsTrigger>
          <TabsTrigger value="claims">
            <Brain className="mr-2 h-4 w-4" />
            Entity Claims Discovery
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
                      <Fragment key={result.id}>
                        <TableRow>
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
                            <div className="flex items-center gap-2">
                              {result.stage3Result?.entityName || 
                               result.stage4Result?.primaryLegalName || 
                               '-'}
                              {(result.stage4Result?.totalCandidates ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleCandidates(result.id)}
                                  className="h-6 w-6 p-0"
                                >
                                  {expandedRows.has(result.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {result.stage4Result?.primaryLei || '-'}
                          </TableCell>
                          <TableCell>
                            {result.stage4Result?.confidenceScore 
                              ? `${(Number(result.stage4Result.confidenceScore) * 100).toFixed(1)}%`
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
                        {expandedRows.has(result.id) && candidatesData[result.id] && (
                          <TableRow>
                            <TableCell colSpan={8} className="p-0">
                              <div className="bg-muted/50 p-4">
                                <h4 className="text-sm font-semibold mb-3">All GLEIF Candidates ({candidatesData[result.id].length})</h4>
                                <div className="space-y-2">
                                  {candidatesData[result.id].map((candidate) => (
                                    <div key={candidate.lei_code} className="bg-background rounded-lg p-3 border">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-sm font-medium">{candidate.legal_name}</p>
                                          <p className="text-xs text-muted-foreground">LEI: {candidate.lei_code}</p>
                                        </div>
                                        <div className="text-right">
                                          <Badge variant="outline" className="mb-1">
                                            Score: {(candidate.weighted_total_score * 100).toFixed(1)}%
                                          </Badge>
                                          <p className="text-xs text-muted-foreground">
                                            {candidate.headquarters_city}, {candidate.headquarters_country}
                                          </p>
                                        </div>
                                      </div>
                                      {candidate.selection_reason && (
                                        <p className="text-xs text-muted-foreground mt-2">{candidate.selection_reason}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entity Claims Discovery</CardTitle>
              <CardDescription>
                Generate multiple entity claims with evidence from cleaned dumps. This approach presents all possible entities as claims rather than seeking a single "correct" answer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Dump Selection */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Select a Dump to Generate Claims</h3>
                  {dumpsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (claimsDumpsData?.data || []).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No dumps with valid data available. Collect data using one of the collection methods first.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {(claimsDumpsData?.data || []).slice(0, 10).map((dump) => (
                        <div
                          key={`${dump.sourceType}-${dump.id}`}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedDumpForClaims?.id === dump.id && selectedDumpForClaims?.sourceType === dump.sourceType
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedDumpForClaims(dump)}
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium">{dump.domain}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {dump.sourceType.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(dump.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {selectedDumpForClaims?.id === dump.id && selectedDumpForClaims?.sourceType === dump.sourceType && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedDumpForClaims && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            const response = await apiRequest('POST', '/api/beta/gleif-claims/pre-check', {
                              domain: selectedDumpForClaims.domain,
                              dumpId: selectedDumpForClaims.id.toString(),
                              collectionType: selectedDumpForClaims.sourceType
                            });
                            
                            const rawResponse = await response.text();
                            const data = JSON.parse(rawResponse);
                            
                            if (data.success) {
                              const info = data.availableData;
                              toast({
                                title: "Pre-Check Complete",
                                description: (
                                  <div className="mt-2 space-y-1">
                                    <p>✓ Title: {info.hasTitle ? `"${info.title}"` : 'Not found'}</p>
                                    <p>✓ Meta Tags: {info.metaTagCount || 0} found</p>
                                    <p>✓ Structured Data: {info.hasStructuredData ? 'Available' : 'Not found'}</p>
                                    <p>✓ Text Content: {info.textLength || 0} characters</p>
                                  </div>
                                ),
                              });
                            } else {
                              toast({
                                title: "Pre-Check Failed",
                                description: data.error || "Failed to check data",
                                variant: "destructive"
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to pre-check data",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <FileSearch className="mr-2 h-4 w-4" />
                        Pre-Check Data
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={async () => {
                          try {
                            console.log('[Entity Claims] Starting claim generation for:', {
                              domain: selectedDumpForClaims.domain,
                              dumpId: selectedDumpForClaims.id.toString(),
                              collectionType: selectedDumpForClaims.sourceType,
                              apiPath: '/api/beta/gleif-claims/generate-claims'
                            });
                            
                            const response = await apiRequest('POST', '/api/beta/gleif-claims/generate-claims', {
                              domain: selectedDumpForClaims.domain,
                              dumpId: selectedDumpForClaims.id.toString(),
                              collectionType: selectedDumpForClaims.sourceType
                            });
                            
                            console.log('[Entity Claims] Response status:', response.status);
                            console.log('[Entity Claims] Response headers:', response.headers);
                            
                            // Get raw response first to diagnose the issue
                            const rawResponse = await response.text();
                            console.log('[Entity Claims] Raw Response:', rawResponse);
                            
                            // Try to parse as JSON
                            let data;
                            try {
                              data = JSON.parse(rawResponse);
                            } catch (parseError) {
                              console.error('[Entity Claims] Failed to parse response as JSON');
                              throw new Error('Server returned invalid response format');
                            }
                            
                            if (data.success) {
                              setClaimsResults(prev => [{
                                domain: selectedDumpForClaims.domain,
                                dumpId: selectedDumpForClaims.id,
                                collectionType: selectedDumpForClaims.sourceType,
                                claims: data.claims,
                                processedAt: new Date().toISOString()
                              }, ...prev]);
                              
                              toast({
                                title: "Claims Generated",
                                description: `Found ${data.claims.length} entity claims for ${selectedDumpForClaims.domain}`,
                              });
                            } else {
                              toast({
                                title: "Generation Failed",
                                description: data.error || "Failed to generate claims",
                                variant: "destructive"
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to generate claims",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        Generate Claims
                      </Button>
                    </div>
                  )}
                </div>

                {/* Claims Results */}
                {claimsResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Generated Claims</h3>
                    {claimsResults.map((result, idx) => (
                      <Card key={idx}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{result.domain}</CardTitle>
                              <CardDescription>
                                {result.claims.length} claims • Generated {formatTimestamp(result.processedAt)}
                              </CardDescription>
                            </div>
                            <Badge variant="outline">
                              {result.collectionType.replace('_', ' ')}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {result.claims.map((claim, claimIdx) => (
                              <div key={claimIdx} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="w-full">
                                    <p className="font-medium">{claim.entityName || claim.legalName}</p>
                                    {claim.leiCode && (
                                      <p className="text-sm text-muted-foreground mt-0.5">
                                        LEI: <code className="text-xs bg-muted px-1 py-0.5 rounded">{claim.leiCode}</code>
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant={
                                        (claim.claimType || claim.type) === 'gleif_verified' ? 'default' :
                                        (claim.claimType || claim.type) === 'gleif_relationship' ? 'secondary' :
                                        (claim.claimType || claim.type) === 'suffix_suggestion' ? 'outline' :
                                        'secondary'
                                      }>
                                        {((claim.claimType || claim.type) || '').replace('_', ' ')}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        Confidence: {
                                          typeof claim.confidence === 'number' 
                                            ? (claim.confidence * 100).toFixed(0) + '%'
                                            : claim.confidence
                                        }
                                      </span>
                                    </div>
                                    
                                    {/* GLEIF Additional Data */}
                                    {claim.gleifData && (
                                      <div className="mt-3 pt-3 border-t space-y-2">
                                        {claim.gleifData.jurisdiction && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Jurisdiction:</span>
                                            <span>{claim.gleifData.jurisdiction}</span>
                                          </div>
                                        )}
                                        {claim.gleifData.legalForm && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Legal Form:</span>
                                            <span>{claim.gleifData.legalForm}</span>
                                          </div>
                                        )}
                                        {claim.gleifData.entityStatus && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Entity Status:</span>
                                            <span>{claim.gleifData.entityStatus}</span>
                                          </div>
                                        )}
                                        {claim.gleifData.headquarters && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Headquarters:</span>
                                            <span>
                                              {[
                                                claim.gleifData.headquarters.city,
                                                claim.gleifData.headquarters.region,
                                                claim.gleifData.headquarters.country
                                              ].filter(Boolean).join(', ')}
                                            </span>
                                          </div>
                                        )}
                                        {claim.gleifData.legalAddress && claim.gleifData.legalAddress.addressLine && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Legal Address:</span>
                                            <span className="text-xs">
                                              {claim.gleifData.legalAddress.addressLine}
                                              {claim.gleifData.legalAddress.postalCode && `, ${claim.gleifData.legalAddress.postalCode}`}
                                            </span>
                                          </div>
                                        )}
                                        {claim.gleifData.registrationStatus && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Registration Status:</span>
                                            <span>{claim.gleifData.registrationStatus}</span>
                                          </div>
                                        )}
                                        {claim.gleifData.lastUpdateDate && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Last Updated:</span>
                                            <span>{new Date(claim.gleifData.lastUpdateDate).toLocaleDateString()}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {claim.evidence && (
                                  <div className="text-sm text-muted-foreground space-y-1">
                                    {claim.evidence.leiCode && (
                                      <p>LEI: <code className="text-xs">{claim.evidence.leiCode}</code></p>
                                    )}
                                    {claim.evidence.jurisdiction && (
                                      <p>Jurisdiction: {claim.evidence.jurisdiction}</p>
                                    )}
                                    {claim.evidence.city && claim.evidence.country && (
                                      <p>Location: {claim.evidence.city}, {claim.evidence.country}</p>
                                    )}
                                    {claim.evidence.relationshipType && (
                                      <p>Relationship: {claim.evidence.relationshipType}</p>
                                    )}
                                  </div>
                                )}
                                
                                {claim.reasoning && (
                                  <p className="text-sm text-muted-foreground italic">
                                    {claim.reasoning}
                                  </p>
                                )}
                                
                                <p className="text-xs text-muted-foreground">
                                  Source: {claim.source}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}