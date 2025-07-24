import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

export default function BetaTestingV2() {
  const [domain, setDomain] = useState('');
  const [method, setMethod] = useState('playwright-dump');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const { toast } = useToast();

  // Fetch recent dumps
  const { data: recentDumps, refetch } = useQuery({
    queryKey: ['/api/beta-v2/dumps'],
    queryFn: async () => {
      const response = await fetch('/api/beta-v2/dumps?limit=5');
      if (!response.ok) throw new Error('Failed to fetch dumps');
      return response.json();
    },
    refetchInterval: 5000
  });

  const handleDump = async () => {
    if (!domain.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a domain',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setCurrentStatus('Starting dump...');

    try {
      const response = await apiRequest('POST', '/api/beta-v2/dump', { 
        domain: domain.trim(), 
        method 
      });
      
      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Dump completed in ${data.processingTime}ms`
        });
        setCurrentStatus('');
        setDomain('');
        refetch();
      } else {
        toast({
          title: 'Failed',
          description: data.error || 'Dump failed',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start dump',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setCurrentStatus('');
    }
  };

  const getProgressIndicators = () => {
    if (!isProcessing) return null;
    
    return (
      <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
        <span>Progress:</span>
        <span className="flex items-center gap-1">
          HTML <CheckCircle className="h-3 w-3 text-green-500" />
        </span>
        <span className="flex items-center gap-1">
          Screenshots <Loader2 className="h-3 w-3 animate-spin" />
        </span>
        <span className="flex items-center gap-1">
          Network ○
        </span>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Beta Platform v2 - Data Collection</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Input Section */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isProcessing && handleDump()}
                disabled={isProcessing}
                className="flex-1"
              />
              <Select value={method} onValueChange={setMethod} disabled={isProcessing}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playwright-dump">Playwright Dump</SelectItem>
                  <SelectItem value="scrapy-crawl" disabled>Scrapy Crawl (Coming Soon)</SelectItem>
                  <SelectItem value="crawlee-extract" disabled>Crawlee Extract (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleDump} 
                disabled={isProcessing || !domain.trim()}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dumping...
                  </>
                ) : (
                  'Start Dump'
                )}
              </Button>
            </div>

            {/* Status */}
            {currentStatus && (
              <div className="text-sm text-muted-foreground">
                Status: {currentStatus}
              </div>
            )}

            {/* Progress Indicators */}
            {getProgressIndicators()}
          </div>

          {/* Recent Dumps */}
          {recentDumps?.dumps && recentDumps.dumps.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium mb-3">Recent Dumps</h3>
              <div className="space-y-2">
                {recentDumps.dumps.map((dump: any) => (
                  <div 
                    key={dump.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {dump.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-mono text-sm">{dump.domain}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{dump.processingTime}ms</span>
                      <span>{new Date(dump.createdAt).toLocaleTimeString()}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/beta-v2/dumps/${dump.id}`, '_blank')}
                      >
                        View Raw
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}