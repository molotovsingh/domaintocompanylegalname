
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, AlertCircle, Brain } from 'lucide-react';

interface PerplexityResult {
  success: boolean;
  companyName?: string;
  confidence?: number;
  processingTime?: number;
  extractionMethod?: string;
  country?: string;
  sources?: string[];
  llmResponse?: any;
  error?: string;
}

export default function PerplexityTestingPage() {
  const [domain, setDomain] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResults, setTestResults] = useState<PerplexityResult | null>(null);

  const runPerplexityTest = async () => {
    if (!domain.trim()) return;

    setIsProcessing(true);
    setTestResults(null);

    try {
      const response = await fetch('/api/beta/smoke-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: domain.trim(),
          method: 'perplexity_llm'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setTestResults(result.data);
      } else {
        setTestResults({
          success: false,
          error: result.error || 'Unknown error occurred',
          processingTime: 0
        });
      }

    } catch (error) {
      console.error('Perplexity test failed:', error);
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: 0
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center">
          <Brain className="w-8 h-8 mr-3 text-orange-500" />
          Perplexity AI Testing
        </h1>
        <p className="text-muted-foreground">
          Test AI-powered company name extraction using Perplexity LLM
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Perplexity LLM Extraction</CardTitle>
          <CardDescription>
            Use AI to extract company information from domain websites
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Domain:</label>
            <Input
              placeholder="Enter domain (e.g., apple.com, microsoft.com)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isProcessing && runPerplexityTest()}
            />
          </div>

          <Button 
            onClick={runPerplexityTest}
            disabled={!domain.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running AI Analysis...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Run Perplexity Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Display */}
      {testResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Perplexity Test Results</CardTitle>
              <Badge variant={testResults.success ? 'default' : 'destructive'}>
                {testResults.success ? (
                  <><CheckCircle className="w-3 h-3 mr-1" />Success</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" />Failed</>
                )}
              </Badge>
            </div>
            <CardDescription>
              AI analysis results for "{domain}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResults.success ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Company Name:</span>
                    <p className="text-sm">{testResults.companyName || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Confidence:</span>
                    <p className="text-sm">{testResults.confidence}%</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Processing Time:</span>
                    <p className="text-sm">{testResults.processingTime}ms</p>
                  </div>
                  {testResults.extractionMethod && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Method:</span>
                      <p className="text-sm">{testResults.extractionMethod}</p>
                    </div>
                  )}
                  {testResults.country && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Country:</span>
                      <p className="text-sm">{testResults.country}</p>
                    </div>
                  )}
                </div>

                {testResults.sources && testResults.sources.length > 0 && (
                  <div className="mt-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      AI Sources ({testResults.sources.length}):
                    </span>
                    <div className="text-sm mt-2 space-y-1 bg-orange-50 p-3 rounded max-h-32 overflow-y-auto">
                      {testResults.sources.slice(0, 5).map((source: string, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground break-words">
                          • {source}
                        </div>
                      ))}
                      {testResults.sources.length > 5 && (
                        <div className="text-xs text-muted-foreground italic">
                          ... and {testResults.sources.length - 5} more sources
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {testResults.llmResponse && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-orange-600 hover:text-orange-800">
                      🤖 Full AI Response
                    </summary>
                    <div className="mt-2 p-3 bg-orange-50 rounded">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-48">
                        {JSON.stringify(testResults.llmResponse, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {testResults.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
