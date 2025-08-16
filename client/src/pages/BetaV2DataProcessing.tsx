import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, RefreshCw, PlayCircle, CheckCircle, Clock, AlertCircle, Database, Brain, Search, ChevronDown, ChevronUp, FileSearch, Award, Settings, Info, ChevronRight, FileText, Check, Globe } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { ArbitrationResults } from '@/components/ArbitrationResults';
import { UserBiasConfig } from '@/components/UserBiasConfig';

// Types
interface AvailableDump {
  id: number;
  domain: string;
  sourceType: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump';
  createdAt: string;
  status: string;
  hasData: boolean;
  cleanedModels?: string[]; // Models that have already cleaned this dump
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
  claimType: 'extracted' | 'gleif_verified' | 'gleif_relationship' | 'generated' | 'suspect' | 'suffix_suggestion';
  entityName: string;
  legalName?: string;
  confidence?: 'high' | 'medium' | 'low' | string | number;
  source?: string;
  leiCode?: string;
  type?: string; // Compatibility with older responses
  evidence?: {
    type?: string;
    leiCode?: string;
    jurisdiction?: string;
    status?: string;
    city?: string;
    country?: string;
    relationshipType?: string;
    [key: string]: any;
  };
  reasoning?: string;
  gleifData?: {
    legalName?: string;
    legalForm?: string;
    entityStatus?: string;
    jurisdiction?: string;
    entityCategory?: string;
    legalAddress?: {
      country?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      addressLine?: string;
    };
    headquarters?: {
      country?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      addressLine?: string;
    };
    registrationStatus?: string;
    initialRegistrationDate?: string;
    lastUpdateDate?: string;
  };
}

interface ClaimsResult {
  domain: string;
  dumpId: number;
  collectionType: string;
  claims: EntityClaim[];
  processedAt: string;
  arbitrationRequestId?: number; // For linking to arbitration results
}

interface ArbitrationEntity {
  legalName: string;
  leiCode?: string;
  confidence?: number;
  score?: number;
  reasoning?: string;
}

interface ArbitrationResult {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  rankedEntities?: ArbitrationEntity[];
  reasoning?: string;
  processingTimeMs?: number;
  arbitratorModel?: string;
  error?: string;
}

export default function BetaV2DataProcessingPage() {
  const [selectedDump, setSelectedDump] = useState<AvailableDump | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dumps');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [candidatesData, setCandidatesData] = useState<Record<number, GLEIFCandidate[]>>({});
  const [selectedDumpForClaims, setSelectedDumpForClaims] = useState<AvailableDump | null>(null);
  const [claimsResults, setClaimsResults] = useState<ClaimsResult[]>([]);
  const [arbitrationResults, setArbitrationResults] = useState<any>(null);
  const [arbitrationLoading, setArbitrationLoading] = useState(false);
  const [selectedArbitrationRequest, setSelectedArbitrationRequest] = useState<number | null>(null);
  const [processingStates, setProcessingStates] = useState<Record<string, boolean>>({});
  const [selectedCleaningModel, setSelectedCleaningModel] = useState('deepseek-chat');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [muteRankingRules, setMuteRankingRules] = useState(false); // For testing - bypasses ranking logic

  // Check beta server status - reduce polling frequency
  const { data: serverStatus } = useQuery<BetaServerStatus>({
    queryKey: ['/api/beta/status'],
    refetchInterval: 10000 // Check every 10 seconds instead of 2
  });

  // Poll for arbitration results when request is created
  const { data: arbitrationResultsData } = useQuery<ArbitrationResult>({
    queryKey: [`/api/beta/arbitration/results/${selectedArbitrationRequest}`],
    enabled: !!selectedArbitrationRequest,
    refetchInterval: (query) => {
      // Stop polling once completed or failed
      const currentData = query.state.data;
      if (currentData?.status === 'completed' || currentData?.status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds while processing
    }
  });

  // Fetch processing results - reduce polling frequency
  const { data: resultsData, isLoading: resultsLoading, refetch: refetchResults } = useQuery<{ data: ProcessingResult[] }>({
    queryKey: ['/api/beta/processing/results'],
    enabled: serverStatus?.status === 'ready',
    refetchInterval: 15000 // Poll every 15 seconds instead of 5
  });

  const results = resultsData?.data || [];

  // Clear processing states when results are updated
  useEffect(() => {
    if (results) {
      const completedResults = results.filter(r => r.status === 'completed' || r.status === 'failed');
      if (completedResults.length > 0) {
        setProcessingStates(prev => {
          const updated = { ...prev };
          completedResults.forEach(result => {
            const key = `${result.sourceType}-${result.sourceId}`;
            if (updated[key]) {
              updated[key] = false;
            }
          });
          return updated;
        });
      }
    }
  }, [results]);

  // Fetch available models for cleaning
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/beta/cleaning/models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };
    fetchModels();
  }, []);

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

  const dumps = dumpsData?.data || [];

  // Process dump mutation
  const processDumpMutation = useMutation({
    mutationFn: async (dump: AvailableDump) => {
      const dumpKey = `${dump.sourceType}-${dump.id}`;
      setProcessingStates(prev => ({ ...prev, [dumpKey]: true }));
      
      const response = await apiRequest('POST', '/api/beta/processing/process', {
        sourceType: dump.sourceType,
        sourceId: dump.id
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (selectedDump) {
        const dumpKey = `${selectedDump.sourceType}-${selectedDump.id}`;
        setProcessingStates(prev => ({ ...prev, [dumpKey]: false }));
      }
      
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
      if (selectedDump) {
        const dumpKey = `${selectedDump.sourceType}-${selectedDump.id}`;
        setProcessingStates(prev => ({ ...prev, [dumpKey]: false }));
      }
      
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
        <TabsList className="grid w-full grid-cols-5">
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
            Entity Claims
          </TabsTrigger>
          <TabsTrigger value="arbitration">
            <Award className="mr-2 h-4 w-4" />
            Arbitration
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings className="mr-2 h-4 w-4" />
            Preferences
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
                            disabled={!dump.hasData || processingStates[`${dump.sourceType}-${dump.id}`]}
                            onClick={() => {
                              setSelectedDump(dump);
                              processDumpMutation.mutate(dump);
                            }}
                          >
                            {processingStates[`${dump.sourceType}-${dump.id}`] ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <PlayCircle className="mr-2 h-4 w-4" />
                                Process
                              </>
                            )}
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
                      <React.Fragment key={result.id}>
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
                          <TableRow key={`expanded-${result.id}`}>
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
                      </React.Fragment>
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
                                {dump.cleanedModels && dump.cleanedModels.length > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Brain className="h-3 w-3 mr-1" />
                                    Cleaned
                                  </Badge>
                                )}
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
                    <div className="space-y-4 mt-4">
                      {/* Model Selection */}
                      <div className="border rounded-lg p-3 bg-muted/30">
                        <label className="block text-sm font-medium mb-2">
                          Select LLM Cleaning Model
                        </label>
                        <Select value={selectedCleaningModel} onValueChange={setSelectedCleaningModel}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select cleaning model..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableModels.length > 0 ? (
                              availableModels.map((model: any) => (
                                <SelectItem key={model.id || model.name} value={model.id || model.name}>
                                  {model.name} {model.isFree ? '(Free)' : ''}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="deepseek-chat">DeepSeek Chat (Free)</SelectItem>
                                <SelectItem value="deepseek-v3">DeepSeek V3 (Free)</SelectItem>
                                <SelectItem value="deepseek-r1">DeepSeek R1 Reasoning (Free)</SelectItem>
                                <SelectItem value="qwen-2.5">Qwen 2.5 72B (Free)</SelectItem>
                                <SelectItem value="qwen3-coder">Qwen3 Coder (Free)</SelectItem>
                                <SelectItem value="llama-3-8b">Llama 3 8B (Free)</SelectItem>
                                <SelectItem value="mistral-7b">Mistral 7B (Free)</SelectItem>
                                <SelectItem value="gemma-7b">Gemma 7B (Free)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: <span className="font-mono">{selectedCleaningModel}</span>
                        </p>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
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
                        variant="secondary"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            toast({
                              title: "Starting LLM Cleaning",
                              description: `Processing ${selectedDumpForClaims.domain} with ${selectedCleaningModel}...`,
                            });
                            
                            const response = await apiRequest('POST', '/api/beta/cleaning/process', {
                              sourceType: selectedDumpForClaims.sourceType,
                              sourceId: selectedDumpForClaims.id.toString(),
                              models: [selectedCleaningModel] // Use selected model
                            });
                            
                            const rawResponse = await response.text();
                            const data = JSON.parse(rawResponse);
                            
                            if (data.success) {
                              toast({
                                title: "Cleaning Complete",
                                description: `Successfully cleaned ${selectedDumpForClaims.domain}. Now you can generate claims.`,
                              });
                              
                              // Refresh the dumps list to show updated status
                              queryClient.invalidateQueries({ queryKey: ['/api/beta/gleif-claims/available-dumps'] });
                            } else {
                              toast({
                                title: "Cleaning Failed",
                                description: data.error || "Failed to clean data",
                                variant: "destructive"
                              });
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: error instanceof Error ? error.message : "Failed to clean data",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        Clean with Model
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
                                websiteEntity: data.websiteEntity,  // NEW: Store website entity separately
                                gleifEntities: data.gleifEntities,  // NEW: Store GLEIF entities
                                claims: data.claims || data.gleifEntities, // Backward compatibility
                                processedAt: new Date().toISOString()
                              }, ...prev]);
                              
                              toast({
                                title: "Claims Generated",
                                description: `Found ${data.gleifEntities?.length || 0} GLEIF entities for ${selectedDumpForClaims.domain}`,
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
                    </div>
                  )}
                </div>

                {/* Claims Results */}
                {claimsResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Generated Claims</h3>
                    {claimsResults.map((result, idx) => (
                      <Card key={`claims-result-${result.dumpId}-${idx}`}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{result.domain}</CardTitle>
                              <CardDescription>
                                {result.gleifEntities?.length || result.claims?.length || 0} GLEIF entities • Generated {formatTimestamp(result.processedAt)}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {result.collectionType.replace('_', ' ')}
                              </Badge>
                              
                              {/* Mute Ranking Rules Toggle for Testing */}
                              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded">
                                <input
                                  type="checkbox"
                                  id={`mute-ranking-${result.dumpId}`}
                                  checked={muteRankingRules}
                                  onChange={(e) => setMuteRankingRules(e.target.checked)}
                                  className="h-3 w-3"
                                />
                                <label 
                                  htmlFor={`mute-ranking-${result.dumpId}`} 
                                  className="text-xs font-medium text-amber-700 cursor-pointer"
                                >
                                  Mute Rules (Test)
                                </label>
                              </div>
                              
                              <Button
                                size="sm"
                                variant="default"
                                onClick={async () => {
                                  try {
                                    setArbitrationLoading(true);
                                    
                                    // Reconstruct full claims array for arbitration
                                    // Combine website entity (as Claim 0) with GLEIF entities
                                    const fullClaims = [];
                                    
                                    // Add website entity as Claim 0 if it exists
                                    if (result.websiteEntity) {
                                      fullClaims.push({
                                        claimNumber: 0,
                                        claimType: 'extracted',
                                        entityName: result.websiteEntity.entityName,
                                        source: result.websiteEntity.source,
                                        confidence: result.websiteEntity.confidence
                                      });
                                    }
                                    
                                    // Add GLEIF entities as Claims 1, 2, 3...
                                    const gleifEntities = result.gleifEntities || result.claims || [];
                                    gleifEntities.forEach((entity, idx) => {
                                      fullClaims.push({
                                        ...entity,
                                        claimNumber: idx + 1
                                      });
                                    });
                                    
                                    // Start arbitration request with reconstructed claims
                                    const response = await apiRequest('POST', '/api/beta/arbitration/request', {
                                      domain: result.domain,
                                      dumpId: result.dumpId,
                                      collectionType: result.collectionType,
                                      existingClaims: fullClaims, // Pass the reconstructed full claims array
                                      muteRankingRules: muteRankingRules // Pass the mute flag
                                    });
                                    
                                    const data = await response.json();
                                    
                                    if (data.success) {
                                      toast({
                                        title: "Arbitration Started",
                                        description: `Processing ${result.claims.length} claims for ${result.domain}. This will take about 2 minutes.`
                                      });
                                      
                                      // Set the request ID to track results and associate with dump
                                      setSelectedArbitrationRequest(data.requestId);
                                      // Store mapping of dumpId to requestId
                                      result.arbitrationRequestId = data.requestId;
                                    } else {
                                      throw new Error(data.error || 'Failed to start arbitration');
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Error",
                                      description: error instanceof Error ? error.message : "Failed to start arbitration",
                                      variant: "destructive"
                                    });
                                  } finally {
                                    setArbitrationLoading(false);
                                  }
                                }}
                                disabled={arbitrationLoading}
                              >
                                <Award className="mr-2 h-4 w-4" />
                                Run Arbitration
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {/* Enhanced Arbitration Results Display */}
                            {arbitrationResultsData?.status === 'completed' && 
                             arbitrationResultsData?.rankedEntities && 
                             result.arbitrationRequestId === selectedArbitrationRequest && (
                              <div className="mb-4 space-y-4">
                                {/* Primary Recommendation Card */}
                                {arbitrationResultsData.rankedEntities[0] && (
                                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg">
                                    <div className="flex items-start justify-between mb-3">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <Award className="h-5 w-5 text-green-600" />
                                          <h4 className="text-sm font-bold text-green-800">PRIMARY RECOMMENDATION</h4>
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                          {arbitrationResultsData.rankedEntities[0].entityName || 
                                           arbitrationResultsData.rankedEntities[0].legalName || 
                                           arbitrationResultsData.rankedEntities[0].metadata?.legalName || 
                                           'Unknown Entity'}
                                          {arbitrationResultsData.rankedEntities[0].claimNumber !== undefined && (
                                            <span className="text-sm font-normal text-gray-600 ml-2">
                                              {arbitrationResultsData.rankedEntities[0].claimNumber === 0 
                                                ? '(Claim 0 - Website Extracted)' 
                                                : `(GLEIF Claim ${arbitrationResultsData.rankedEntities[0].claimNumber})`}
                                            </span>
                                          )}
                                        </h3>
                                        {arbitrationResultsData.rankedEntities[0].leiCode && (
                                          <code className="text-xs bg-white px-2 py-1 rounded mt-1 inline-block">
                                            LEI: {arbitrationResultsData.rankedEntities[0].leiCode}
                                          </code>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-2xl font-bold text-green-600">
                                          {((arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) * 100).toFixed(0)}%
                                        </div>
                                        <Badge className="bg-green-600 text-white">
                                          Recommended
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {/* Confidence Level Indicator */}
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span>Confidence Level</span>
                                        <span className="font-medium">
                                          {(arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) >= 0.8 ? 'HIGH' :
                                           (arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) >= 0.5 ? 'MEDIUM' : 'LOW'}
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                          className="bg-green-600 h-2 rounded-full transition-all"
                                          style={{width: `${((arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) * 100)}%`}}
                                        />
                                      </div>
                                    </div>
                                    
                                    {arbitrationResultsData.rankedEntities[0].reasoning && (
                                      <p className="text-sm text-gray-700 bg-white p-2 rounded">
                                        {arbitrationResultsData.rankedEntities[0].reasoning}
                                      </p>
                                    )}
                                  </div>
                                )}
                                
                                {/* Comparative Analysis Table */}
                                {arbitrationResultsData.rankedEntities.length > 1 && (
                                  <div className="bg-white border rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 border-b">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Comparative Analysis
                                      </h4>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b">
                                          <tr>
                                            <th className="text-left px-4 py-2">Rank</th>
                                            <th className="text-left px-4 py-2">Entity Name</th>
                                            <th className="text-left px-4 py-2">LEI Code</th>
                                            <th className="text-left px-4 py-2">Confidence</th>
                                            <th className="text-left px-4 py-2">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {arbitrationResultsData.rankedEntities.slice(0, 5).map((entity: any, idx: number) => (
                                            <tr key={`comp-${idx}`} className={idx === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                              <td className="px-4 py-2">
                                                <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                                                  idx === 0 ? 'bg-green-600 text-white' : 
                                                  idx === 1 ? 'bg-blue-500 text-white' :
                                                  'bg-gray-400 text-white'
                                                } text-xs font-bold`}>
                                                  {idx + 1}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2">
                                                <div>
                                                  <span className="font-medium">{entity.entityName || entity.legalName || entity.metadata?.legalName || 'Unknown Entity'}</span>
                                                  {entity.claimNumber !== undefined && (
                                                    <span className="text-xs text-gray-500 ml-2">
                                                      {entity.claimNumber === 0 ? '(Claim 0 - Website)' : `(Claim ${entity.claimNumber})`}
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2">
                                                {entity.leiCode ? (
                                                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                                                    {entity.leiCode}
                                                  </code>
                                                ) : (
                                                  <span className="text-gray-400">—</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                                    <div 
                                                      className={`h-1.5 rounded-full ${
                                                        idx === 0 ? 'bg-green-600' : 
                                                        idx === 1 ? 'bg-blue-500' : 
                                                        'bg-gray-400'
                                                      }`}
                                                      style={{width: `${((entity.confidence || entity.score || 0) * 100)}%`}}
                                                    />
                                                  </div>
                                                  <span className="text-xs">
                                                    {((entity.confidence || entity.score || 0) * 100).toFixed(0)}%
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2">
                                                <Badge 
                                                  variant={idx === 0 ? 'default' : 'outline'} 
                                                  className={`text-xs ${
                                                    idx === 0 ? 'bg-green-600 text-white' : ''
                                                  }`}
                                                >
                                                  {idx === 0 ? 'Recommended' : idx === 1 ? 'Alternative' : 'Consider'}
                                                </Badge>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Decision Criteria & Reasoning */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Info className="h-4 w-4 text-blue-600" />
                                    Arbitration Analysis
                                  </h4>
                                  
                                  {/* Overall Reasoning */}
                                  {arbitrationResultsData.reasoning && (
                                    <div className="mb-3">
                                      <details className="group">
                                        <summary className="cursor-pointer text-sm font-medium text-blue-800 hover:text-blue-900">
                                          View Full Reasoning
                                        </summary>
                                        <div className="mt-2 p-3 bg-white rounded text-sm text-gray-700">
                                          {arbitrationResultsData.reasoning}
                                        </div>
                                      </details>
                                    </div>
                                  )}
                                  
                                  {/* Citations if available */}
                                  {arbitrationResultsData.citations && arbitrationResultsData.citations.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-gray-600 mb-2">Evidence Sources:</p>
                                      <div className="space-y-1">
                                        {arbitrationResultsData.citations.slice(0, 5).map((citation: string, idx: number) => (
                                          <div key={`cite-${idx}`} className="flex items-start gap-2">
                                            <span className="text-xs bg-blue-600 text-white px-1 rounded">
                                              [{idx + 1}]
                                            </span>
                                            <a 
                                              href={citation} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-xs text-blue-600 hover:underline truncate flex-1"
                                            >
                                              {citation}
                                            </a>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Metadata */}
                                  <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between text-xs text-gray-600">
                                    <span>Model: {arbitrationResultsData.arbitratorModel || 'Perplexity Sonar Pro'}</span>
                                    <span>Processing: {arbitrationResultsData.processingTimeMs}ms</span>
                                  </div>
                                </div>
                                
                                {/* Actionable Summary */}
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 text-amber-600" />
                                    Recommended Action
                                  </h4>
                                  <p className="text-sm text-gray-700">
                                    {arbitrationResultsData.rankedEntities[0] && (
                                      <>
                                        {(arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) >= 0.8 ? (
                                          <span className="font-medium text-green-700">
                                            ✓ Proceed with due diligence on {arbitrationResultsData.rankedEntities[0].legalName}. 
                                            High confidence match with verified LEI.
                                          </span>
                                        ) : (arbitrationResultsData.rankedEntities[0].confidence || arbitrationResultsData.rankedEntities[0].score || 0) >= 0.5 ? (
                                          <span className="font-medium text-amber-700">
                                            ⚠ Verify {arbitrationResultsData.rankedEntities[0].legalName} with additional research. 
                                            Medium confidence - consider reviewing alternative entities.
                                          </span>
                                        ) : (
                                          <span className="font-medium text-red-700">
                                            ⚡ Manual review required. Low confidence in all matches. 
                                            Consider additional data sources or domain verification.
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Show website entity context if available */}
                            {result.websiteEntity && (
                              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-1">
                                  <Globe className="h-4 w-4 text-amber-600" />
                                  <span className="text-sm font-medium text-amber-800">Website Claims To Be:</span>
                                </div>
                                <p className="text-lg font-semibold">{result.websiteEntity.entityName}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Source: {result.websiteEntity.source} • Confidence: {result.websiteEntity.confidence}
                                </p>
                              </div>
                            )}
                            
                            {/* Display only GLEIF entities */}
                            {(result.gleifEntities || result.claims || []).map((claim, claimIdx) => (
                              <div key={`claim-${result.dumpId}-${claimIdx}`} className="border rounded-lg p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="w-full">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="default">
                                        GLEIF Match {claimIdx + 1}
                                      </Badge>
                                      <Check className="h-4 w-4 text-green-600" />
                                    </div>
                                    <p className="font-medium text-lg">{claim.entityName || claim.legalName || "Unknown Entity"}</p>
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
                                        {claim.gleifData.legalName && (
                                          <div className="flex gap-2 text-sm">
                                            <span className="text-muted-foreground">Primary Legal Name:</span>
                                            <span className="font-medium">{claim.gleifData.legalName}</span>
                                          </div>
                                        )}
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

        {/* Arbitration Tab */}
        <TabsContent value="arbitration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entity Arbitration System</CardTitle>
              <CardDescription>
                Uses Perplexity Sonar to intelligently rank and select the best legal entity from multiple claims. 
                The system applies jurisdiction bias, parent entity preference, and multi-tier ranking for acquisition research.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Test Arbitration Section */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Test Arbitration with Sample Data</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={async () => {
                        try {
                          setArbitrationLoading(true);
                          setArbitrationResults(null);
                          
                          const response = await apiRequest('POST', '/api/beta/arbitration/test-sample', {
                            domain: 'apple.com',
                            entityName: 'Apple'
                          });
                          
                          const data = await response.json();
                          setArbitrationResults(data.data);
                          
                          toast({
                            title: "Arbitration Complete",
                            description: `Generated ${data.data.totalClaims} claims and ranked entities for Apple Inc.`
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to start arbitration test",
                            variant: "destructive"
                          });
                        } finally {
                          setArbitrationLoading(false);
                        }
                      }}
                      disabled={arbitrationLoading}
                    >
                      {arbitrationLoading ? "Processing..." : "Test with Apple Inc."}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          setArbitrationLoading(true);
                          setArbitrationResults(null);
                          
                          const response = await apiRequest('POST', '/api/beta/arbitration/test-sample', {
                            domain: 'microsoft.com',
                            entityName: 'Microsoft'
                          });
                          
                          const data = await response.json();
                          setArbitrationResults(data.data);
                          
                          toast({
                            title: "Arbitration Complete",
                            description: `Generated ${data.data.totalClaims} claims and ranked entities for Microsoft Corp.`
                          });
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: error instanceof Error ? error.message : "Failed to start arbitration test",
                            variant: "destructive"
                          });
                        } finally {
                          setArbitrationLoading(false);
                        }
                      }}
                      disabled={arbitrationLoading}
                    >
                      {arbitrationLoading ? "Processing..." : "Test with Microsoft Corp."}
                    </Button>
                  </div>
                </div>

                {/* Display Arbitration Results */}
                {arbitrationResults && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="text-sm font-semibold">Arbitration Results</h3>
                    
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Domain:</span>
                        <p className="font-medium">{arbitrationResults.domain}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total Claims:</span>
                        <p className="font-medium">{arbitrationResults.totalClaims}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Processing Time:</span>
                        <p className="font-medium">{arbitrationResults.processingTime}</p>
                      </div>
                    </div>

                    {/* Ranked Entities */}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Ranked Entities (Best Match First)</h4>
                      <div className="space-y-2">
                        {arbitrationResults.rankedEntities?.map((entity: any, index: number) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium">
                                  #{index + 1}: {entity.legalName || entity.entityName}
                                </p>
                                {entity.leiCode && (
                                  <p className="text-sm text-gray-600">LEI: {entity.leiCode}</p>
                                )}
                                <p className="text-sm text-gray-600">
                                  Confidence: {typeof entity.confidence === 'number' 
                                    ? (entity.confidence * 100).toFixed(1) + '%' 
                                    : entity.confidence}
                                </p>
                                {entity.acquisitionGrade && (
                                  <p className="text-sm font-medium text-blue-600">
                                    Acquisition Grade: {entity.acquisitionGrade}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  entity.acquisitionGrade === 'A+' ? 'bg-green-100 text-green-800' :
                                  entity.acquisitionGrade === 'A' ? 'bg-green-50 text-green-700' :
                                  entity.acquisitionGrade === 'B+' ? 'bg-yellow-100 text-yellow-800' :
                                  entity.acquisitionGrade === 'B' ? 'bg-yellow-50 text-yellow-700' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {entity.acquisitionGrade || 'C'}
                                </span>
                              </div>
                            </div>
                            {entity.reasoning && (
                              <div className="mt-2 p-2 bg-blue-50 rounded">
                                <p className="text-xs font-medium text-blue-900 mb-1">Arbitrator's Reasoning:</p>
                                <p className="text-sm text-blue-800">{entity.reasoning}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Overall Reasoning */}
                    {arbitrationResults.overallReasoning && (
                      <div className="p-3 bg-indigo-50 rounded-lg">
                        <p className="text-sm font-medium text-indigo-900 mb-1">Overall Arbitration Logic:</p>
                        <p className="text-sm text-indigo-800">{arbitrationResults.overallReasoning}</p>
                      </div>
                    )}

                    {/* Raw Claims - By Claim Number */}
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">View All Claims by Number ({arbitrationResults.claims?.length || 0})</summary>
                      <div className="mt-2 space-y-2">
                        {arbitrationResults.claims?.map((claim: any, index: number) => (
                          <div key={index} className="bg-gray-50 p-2 rounded">
                            <p className="font-medium">Claim {claim.claimNumber}: {claim.entityName}</p>
                            <p className="text-xs text-gray-600">Type: {claim.claimType} | Confidence: {claim.confidence}</p>
                            {claim.leiCode && <p className="text-xs">LEI: {claim.leiCode}</p>}
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Raw Claims - By Confidence Level */}
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium">View Claims by Confidence (Highest First)</summary>
                      <div className="mt-2 space-y-2">
                        {arbitrationResults.claims
                          ?.slice()
                          .sort((a: any, b: any) => {
                            // Convert confidence to numeric for sorting
                            const getConfidenceValue = (conf: any) => {
                              if (typeof conf === 'number') return conf;
                              if (conf === 'high') return 0.9;
                              if (conf === 'medium') return 0.5;
                              if (conf === 'low') return 0.3;
                              return parseFloat(conf) || 0;
                            };
                            return getConfidenceValue(b.confidence) - getConfidenceValue(a.confidence);
                          })
                          .map((claim: any, index: number) => (
                            <div key={index} className={`p-2 rounded ${
                              index === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                            }`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">
                                    {claim.entityName}
                                    {index === 0 && <span className="ml-2 text-xs text-green-600">Highest Confidence</span>}
                                  </p>
                                  <p className="text-xs text-gray-600">
                                    Claim #{claim.claimNumber} | Type: {claim.claimType}
                                  </p>
                                  {claim.leiCode && <p className="text-xs">LEI: {claim.leiCode}</p>}
                                </div>
                                <span className={`text-xs px-2 py-1 rounded font-medium ${
                                  claim.confidence === 'high' || claim.confidence >= 0.8 ? 'bg-green-100 text-green-800' :
                                  claim.confidence === 'medium' || claim.confidence >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {claim.confidence}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>

                    {/* Perplexity Response */}
                    {arbitrationResults.perplexityResponse && (
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">Perplexity Analysis</summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded">
                          <p className="whitespace-pre-wrap">{arbitrationResults.perplexityResponse}</p>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Arbitration Results Component */}
                <ArbitrationResults 
                  domain={selectedDump?.domain}
                  onProcessDomain={(domain) => {
                    toast({
                      title: "Arbitration Process",
                      description: `Starting arbitration for ${domain}`
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          <UserBiasConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}