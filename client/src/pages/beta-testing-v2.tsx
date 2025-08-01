import { Link, useLocation } from 'wouter';
import { ArrowLeft, Database, Cpu, Shield } from 'lucide-react';

export default function BetaTestingV2() {
  const [, setLocation] = useLocation();
  
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
                    <h3 className="font-medium">Process Collected Data</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Apply LLM models to extract entities from raw dumps
                    </p>
                  </div>
                </div>
                <span className="text-sm text-green-600 font-medium">Available</span>
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