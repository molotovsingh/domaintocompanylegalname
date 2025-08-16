import { Link, useLocation } from 'wouter';
import { ArrowLeft, Database, Cpu, Shield, Loader2, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, Brain, Search, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function BetaTestingV2() {
  const [, setLocation] = useLocation();

  const [dumps, setDumps] = useState<any>({
    crawlee: [],
    scrapy: [],
    playwright: [],
    axiosCheerio: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [cleaningResults, setCleaningResults] = useState<any[]>([]);
  const [cleaningInProgress, setCleaningInProgress] = useState<Set<string>>(new Set());
  const [selectedCleaningModel, setSelectedCleaningModel] = useState('deepseek-chat');
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  const methods = [
    {
      id: 'playwright-dump',
      name: 'Playwright Dump',
      description: 'Browser automation for comprehensive data collection',
      path: '/playwright-dump-ui',
      status: 'available'
    },
    {
      id: 'scrapy-crawl',
      name: 'Scrapy Crawl',
      description: 'Multi-page discovery and legal entity extraction',
      path: '/scrapy-crawl-ui',
      status: 'available'
    },
    {
      id: 'crawlee-dump',
      name: 'Crawlee Dump',
      description: 'Advanced Node.js crawler with network capture and intelligent link discovery',
      path: '/crawlee-dump-ui',
      status: 'available'
    },
    {
      id: 'axios-cheerio',
      name: 'Axios + Cheerio',
      description: 'Lightning-fast extraction for static websites (100-500ms)',
      path: '/axios-cheerio-ui',
      status: 'available'
    },
    {
      id: 'gleif-search',
      name: 'GLEIF Search',
      description: 'Search Global Legal Entity Identifier database for verified company information',
      path: '/beta-v2/gleif-search',
      status: 'available'
    }
  ];

  const handleMethodSelect = (methodId: string) => {
    const method = methods.find(m => m.id === methodId);
    if (method && method.status === 'available') {
      // Use the full URL to bypass React router
      window.location.href = `${window.location.origin}${method.path}`;
    }
  };

  const fetchDumps = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/beta/dumps');
      if (response.ok) {
        const data = await response.json();
        // API returns { dumps: [...] } with playwright dumps only currently
        // For now, all dumps are playwright dumps
        const organized: any = {
          crawlee: [],
          scrapy: [],
          playwright: data.dumps || [],
          axiosCheerio: []
        };
        
        setDumps(organized);
      }
    } catch (error) {
      console.error('Error fetching dumps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCleaningResults = async () => {
    try {
      const response = await fetch('/api/beta/cleaning/results');
      if (response.ok) {
        const data = await response.json();
        setCleaningResults(data);
      }
    } catch (error) {
      console.error('Error fetching cleaning results:', error);
    }
  };

  const startCleaning = async (sourceType: string, sourceId: string) => {
    const key = `${sourceType}:${sourceId}`;
    setCleaningInProgress(prev => new Set([...prev, key]));

    try {
      console.log(`[Cleaning] Starting cleaning for ${sourceType} ID ${sourceId} with model ${selectedCleaningModel}`);

      const response = await fetch('/api/beta/cleaning/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceType,
          sourceId: parseInt(sourceId),
          model: selectedCleaningModel
        })
      });

      if (response.ok) {
        const result = await response.json();
        setCleaningResults((prev: any[]) => [...prev, { sourceType, sourceId, ...result }]);
        console.log(`[Cleaning] Cleaning successful for ${sourceType} ID ${sourceId}:`, result);
      } else {
        console.error(`[Cleaning] Cleaning failed for ${sourceType} ID ${sourceId}:`, response.statusText);
      }
    } catch (error) {
      console.error(`[Cleaning] Error during cleaning for ${sourceType} ID ${sourceId}:`, error);
    } finally {
      setCleaningInProgress(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/beta/cleaning/models');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAvailableModels(data.models);
        }
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
    }
  };

  const getModelIcon = (modelId: string) => {
    if (modelId.includes('deepseek')) return '🔥';
    if (modelId.includes('qwen')) return '🎯';
    if (modelId.includes('llama')) return '🦙';
    if (modelId.includes('mistral')) return '🌟';
    if (modelId.includes('gemma')) return '🔷';
    return '🤖';
  };

  const getModelDisplayName = (modelId: string) => {
    const names: { [key: string]: string } = {
      'deepseek-chat': 'DeepSeek Chat',
      'deepseek-v3': 'DeepSeek V3',
      'deepseek-r1': 'DeepSeek R1 Reasoning',
      'qwen-2.5': 'Qwen 2.5 72B',
      'qwen3-coder': 'Qwen3 Coder',
      'qwen3-14b': 'Qwen3 14B',
      'llama-3-8b': 'Llama 3 8B',
      'mistral-7b': 'Mistral 7B',
      'gemma-7b': 'Gemma 7B'
    };
    return names[modelId] || modelId.charAt(0).toUpperCase() + modelId.slice(1);
  };


  useEffect(() => {
    fetchDumps();
    fetchCleaningResults();
    fetchAvailableModels();
  }, []);


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-semibold mb-2">Beta Testing Platform v2</h1>
          <p className="text-muted-foreground mb-6">
            Federated architecture - each method runs as an independent service
          </p>

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Select a Collection Method</h2>
            <div className="grid gap-4">
              {methods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  disabled={method.status === 'coming-soon'}
                  className={`
                    p-4 rounded-lg border text-left transition-all
                    ${method.status === 'available'
                      ? 'hover:border-primary hover:shadow-md cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {method.id === 'gleif-search' && (
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Shield className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium">{method.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {method.description}
                        </p>
                      </div>
                    </div>
                    <div>
                      {method.status === 'available' ? (
                        <span className="text-sm text-green-600 font-medium">Available</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Coming Soon</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Data Processing Section */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-medium">Data Processing</h2>

            {/* Data Processing Stage 1 */}
            <div
              onClick={() => setLocation('/beta-data-processing')}
              className="p-4 rounded-lg border hover:border-primary hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Data Processing Stage 1</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Apply LLM models to extract entities from raw dumps
                    </p>
                  </div>
                </div>
                <span className="text-sm text-green-600 font-medium">Available</span>
              </div>
            </div>

            {/* Data Processing Stage 2 */}
            <div
              onClick={() => setLocation('/beta-v2/data-processing')}
              className="p-4 rounded-lg border hover:border-primary hover:shadow-md cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Data Processing Stage 2</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Process collected dumps through the three-stage pipeline: Collection → Entity Extraction → GLEIF Verification
                    </p>
                  </div>
                </div>
                <span className="text-sm text-green-600 font-medium">Available</span>
              </div>
            </div>
          </div>

          {/* LLM Cleaning Section */}
          <div className="mt-8 space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">🧹 LLM Cleaning</h3>
              <p className="text-sm text-gray-600 mb-4">
                Clean raw HTML data using Large Language Models to extract structured business information.
              </p>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ℹ️ Looking for model selection? Go to the{' '}
                  <Link href="/beta-v2/data-processing" className="font-medium underline hover:text-blue-900">
                    Data Processing Stage 2
                  </Link>{' '}
                  page where all AI model configuration is centralized.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dumps.playwright && dumps.playwright.slice(0, 6).map((dump: any) => (
                  <div key={`playwright-${dump.id}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium truncate">{dump.domain}</h4>
                        <p className="text-xs text-gray-500">
                          ID: {dump.id} • {new Date(dump.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => startCleaning('playwright_dump', dump.id)}
                        disabled={cleaningInProgress.has(`playwright_dump:${dump.id}`)}
                      >
                        {cleaningInProgress.has(`playwright_dump:${dump.id}`) ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Cleaning...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3 mr-1" />
                            Clean with LLM
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-secondary/20 rounded-lg">
            <h3 className="font-medium mb-2">Architecture Notes</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Each method runs as a completely independent service</li>
              <li>• No shared state or dependencies between methods</li>
              <li>• Direct access to method-specific UI and APIs</li>
              <li>• Complete database isolation per method</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}