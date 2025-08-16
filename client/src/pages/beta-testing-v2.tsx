import { Link, useLocation } from 'wouter';
import { ArrowLeft, Database, Cpu, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function BetaTestingV2() {
  const [, setLocation] = useLocation();

  const [dumps, setDumps] = useState<any>({
    crawlee: [],
    scrapy: [],
    playwright: [],
    axiosCheerio: []
  });
  const [isLoading, setIsLoading] = useState(true);

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




  useEffect(() => {
    fetchDumps();
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
            <h2 className="text-lg font-medium">🕷️ Step 1: Collect Data</h2>
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
            <h2 className="text-lg font-medium">⚙️ Step 2: Process Data</h2>
            <p className="text-sm text-muted-foreground">
              Choose your processing pipeline. We recommend the Production Pipeline for best results.
            </p>

            {/* Legacy Processing */}
            <div
              onClick={() => setLocation('/beta-data-processing')}
              className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-all opacity-75"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Legacy Processing (V1)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Original entity extraction system - Basic LLM-only approach
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Legacy</Badge>
              </div>
            </div>

            {/* Production Pipeline */}
            <div
              onClick={() => setLocation('/beta-v2/data-processing')}
              className="p-4 rounded-lg border-2 border-primary hover:shadow-lg cursor-pointer transition-all bg-primary/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary text-white">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-primary">Production Pipeline ⭐</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Advanced 4-stage system: Fast extraction → LLM enhancement → GLEIF verification → Perplexity arbitration
                    </p>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">Recommended</Badge>
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