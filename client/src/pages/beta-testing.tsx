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
        companyName: result.companyName,
        confidence: result.confidence || 0,
        success: result.success,
        error: result.error,
        extractionMethod: result.extractionMethod,
        technicalDetails: result.technicalDetails
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
        technicalDetails: null
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testResults.map((result, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.method.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><strong>Company:</strong></div>
                      <div>{result.companyName || 'Not found'}</div>

                      <div><strong>Confidence:</strong></div>
                      <div>{result.confidence}%</div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <strong>Time:</strong>
                      </div>
                      <div>{result.processingTime}ms</div>

                      {result.extractionMethod && (
                        <>
                          <div><strong>Method:</strong></div>
                          <div className="text-xs">{result.extractionMethod}</div>
                        </>
                      )}
                    </div>

                    {result.error && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}

                    {result.technicalDetails && (
                      <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                        <strong>Technical:</strong> {result.technicalDetails}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {testResults.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {testResults.filter(r => r.success).length}
                </div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(testResults.reduce((acc, r) => acc + r.processingTime, 0) / testResults.length)}ms
                </div>
                <div className="text-sm text-muted-foreground">Avg Time</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(testResults.reduce((acc, r) => acc + r.confidence, 0) / testResults.length)}%
                </div>
                <div className="text-sm text-muted-foreground">Avg Confidence</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}