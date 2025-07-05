
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Beaker, 
  TestTube, 
  Zap, 
  Shield, 
  Database, 
  Cpu, 
  BarChart3,
  ExternalLink,
  RefreshCw,
  Activity,
  AlertTriangle,
  Play,
  CheckCircle,
  Target,
  Trophy,
  Gauge,
  GitCompare
} from 'lucide-react';

interface BetaExperiment {
  id: number;
  name: string;
  description: string;
  status: 'alpha' | 'beta' | 'ready_for_production' | 'archived';
  usageCount: number;
  successRate: number;
  averageResponseTime: number;
}

interface BetaSmokeTestResult {
  domain: string;
  method: string;
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
}

export default function BetaTesting() {
  const [experiments, setExperiments] = useState<BetaExperiment[]>([]);
  const [smokeTestDomain, setSmokeTestDomain] = useState('');
  const [smokeTestResults, setSmokeTestResults] = useState<BetaSmokeTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [serverStatus, setServerStatus] = useState<'stopped' | 'starting' | 'ready' | 'error'>('stopped');
  const [startupProgress, setStartupProgress] = useState(0);

  // Load experiments on mount
  useEffect(() => {
    checkServerAndLoad();
  }, []);

  // Poll server status when starting
  useEffect(() => {
    if (serverStatus === 'starting') {
      const interval = setInterval(() => {
        checkServerStatus();
        setStartupProgress(prev => Math.min(prev + 10, 90));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [serverStatus]);

  const checkServerStatus = async () => {
    try {
      const response = await fetch('/api/beta/status');
      const data = await response.json();
      setServerStatus(data.status);
      if (data.status === 'ready') {
        setStartupProgress(100);
      }
    } catch (error) {
      console.error('Failed to check server status:', error);
    }
  };

  const checkServerAndLoad = async () => {
    await checkServerStatus();
    await loadExperiments();
    await loadSmokeTestResults();
  };

  const loadExperiments = async () => {
    try {
      const response = await fetch('/api/beta/experiments');
      const data = await response.json();
      
      if (response.status === 503 && data.status === 'starting') {
        setServerStatus('starting');
        setStartupProgress(10);
        return;
      }
      
      if (data.success) {
        setExperiments(data.experiments);
        setServerStatus('ready');
      }
    } catch (error) {
      console.error('Failed to load beta experiments:', error);
      setServerStatus('error');
    }
  };

  const loadSmokeTestResults = async () => {
    try {
      const response = await fetch('/api/beta/smoke-test/results');
      const data = await response.json();
      
      if (response.status === 503 && data.status === 'starting') {
        setServerStatus('starting');
        return;
      }
      
      if (data.success) {
        setSmokeTestResults(data.results);
      }
    } catch (error) {
      console.error('Failed to load smoke test results:', error);
    }
  };

  const runBetaSmokeTest = async (domain: string, method: string) => {
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
        ...result
      };
    } catch (error) {
      return {
        domain,
        method,
        processingTime: Date.now() - Date.now(),
        companyName: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const runSingleBetaTest = async () => {
    if (!smokeTestDomain.trim()) return;
    
    setIsRunning(true);
    setProgress(0);
    
    const results = [];
    const methods = ['axios_cheerio', 'puppeteer', 'playwright'];
    
    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      setProgress((i / methods.length) * 100);
      
      const result = await runBetaSmokeTest(smokeTestDomain.trim(), method);
      results.push(result);
    }
    
    setSmokeTestResults(results);
    setProgress(100);
    setIsRunning(false);
    setSmokeTestDomain('');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'alpha': return 'bg-red-500';
      case 'beta': return 'bg-yellow-500';
      case 'ready_for_production': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  // Show loading screen when beta server is starting
  if (serverStatus === 'starting' || (serverStatus === 'stopped' && experiments.length === 0)) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Beaker className="w-6 h-6 text-blue-500 animate-pulse" />
                Starting Beta Environment
              </CardTitle>
              <CardDescription>
                Initializing isolated testing environment on port 3001...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={startupProgress} className="w-full" />
              <div className="text-center text-sm text-muted-foreground">
                {startupProgress < 30 && "Creating isolated database connection..."}
                {startupProgress >= 30 && startupProgress < 60 && "Starting beta server process..."}
                {startupProgress >= 60 && startupProgress < 90 && "Loading experimental features..."}
                {startupProgress >= 90 && "Almost ready..."}
              </div>
              <Alert className="bg-blue-50 border-blue-200">
                <Shield className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700">
                  The beta environment runs in complete isolation from production data
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error screen if server failed to start
  if (serverStatus === 'error') {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md border-red-200">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-red-600">
                <AlertTriangle className="w-6 h-6" />
                Beta Server Error
              </CardTitle>
              <CardDescription>
                Failed to start the beta testing environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={checkServerAndLoad} 
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Beaker className="w-8 h-8 mr-3 text-blue-500" />
            Beta Testing Platform
          </h1>
          <p className="text-muted-foreground mt-2">
            Experimental features sandbox - completely isolated from production
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
            Server Ready
          </Badge>
        </div>
      </div>

      <Alert>
        <TestTube className="h-4 w-4" />
        <AlertDescription>
          <strong>Beta Environment:</strong> All experiments run in complete isolation from production data. 
          Safe to test destructive operations and experimental features.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="experiments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="experiments">Active Experiments</TabsTrigger>
          <TabsTrigger value="smoke-testing">Smoke Testing</TabsTrigger>
          <TabsTrigger value="performance">Performance Lab</TabsTrigger>
        </TabsList>

        <TabsContent value="experiments" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Smoke Testing Experiment */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Smoke Testing v2</CardTitle>
                  <Badge className="bg-yellow-500">Beta</Badge>
                </div>
                <CardDescription>
                  Enhanced smoke testing with new extraction methods
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response:</span>
                    <span className="font-medium">1.2s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tests Run:</span>
                    <span className="font-medium">245</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Monitoring */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Performance Monitor</CardTitle>
                  <Badge className="bg-red-500">Alpha</Badge>
                </div>
                <CardDescription>
                  Real-time scraping performance analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Memory Usage:</span>
                    <span className="font-medium">342 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CPU Usage:</span>
                    <span className="font-medium">23%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Queue Size:</span>
                    <span className="font-medium">12</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New Scraper Library */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Scraper v3</CardTitle>
                  <Badge className="bg-red-500">Alpha</Badge>
                </div>
                <CardDescription>
                  Next-generation scraping with AI assistance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>AI Accuracy:</span>
                    <span className="font-medium">94%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Protected Sites:</span>
                    <span className="font-medium">78%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Speed Gain:</span>
                    <span className="font-medium">+45%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="smoke-testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Beta Smoke Testing</CardTitle>
              <CardDescription>
                Test domains using experimental extraction methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter domain (e.g., example.com)"
                  value={smokeTestDomain}
                  onChange={(e) => setSmokeTestDomain(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && runSingleBetaTest()}
                />
                <Button 
                  onClick={runSingleBetaTest} 
                  disabled={isRunning || !smokeTestDomain.trim()}
                >
                  {isRunning ? 'Testing...' : 'Run Beta Test'}
                </Button>
              </div>

              {isRunning && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Testing across all methods...
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}

              {smokeTestResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">Beta Test Results</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {smokeTestResults.map((result, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={result.success ? "default" : "destructive"}>
                            {result.method?.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant={result.success ? "default" : "destructive"}>
                            {result.success ? "Success" : "Failed"}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div><strong>Domain:</strong> {result.domain}</div>
                          <div><strong>Company:</strong> {result.companyName || 'Not found'}</div>
                          <div><strong>Confidence:</strong> {result.confidence}%</div>
                          <div><strong>Time:</strong> {result.processingTime}ms</div>
                          {result.error && (
                            <div className="text-red-600"><strong>Error:</strong> {result.error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {smokeTestResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Recent Beta Test Results</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {smokeTestResults.slice(0, 10).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          <Badge variant={result.success ? "default" : "destructive"}>
                            {result.success ? "Success" : "Failed"}
                          </Badge>
                          <span className="font-medium">{result.domain}</span>
                          {result.companyName && (
                            <span className="text-muted-foreground">→ {result.companyName}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <span>{result.confidence}%</span>
                          <span>{result.processingTime}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="w-5 h-5 mr-2" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Usage</span>
                      <span>23%</span>
                    </div>
                    <Progress value={23} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>67%</span>
                    </div>
                    <Progress value={67} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Database Load</span>
                      <span>12%</span>
                    </div>
                    <Progress value={12} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Experiment Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Active Experiments:</span>
                    <Badge>3</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Tests Run Today:</span>
                    <Badge>127</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <Badge className="bg-green-500">85%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Response Time:</span>
                    <Badge>1.4s</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
