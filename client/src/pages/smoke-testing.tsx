` tags:

Removing Playwright references from smoke testing page

```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, Zap, Globe, Shield } from 'lucide-react';

interface SmokeTestResult {
  domain: string;
  method: 'axios_cheerio' | 'puppeteer' | 'playwright';
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
  extractionMethod?: string;
  connectivity?: string;
  failureCategory?: string;
  recommendation?: string;
  technicalDetails?: string;
}

interface ComparisonResult {
  domain: string;
  axiosResult: SmokeTestResult | null;
  puppeteerResult: SmokeTestResult | null;
  playwrightResult: SmokeTestResult | null;
  winner: string;
  analysis: string;
}

export default function SmokeTesting() {
  const [singleDomain, setSingleDomain] = useState('');
  const [batchDomains, setBatchDomains] = useState('');
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [singleResults, setSingleResults] = useState<SmokeTestResult[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Predefined test suites
  const testSuites = {
    'Fortune 500': [
      'apple.com', 'microsoft.com', 'amazon.com', 'google.com', 'meta.com',
      'tesla.com', 'nvidia.com', 'oracle.com', 'salesforce.com'
    ],
    'Protected Sites': [
      'cloudflare.com', 'github.com', 'stackoverflow.com', 'medium.com',
      'linkedin.com', 'twitter.com', 'reddit.com'
    ],
    'International': [
      'db.com', 'siemens.com', 'nestle.com', 'samsung.com', 'toyota.com',
      'asml.com', 'lvmh.com', 'tencent.com'
    ],
    'Tech/SaaS': [
      'stripe.com', 'shopify.com', 'zoom.us', 'slack.com', 'dropbox.com',
      'atlassian.com', 'hubspot.com', 'mailchimp.com'
    ],
    'Problematic Cases': [
      'rewe.de', 'springer.com', 'morphosys.com', 'teamviewer.com',
      'zalando.com', 'delivery-hero.com'
    ]
  };

  const runSingleDomainTest = async (domain: string, method: SmokeTestResult['method']) => {
    setCurrentTest(`${method}-${domain}`);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/smoke-test/single', {
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
        ...result
      } as SmokeTestResult;
    } catch (error) {
      return {
        domain,
        method,
        processingTime: Date.now() - Date.now(),
        companyName: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as SmokeTestResult;
    } finally {
      setCurrentTest(null);
    }
  };

  const runSingleTest = async () => {
    if (!singleDomain.trim()) return;

    setIsRunning(true);
    setProgress(0);

    const results: SmokeTestResult[] = [];
    const methods: SmokeTestResult['method'][] = ['axios_cheerio', 'puppeteer'];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      setProgress((i / methods.length) * 100);

      const result = await runSingleDomainTest(singleDomain.trim(), method);
      results.push(result);
    }

    setSingleResults(results);
    setProgress(100);
    setIsRunning(false);
  };

  const runComparisonTest = async (domains: string[]) => {
    setIsRunning(true);
    setProgress(0);
    setComparisonResults([]);

    const results: ComparisonResult[] = [];

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      setProgress((i / domains.length) * 100);

      // Run all methods for this domain
      const axiosResult = await runSingleDomainTest(domain, 'axios_cheerio');
      const puppeteerResult = await runSingleDomainTest(domain, 'puppeteer');
      const playwrightResult = null; //await runSingleDomainTest(domain, 'playwright');

      // Determine winner and analysis
      const winner = determineWinner(axiosResult, puppeteerResult);
      const analysis = generateAnalysis(axiosResult, puppeteerResult);

      const comparisonResult: ComparisonResult = {
        domain,
        axiosResult,
        puppeteerResult,
        playwrightResult: null,
        winner,
        analysis
      };

      results.push(comparisonResult);
      setComparisonResults([...results]); // Update UI incrementally
    }

    setProgress(100);
    setIsRunning(false);
  };

  const determineWinner = (axios: SmokeTestResult | null, puppeteer: SmokeTestResult | null): string => {
    const results = [
      { name: 'Axios/Cheerio', result: axios },
      { name: 'Puppeteer', result: puppeteer }
    ].filter(r => r.result?.success);

    if (results.length === 0) return 'None';

    // Winner is the one with highest confidence
    const winner = results.reduce((prev, current) => 
      (current.result!.confidence > prev.result!.confidence) ? current : prev
    );

    return winner.name;
  };

  const generateAnalysis = (axios: SmokeTestResult | null, puppeteer: SmokeTestResult | null): string => {
    const successful = [axios, puppeteer].filter(r => r?.success).length;
    const total = 2;

    if (successful === 0) return 'All methods failed to extract company information';
    if (successful === total) return `All ${successful} methods successfully extracted company information`;
    return `${successful} out of ${total} methods succeeded`;
  };

  const runTestSuite = (suiteName: string) => {
    const domains = testSuites[suiteName as keyof typeof testSuites];
    setBatchDomains(domains.join('\n'));
    runComparisonTest(domains);
  };

  const runCustomBatch = () => {
    const domains = batchDomains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    if (domains.length === 0) return;
    runComparisonTest(domains);
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'axios_cheerio': return 'bg-blue-500';
      case 'puppeteer': return 'bg-purple-500';
      case 'playwright': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getWinnerBadgeColor = (winner: string) => {
    switch (winner) {
      case 'Axios/Cheerio': return 'bg-blue-500';
      case 'Puppeteer': return 'bg-purple-500';
      case 'Playwright': return 'bg-green-500';
      case 'Tie': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scraping Library Smoke Testing</h1>
          <p className="text-muted-foreground mt-2">
            Compare extraction performance across different scraping libraries
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Zap className="w-4 h-4 mr-1" />
          Performance Testing
        </Badge>
      </div>

      {isRunning && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Running tests... {currentTest && `Testing ${currentTest}`}
            <Progress value={progress} className="mt-2" />
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="single">Single Domain Test</TabsTrigger>
          <TabsTrigger value="comparison">Batch Comparison</TabsTrigger>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single Domain Testing</CardTitle>
              <CardDescription>
                Test a single domain across multiple scraping methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter domain (e.g., apple.com)"
                  value={singleDomain}
                  onChange={(e) => setSingleDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && runSingleTest()}
                />
                <Button onClick={runSingleTest} disabled={isRunning || !singleDomain.trim()}>
                  Test Domain
                </Button>
              </div>

              {singleResults.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {singleResults.map((result, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge className={getMethodBadgeColor(result.method)}>
                            {result.method.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div><strong>Company:</strong> {result.companyName || 'Not found'}</div>
                          <div><strong>Confidence:</strong> {result.confidence}%</div>
                          <div><strong>Time:</strong> {result.processingTime}ms</div>
                          <div><strong>Method:</strong> {result.extractionMethod || 'N/A'}</div>
                          {result.error && (
                            <div className="text-red-600"><strong>Error:</strong> {result.error}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Comparison Testing</CardTitle>
              <CardDescription>
                Compare multiple domains across all scraping methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Domains (one per line):</label>
                <textarea
                  className="w-full mt-1 p-3 border rounded-md resize-none"
                  rows={6}
                  placeholder="apple.com&#10;microsoft.com&#10;google.com"
                  value={batchDomains}
                  onChange={(e) => setBatchDomains(e.target.value)}
                />
              </div>
              <Button onClick={runCustomBatch} disabled={isRunning || !batchDomains.trim()}>
                Run Comparison Test
              </Button>

              {comparisonResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comparison Results</h3>
                  {comparisonResults.map((result, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{result.domain}</CardTitle>
                          <Badge className={getWinnerBadgeColor(result.winner)}>
                            Winner: {result.winner}
                          </Badge>
                        </div>
                        <CardDescription>{result.analysis}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.axiosResult && (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-blue-500">Axios/Cheerio</Badge>
                                {result.axiosResult.success ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <div>Company: {result.axiosResult.companyName || 'Not found'}</div>
                                <div>Confidence: {result.axiosResult.confidence}%</div>
                                <div>Time: {result.axiosResult.processingTime}ms</div>
                                {result.axiosResult.extractionMethod && (
                                  <div>Method: {result.axiosResult.extractionMethod}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {result.puppeteerResult && (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-purple-500">Puppeteer</Badge>
                                {result.puppeteerResult.success ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <div>Company: {result.puppeteerResult.companyName || 'Not found'}</div>
                                <div>Confidence: {result.puppeteerResult.confidence}%</div>
                                <div>Time: {result.puppeteerResult.processingTime}ms</div>
                                {result.puppeteerResult.extractionMethod && (
                                  <div>Method: {result.puppeteerResult.extractionMethod}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suites" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(testSuites).map(([name, domains]) => (
              <Card key={name} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    {name === 'Protected Sites' && <Shield className="w-5 h-5 mr-2" />}
                    {name === 'International' && <Globe className="w-5 h-5 mr-2" />}
                    {name}
                  </CardTitle>
                  <CardDescription>
                    {domains.length} domains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {domains.slice(0, 3).join(', ')}
                      {domains.length > 3 && ` +${domains.length - 3} more`}
                    </div>
                    <Button 
                      onClick={() => runTestSuite(name)} 
                      disabled={isRunning}
                      className="w-full"
                    >
                      Run Test Suite
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```Updated helper functions to remove Playwright logic.
```typescript
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Clock, Zap, Globe, Shield } from 'lucide-react';

interface SmokeTestResult {
  domain: string;
  method: 'axios_cheerio' | 'puppeteer';
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
  extractionMethod?: string;
  connectivity?: string;
  failureCategory?: string;
  recommendation?: string;
  technicalDetails?: string;
}

interface ComparisonResult {
  domain: string;
  axiosResult: SmokeTestResult | null;
  puppeteerResult: SmokeTestResult | null;
  winner: string;
  analysis: string;
}

export default function SmokeTesting() {
  const [singleDomain, setSingleDomain] = useState('');
  const [batchDomains, setBatchDomains] = useState('');
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [singleResults, setSingleResults] = useState<SmokeTestResult[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Predefined test suites
  const testSuites = {
    'Fortune 500': [
      'apple.com', 'microsoft.com', 'amazon.com', 'google.com', 'meta.com',
      'tesla.com', 'nvidia.com', 'oracle.com', 'salesforce.com'
    ],
    'Protected Sites': [
      'cloudflare.com', 'github.com', 'stackoverflow.com', 'medium.com',
      'linkedin.com', 'twitter.com', 'reddit.com'
    ],
    'International': [
      'db.com', 'siemens.com', 'nestle.com', 'samsung.com', 'toyota.com',
      'asml.com', 'lvmh.com', 'tencent.com'
    ],
    'Tech/SaaS': [
      'stripe.com', 'shopify.com', 'zoom.us', 'slack.com', 'dropbox.com',
      'atlassian.com', 'hubspot.com', 'mailchimp.com'
    ],
    'Problematic Cases': [
      'rewe.de', 'springer.com', 'morphosys.com', 'teamviewer.com',
      'zalando.com', 'delivery-hero.com'
    ]
  };

  const runSingleDomainTest = async (domain: string, method: SmokeTestResult['method']) => {
    setCurrentTest(`${method}-${domain}`);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/smoke-test/single', {
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
        ...result
      } as SmokeTestResult;
    } catch (error) {
      return {
        domain,
        method,
        processingTime: Date.now() - Date.now(),
        companyName: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as SmokeTestResult;
    } finally {
      setCurrentTest(null);
    }
  };

  const runSingleTest = async () => {
    if (!singleDomain.trim()) return;

    setIsRunning(true);
    setProgress(0);

    const results: SmokeTestResult[] = [];
    const methods: SmokeTestResult['method'][] = ['axios_cheerio', 'puppeteer'];

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      setProgress((i / methods.length) * 100);

      const result = await runSingleDomainTest(singleDomain.trim(), method);
      results.push(result);
    }

    setSingleResults(results);
    setProgress(100);
    setIsRunning(false);
  };

  const runComparisonTest = async (domains: string[]) => {
    setIsRunning(true);
    setProgress(0);
    setComparisonResults([]);

    const results: ComparisonResult[] = [];

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      setProgress((i / domains.length) * 100);

      // Run all methods for this domain
      const axiosResult = await runSingleDomainTest(domain, 'axios_cheerio');
      const puppeteerResult = await runSingleDomainTest(domain, 'puppeteer');

      // Determine winner and analysis
      const winner = determineWinner(axiosResult, puppeteerResult);
      const analysis = generateAnalysis(axiosResult, puppeteerResult);

      const comparisonResult: ComparisonResult = {
        domain,
        axiosResult,
        puppeteerResult,
        winner,
        analysis
      };

      results.push(comparisonResult);
      setComparisonResults([...results]); // Update UI incrementally
    }

    setProgress(100);
    setIsRunning(false);
  };

  const determineWinner = (axios: SmokeTestResult | null, puppeteer: SmokeTestResult | null): string => {
    const results = [
      { name: 'Axios/Cheerio', result: axios },
      { name: 'Puppeteer', result: puppeteer }
    ].filter(r => r.result?.success);

    if (results.length === 0) return 'None';

    // Winner is the one with highest confidence
    const winner = results.reduce((prev, current) => 
      (current.result!.confidence > prev.result!.confidence) ? current : prev
    );

    return winner.name;
  };

  const generateAnalysis = (axios: SmokeTestResult | null, puppeteer: SmokeTestResult | null): string => {
    const successful = [axios, puppeteer].filter(r => r?.success).length;
    const total = 2;

    if (successful === 0) return 'All methods failed to extract company information';
    if (successful === total) return `All ${successful} methods successfully extracted company information`;
    return `${successful} out of ${total} methods succeeded`;
  };

  const runTestSuite = (suiteName: string) => {
    const domains = testSuites[suiteName as keyof typeof testSuites];
    setBatchDomains(domains.join('\n'));
    runComparisonTest(domains);
  };

  const runCustomBatch = () => {
    const domains = batchDomains.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    if (domains.length === 0) return;
    runComparisonTest(domains);
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'axios_cheerio': return 'bg-blue-500';
      case 'puppeteer': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getWinnerBadgeColor = (winner: string) => {
    switch (winner) {
      case 'Axios/Cheerio': return 'bg-blue-500';
      case 'Puppeteer': return 'bg-purple-500';
      case 'Tie': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scraping Library Smoke Testing</h1>
          <p className="text-muted-foreground mt-2">
            Compare extraction performance across different scraping libraries
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Zap className="w-4 h-4 mr-1" />
          Performance Testing
        </Badge>
      </div>

      {isRunning && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Running tests... {currentTest && `Testing ${currentTest}`}
            <Progress value={progress} className="mt-2" />
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="single">Single Domain Test</TabsTrigger>
          <TabsTrigger value="comparison">Batch Comparison</TabsTrigger>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Single Domain Testing</CardTitle>
              <CardDescription>
                Test a single domain across multiple scraping methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter domain (e.g., apple.com)"
                  value={singleDomain}
                  onChange={(e) => setSingleDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && runSingleTest()}
                />
                <Button onClick={runSingleTest} disabled={isRunning || !singleDomain.trim()}>
                  Test Domain
                </Button>
              </div>

              {singleResults.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                  {singleResults.map((result, index) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge className={getMethodBadgeColor(result.method)}>
                            {result.method.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div><strong>Company:</strong> {result.companyName || 'Not found'}</div>
                          <div><strong>Confidence:</strong> {result.confidence}%</div>
                          <div><strong>Time:</strong> {result.processingTime}ms</div>
                          <div><strong>Method:</strong> {result.extractionMethod || 'N/A'}</div>
                          {result.error && (
                            <div className="text-red-600"><strong>Error:</strong> {result.error}</div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Comparison Testing</CardTitle>
              <CardDescription>
                Compare multiple domains across all scraping methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Domains (one per line):</label>
                <textarea
                  className="w-full mt-1 p-3 border rounded-md resize-none"
                  rows={6}
                  placeholder="apple.com&#10;microsoft.com&#10;google.com"
                  value={batchDomains}
                  onChange={(e) => setBatchDomains(e.target.value)}
                />
              </div>
              <Button onClick={runCustomBatch} disabled={isRunning || !batchDomains.trim()}>
                Run Comparison Test
              </Button>

              {comparisonResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comparison Results</h3>
                  {comparisonResults.map((result, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{result.domain}</CardTitle>
                          <Badge className={getWinnerBadgeColor(result.winner)}>
                            Winner: {result.winner}
                          </Badge>
                        </div>
                        <CardDescription>{result.analysis}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.axiosResult && (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-blue-500">Axios/Cheerio</Badge>
                                {result.axiosResult.success ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <div>Company: {result.axiosResult.companyName || 'Not found'}</div>
                                <div>Confidence: {result.axiosResult.confidence}%</div>
                                <div>Time: {result.axiosResult.processingTime}ms</div>
                                {result.axiosResult.extractionMethod && (
                                  <div>Method: {result.axiosResult.extractionMethod}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {result.puppeteerResult && (
                            <div className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="bg-purple-500">Puppeteer</Badge>
                                {result.puppeteerResult.success ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <div>Company: {result.puppeteerResult.companyName || 'Not found'}</div>
                                <div>Confidence: {result.puppeteerResult.confidence}%</div>
                                <div>Time: {result.puppeteerResult.processingTime}ms</div>
                                {result.puppeteerResult.extractionMethod && (
                                  <div>Method: {result.puppeteerResult.extractionMethod}</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suites" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(testSuites).map(([name, domains]) => (
              <Card key={name} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    {name === 'Protected Sites' && <Shield className="w-5 h-5 mr-2" />}
                    {name === 'International' && <Globe className="w-5 h-5 mr-2" />}
                    {name}
                  </CardTitle>
                  <CardDescription>
                    {domains.length} domains
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      {domains.slice(0, 3).join(', ')}
                      {domains.length > 3 && ` +${domains.length - 3} more`}
                    </div>
                    <Button 
                      onClick={() => runTestSuite(name)} 
                      disabled={isRunning}
                      className="w-full"
                    >
                      Run Test Suite
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}