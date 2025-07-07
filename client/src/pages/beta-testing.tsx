import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Beaker, 
  Shield, 
  Database, 
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';

interface BetaTestResult {
  domain: string;
  method: string;
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
  extractionMethod: string | null;
  technicalDetails: string | null;
  llmResponse: {
    content?: string;
    citations?: any[];
    parsedJson?: any;
  } | null;
}

export default function BetaTesting() {
  const [testDomain, setTestDomain] = useState('');
  const [testMethod, setTestMethod] = useState('perplexity_llm');
  const [testResults, setTestResults] = useState<BetaTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const runBetaTest = async (domain: string, method: string): Promise<BetaTestResult> => {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/beta/smoke-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, method })
      });

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        domain,
        method,
        processingTime,
        companyName: result.data?.companyName || result.companyName,
        confidence: result.data?.confidence || result.confidence || 0,
        success: result.success,
        error: result.error,
        extractionMethod: result.data?.extractionMethod || result.extractionMethod,
        technicalDetails: result.data?.technicalDetails || result.technicalDetails,
        llmResponse: result.data?.llmResponse || result.llmResponse || null,
      };
    } catch (error) {
      return {
        domain,
        method,
        processingTime: Date.now() - Date.now(),
        companyName: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: null,
        llmResponse: null,
      };
    }
  };

  const runSingleTest = async () => {
    if (!testDomain.trim()) return;

    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    setProgress(50);
    const result = await runBetaTest(testDomain.trim(), testMethod);
    setTestResults([result]);
    setProgress(100);
    setIsRunning(false);
  };

  const runFullTest = async () => {
    if (!testDomain.trim()) return;

    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    const methods = ['axios_cheerio', 'puppeteer', 'perplexity_llm'];
    const results: BetaTestResult[] = [];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      setProgress((i / methods.length) * 100);

      const result = await runBetaTest(testDomain.trim(), method);
      results.push(result);
      setTestResults([...results]);
    }

    setProgress(100);
    setIsRunning(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Beaker className="w-8 h-8 mr-3 text-blue-500" />
            Beta Testing Platform
          </h1>
          <p className="text-muted-foreground mt-2">
            Test experimental extraction methods in isolated environment
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-sm">
            <Database className="w-4 h-4 mr-1" />
            Isolated Database
          </Badge>
          <Badge variant="outline" className="text-sm">
            <Shield className="w-4 h-4 mr-1" />
            Port 3001
          </Badge>
          <Badge className="bg-green-500 text-white">
            <Activity className="w-4 h-4 mr-1" />
            Auto-Started
          </Badge>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Beta Environment:</strong> All tests run in complete isolation from production data. 
          Beta server starts automatically with the main application.
        </AlertDescription>
      </Alert>

      {/* Test Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Extraction Test</CardTitle>
          <CardDescription>
            Test domain extraction using experimental methods including Perplexity LLM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={testDomain}
              onChange={(e) => setTestDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && runSingleTest()}
              disabled={isRunning}
              className="flex-1"
            />
            <Select value={testMethod} onValueChange={setTestMethod} disabled={isRunning}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="axios_cheerio">Axios/Cheerio</SelectItem>
                <SelectItem value="puppeteer">Puppeteer</SelectItem>
                <SelectItem value="perplexity_llm">Perplexity LLM</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={runSingleTest} 
              disabled={isRunning || !testDomain.trim()}
            >
              <Play className="w-4 h-4 mr-2" />
              {isRunning ? 'Testing...' : 'Test'}
            </Button>
            <Button 
              onClick={runFullTest} 
              disabled={isRunning || !testDomain.trim()}
              variant="outline"
            >
              <Zap className="w-4 h-4 mr-2" />
              All Methods
            </Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Testing extraction methods...
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Extraction results for {testResults[0]?.domain}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-sm font-medium">
                          {result.method.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={`text-sm font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {result.processingTime}ms
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Company:</span>
                          <p className="text-base font-medium">{result.companyName || 'Not found'}</p>
                        </div>
                        {result.extractionMethod && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">Extraction Method:</span>
                            <p className="text-sm">{result.extractionMethod}</p>
                          </div>
                        )}
                      </div>

                      {result.error && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Error:</strong> {result.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.technicalDetails && (
                        <Alert>
                          <AlertDescription>
                            <strong>Technical Details:</strong> {result.technicalDetails}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.method === 'perplexity_llm' && result.llmResponse?.parsedJson && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">Complete LLM JSON Analysis:</h4>
                          <pre className="text-sm text-blue-800 whitespace-pre-wrap overflow-auto max-h-96 bg-white p-3 rounded border">
                            {JSON.stringify(result.llmResponse.parsedJson, null, 2)}
                          </pre>
                          {result.llmResponse.citations && result.llmResponse.citations.length > 0 && (
                            <div className="mt-3">
                              <h5 className="font-medium text-blue-900 mb-1">Sources ({result.llmResponse.citations.length}):</h5>
                              <div className="text-xs text-blue-700 space-y-1">
                                {result.llmResponse.citations.slice(0, 3).map((citation: string, idx: number) => (
                                  <div key={idx} className="truncate">• {citation}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {result.method === 'perplexity_llm' && !result.llmResponse?.parsedJson && result.llmResponse?.content && (
                        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                          <h4 className="font-semibold text-yellow-900 mb-2">JSON Parsing Failed - Raw Response:</h4>
                          <pre className="text-xs text-yellow-800 whitespace-pre-wrap overflow-auto max-h-64 bg-white p-3 rounded border">
                            {result.llmResponse.content}
                          </pre>
                          <p className="text-sm text-yellow-800 mt-2">
                            LLM returned response but JSON extraction failed. Check the raw content above.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {testResults.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(testResults.reduce((acc, r) => acc + r.processingTime, 0) / testResults.length)}ms
              </div>
              <div className="text-sm text-muted-foreground">Average Processing Time</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}