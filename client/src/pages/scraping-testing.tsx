
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, Loader2, AlertCircle, Globe, Code, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

interface ScrapingResult {
  domain: string;
  method: 'axios_cheerio' | 'puppeteer';
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
  extractionMethod?: string;
  technicalDetails?: string;
}

export default function ScrapingTestingPage() {
  const [domain, setDomain] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [axiosResult, setAxiosResult] = useState<ScrapingResult | null>(null);
  const [puppeteerResult, setPuppeteerResult] = useState<ScrapingResult | null>(null);
  const [activeTest, setActiveTest] = useState<string | null>(null);

  const runScrapingTest = async (method: 'axios_cheerio' | 'puppeteer') => {
    if (!domain.trim()) return;

    setIsProcessing(true);
    setActiveTest(method);

    try {
      const response = await fetch('/api/smoke-test/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: domain.trim(),
          method: method
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (method === 'axios_cheerio') {
        setAxiosResult(result);
      } else {
        setPuppeteerResult(result);
      }

    } catch (error) {
      console.error(`${method} test failed:`, error);
      const errorResult: ScrapingResult = {
        domain: domain.trim(),
        method,
        companyName: null,
        confidence: 0,
        processingTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };

      if (method === 'axios_cheerio') {
        setAxiosResult(errorResult);
      } else {
        setPuppeteerResult(errorResult);
      }
    } finally {
      setIsProcessing(false);
      setActiveTest(null);
    }
  };

  const runBothTests = async () => {
    if (!domain.trim()) return;
    
    setAxiosResult(null);
    setPuppeteerResult(null);
    
    await runScrapingTest('axios_cheerio');
    await runScrapingTest('puppeteer');
  };

  const ResultCard = ({ result, methodName, icon }: { 
    result: ScrapingResult | null, 
    methodName: string,
    icon: React.ReactNode 
  }) => (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <CardTitle className="text-lg">{methodName}</CardTitle>
          </div>
          {result && (
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <><CheckCircle className="w-3 h-3 mr-1" />Success</>
              ) : (
                <><XCircle className="w-3 h-3 mr-1" />Failed</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {result ? (
          result.success ? (
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Company:</span>
                <p className="text-sm">{result.companyName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Confidence:</span>
                <p className="text-sm">{result.confidence}%</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Time:</span>
                <p className="text-sm">{result.processingTime}ms</p>
              </div>
              {result.extractionMethod && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Method:</span>
                  <p className="text-sm">{result.extractionMethod}</p>
                </div>
              )}
              {result.technicalDetails && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Details:</span>
                  <p className="text-xs text-muted-foreground">{result.technicalDetails}</p>
                </div>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {result.error}
              </AlertDescription>
            </Alert>
          )
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            No test results yet
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg p-2">
                  <Code className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Web Scraping Testing</h1>
                  <p className="text-sm text-gray-600">Test different scraping methods independently</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center">
            <Code className="w-8 h-8 mr-3 text-blue-500" />
            Web Scraping Testing
          </h1>
          <p className="text-muted-foreground">
            Test different web scraping methods independently
          </p>
        </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scraping Method Testing</CardTitle>
          <CardDescription>
            Compare Axios/Cheerio and Puppeteer extraction methods
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Domain:</label>
            <Input
              placeholder="Enter domain (e.g., apple.com, microsoft.com)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isProcessing && runBothTests()}
            />
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={() => runScrapingTest('axios_cheerio')}
              disabled={!domain.trim() || (isProcessing && activeTest === 'axios_cheerio')}
              variant="outline"
              className="flex-1"
            >
              {isProcessing && activeTest === 'axios_cheerio' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Test Axios/Cheerio
                </>
              )}
            </Button>

            <Button 
              onClick={() => runScrapingTest('puppeteer')}
              disabled={!domain.trim() || (isProcessing && activeTest === 'puppeteer')}
              variant="outline"
              className="flex-1"
            >
              {isProcessing && activeTest === 'puppeteer' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Code className="w-4 h-4 mr-2" />
                  Test Puppeteer
                </>
              )}
            </Button>

            <Button 
              onClick={runBothTests}
              disabled={!domain.trim() || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Both...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Test Both Methods
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {(axiosResult || puppeteerResult) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResultCard 
            result={axiosResult}
            methodName="Axios/Cheerio"
            icon={<Globe className="w-5 h-5 text-blue-500" />}
          />
          <ResultCard 
            result={puppeteerResult}
            methodName="Puppeteer"
            icon={<Code className="w-5 h-5 text-purple-500" />}
          />
        </div>
      )}

      {/* Comparison Analysis */}
      {axiosResult && puppeteerResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Comparison Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {axiosResult.success && puppeteerResult.success ? 'Both Succeeded' :
                   axiosResult.success ? 'Axios Won' :
                   puppeteerResult.success ? 'Puppeteer Won' : 'Both Failed'}
                </div>
                <div className="text-sm text-muted-foreground">Winner</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.abs((axiosResult.processingTime || 0) - (puppeteerResult.processingTime || 0))}ms
                </div>
                <div className="text-sm text-muted-foreground">Time Difference</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {axiosResult.success && puppeteerResult.success ?
                    Math.abs((axiosResult.confidence || 0) - (puppeteerResult.confidence || 0)) : 'N/A'}
                  {axiosResult.success && puppeteerResult.success ? '%' : ''}
                </div>
                <div className="text-sm text-muted-foreground">Confidence Difference</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </main>
    </div>
  );
}
