import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface TestResult {
  domain: string;
  method: string;
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
  errorCode?: string;
  extractionMethod?: string;
  country?: string;
  technicalDetails?: any;
  sources?: string[];
  llmResponse?: any;
  rawApiResponse?: any;
  entityCount?: number;
  unprocessedEntities?: any[];
}

export default function BetaTestingPage() {
  const [domain, setDomain] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [selectedMethod, setSelectedMethod] = useState('all');

  const testMethods = [
    { id: 'all', name: 'All Methods', description: 'Run all extraction methods' },
    { id: 'axios_cheerio', name: 'Axios/Cheerio', description: 'Standard HTML parsing' },
    { id: 'puppeteer', name: 'Puppeteer', description: 'Browser automation' },
    { id: 'perplexity_llm', name: 'Perplexity LLM', description: 'AI-powered extraction' },
    { id: 'gleif_api', name: 'GLEIF API', description: 'Legal entity data' },
    { id: 'gleif_raw', name: 'GLEIF RAW', description: 'Unprocessed JSON' }
  ];

  const runTest = useCallback(async () => {
    if (!domain.trim()) return;

    setIsProcessing(true);
    setTestResults([]);

    try {
      // Use the correct endpoint for GLEIF testing
      const endpoint = selectedMethod === 'gleif_api' ? '/api/beta/gleif-test' :
                   selectedMethod === 'gleif_raw' ? '/api/beta/gleif-raw' : '/api/beta/smoke-test';

      const requestBody = selectedMethod === 'gleif_api' || selectedMethod === 'gleif_raw'
        ? { companyName: domain.trim(), domain: domain.trim() }
        : { domain: domain.trim(), method: selectedMethod };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      // Handle different response formats
      if (selectedMethod === 'gleif_api' || selectedMethod === 'gleif_raw') {
        setTestResults([result]);
      } else {
        setTestResults(Array.isArray(result.data) ? result.data : [result.data || result]);
      }

    } catch (error) {
      console.error('Test failed:', error);
      setTestResults([{
        domain: domain.trim(),
        method: selectedMethod,
        companyName: null,
        confidence: 0,
        processingTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'CLIENT_ERROR'
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [domain, selectedMethod]);

  const getStatusBadge = (result: TestResult) => {
    if (result.success) {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Success
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    }
  };

  const getMethodBadge = (method: string) => {
    const methodColors = {
      axios_cheerio: 'bg-blue-100 text-blue-800',
      puppeteer: 'bg-purple-100 text-purple-800',
      perplexity_llm: 'bg-orange-100 text-orange-800',
      gleif_api: 'bg-green-100 text-green-800',
      gleif_raw: 'bg-teal-100 text-teal-800'
    };

    return (
      <Badge className={methodColors[method as keyof typeof methodColors] || 'bg-gray-100 text-gray-800'}>
        {method}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Beta Testing Platform</h1>
        <p className="text-muted-foreground">
          Test domain extraction methods with enhanced debugging and analysis capabilities
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Domain Test</TabsTrigger>
          <TabsTrigger value="batch">Batch Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Single Domain Testing</CardTitle>
              <CardDescription>
                Test extraction methods on a single domain with detailed debugging information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Domain:</label>
                <Input
                  placeholder="Enter domain (e.g., apple.com)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isProcessing && runTest()}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Test Method:</label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {testMethods.map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name} - {method.description}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                onClick={runTest}
                disabled={!domain.trim() || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Run Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results Display */}
          {testResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  Results for {domain} using {selectedMethod === 'all' ? 'all methods' : selectedMethod}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{result.domain}</span>
                          {getMethodBadge(result.method)}
                          {getStatusBadge(result)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.processingTime}ms
                        </div>
                      </div>

                      {result.success ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Company Name:</span>
                            <p className="text-sm">{result.companyName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Confidence:</span>
                            <p className="text-sm">{result.confidence}%</p>
                          </div>
                          {result.extractionMethod && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">Extraction Method:</span>
                              <p className="text-sm">{result.extractionMethod}</p>
                            </div>
                          )}
                          {result.country && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">Country:</span>
                              <p className="text-sm">{result.country}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Error:</strong> {result.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* COMPLETE RAW JSON DATA DISPLAY (for raw methods) */}
                      {selectedMethod === 'gleif_raw' && (
                        <div className="mt-4 space-y-3">
                          
                          {/* Complete Raw API Response */}
                          {result.rawApiResponse && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                                📄 Complete Raw GLEIF Response ({result.entityCount || 0} entities, {result.responseSize || 0} bytes)
                              </summary>
                              <div className="mt-2 p-3 bg-blue-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
                                  {JSON.stringify(result.rawApiResponse, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* HTTP Headers */}
                          {result.httpHeaders && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-green-600 hover:text-green-800">
                                🌐 HTTP Headers from GLEIF (API Version: {result.gleifApiVersion || 'unknown'})
                              </summary>
                              <div className="mt-2 p-3 bg-green-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                                  {JSON.stringify(result.httpHeaders, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* GLEIF Metadata */}
                          {result.metaData && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-purple-600 hover:text-purple-800">
                                📊 GLEIF Metadata & Pagination
                              </summary>
                              <div className="mt-2 p-3 bg-purple-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                                  {JSON.stringify(result.metaData, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* GLEIF Links */}
                          {result.includesLinks && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-orange-600 hover:text-orange-800">
                                🔗 GLEIF API Links
                              </summary>
                              <div className="mt-2 p-3 bg-orange-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                                  {JSON.stringify(result.includesLinks, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* Unprocessed Entities */}
                          {result.unprocessedEntities && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-red-600 hover:text-red-800">
                                🏢 Raw Entity Data ({result.unprocessedEntities.length} entities)
                              </summary>
                              <div className="mt-2 p-3 bg-red-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64">
                                  {JSON.stringify(result.unprocessedEntities, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* Request Details */}
                          {result.requestDetails && (
                            <details className="border rounded p-2">
                              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                                🔍 Request Details & Technical Info
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-32">
                                  {JSON.stringify(result.requestDetails, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {/* Data Integrity Summary */}
                          <div className="bg-gray-100 p-3 rounded text-xs">
                            <strong>🔒 Data Integrity:</strong> Complete passthrough - No data processing or modification applied.
                            <br />
                            <strong>📈 Capture Method:</strong> {result.technicalDetails?.captureMethod || 'unknown'}
                            <br />
                            <strong>✅ Sections Included:</strong> {
                              result.technicalDetails?.includedSections ? 
                              Object.entries(result.technicalDetails.includedSections)
                                .filter(([key, value]) => value)
                                .map(([key]) => key)
                                .join(', ') : 'none'
                            }
                          </div>

                        </div>
                      )}

                      {result.technicalDetails && (
                         <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                            Technical Details
                          </summary>
                           <div className="mt-2 p-3 bg-gray-50 rounded">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48">
                              {typeof result.technicalDetails === 'string' 
                                ? result.technicalDetails 
                                : JSON.stringify(result.technicalDetails, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}

                      {result.sources && result.sources.length > 0 && (
                        <div className="mt-4">
                          <span className="text-sm font-medium text-muted-foreground">
                            Sources ({result.sources.length}):
                          </span>
                          <div className="text-sm mt-2 space-y-1 bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                            {result.sources.slice(0, 5).map((source: string, idx: number) => (
                              <div key={idx} className="text-xs text-muted-foreground break-words">
                                • {source}
                              </div>
                            ))}
                            {result.sources.length > 5 && (
                              <div className="text-xs text-muted-foreground italic">
                                ... and {result.sources.length - 5} more sources
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Statistics */}
          {testResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(testResults.reduce((acc, r) => acc + r.processingTime, 0) / testResults.length)}ms
                  </div>
                  <div className="text-sm text-muted-foreground">Average Processing Time</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {testResults.filter(r => r.success).length}/{testResults.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(testResults.reduce((acc, r) => acc + r.confidence, 0) / testResults.length)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Average Confidence</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="batch" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Batch Testing</CardTitle>
              <CardDescription>
                Test multiple domains simultaneously with comparison analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Batch testing functionality coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}