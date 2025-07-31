import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface AvailableDump {
  type: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump';
  id: number;
  domain: string;
  pages?: number;
  size?: string;
  collectedAt: string;
  hasBeenCleaned: boolean;
  cleanedWith?: string[];
}

interface CleaningResult {
  extractedData: {
    companyName?: string;
    legalEntity?: string;
    addresses?: string[];
    phones?: string[];
    emails?: string[];
    currencies?: string[];
    countries?: string[];
  };
  metadata: {
    processingTimeMs: number;
    tokenCount: number;
    costEstimate: number;
    confidenceScore: number;
    model: string;
  };
}

export default function BetaDataProcessingPage() {
  const [selectedDump, setSelectedDump] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('deepseek-chat');

  // Fetch available dumps
  const { data: dumpsData, isLoading: dumpsLoading } = useQuery({
    queryKey: ['/api/beta/cleaning/available-data'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Fetch available models
  const { data: modelsData } = useQuery({
    queryKey: ['/api/beta/cleaning/models']
  });

  // Process data mutation
  const processMutation = useMutation({
    mutationFn: async (data: { sourceType: string; sourceId: number; models: string[] }) => {
      const response = await fetch('/api/beta/cleaning/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to process data');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Processing Complete",
        description: `Successfully processed ${data.results.length} model(s)`
      });
      // Refresh available dumps to update cleaned status
      queryClient.invalidateQueries({ queryKey: ['/api/beta/cleaning/available-data'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleProcess = () => {
    if (!selectedDump) {
      toast({
        title: "No data selected",
        description: "Please select a dump to process",
        variant: "destructive"
      });
      return;
    }

    const [sourceType, sourceId] = selectedDump.split(':');
    processMutation.mutate({
      sourceType,
      sourceId: parseInt(sourceId),
      models: [selectedModel]
    });
  };

  const dumps = dumpsData?.dumps || [];
  const models = modelsData?.models || [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Data Processing</h1>
        <p className="text-muted-foreground">
          Process raw dumps from collection methods using LLM models
        </p>
      </div>

      <div className="space-y-6">
        {/* Step 1: Select Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                1
              </span>
              Select Raw Data to Process
            </CardTitle>
            <CardDescription>
              Choose from available dumps collected by different methods
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dumpsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : dumps.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No dumps available. Run a collection method first.
              </p>
            ) : (
              <RadioGroup value={selectedDump} onValueChange={setSelectedDump}>
                <div className="space-y-3">
                  {dumps.map((dump: AvailableDump) => {
                    const value = `${dump.type}:${dump.id}`;
                    const methodName = {
                      'crawlee_dump': 'Crawlee',
                      'scrapy_crawl': 'Scrapy',
                      'playwright_dump': 'Playwright'
                    }[dump.type];

                    return (
                      <div
                        key={value}
                        className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent cursor-pointer"
                        onClick={() => setSelectedDump(value)}
                      >
                        <RadioGroupItem value={value} />
                        <div className="flex-1">
                          <Label className="font-semibold cursor-pointer">
                            {dump.domain}
                            <span className={`ml-2 px-2 py-1 text-xs rounded-md ${
                              dump.type === 'crawlee_dump' ? 'bg-green-100 text-green-700' :
                              dump.type === 'scrapy_crawl' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {methodName}
                            </span>
                            {dump.hasBeenCleaned && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ✓ Cleaned with: {dump.cleanedWith?.join(', ')}
                              </span>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {dump.pages} page{dump.pages !== 1 ? 's' : ''} • {dump.size} • 
                            Collected {new Date(dump.collectedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                2
              </span>
              Select Processing Model
            </CardTitle>
            <CardDescription>
              Choose an LLM model to extract information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.length === 0 ? (
                  <SelectItem value="deepseek-chat" disabled>
                    No models available (API key required)
                  </SelectItem>
                ) : (
                  models.map((model: any) => (
                    <SelectItem key={model.name} value={model.name}>
                      {model.displayName} {!model.isFree && `($${model.costPer1kTokens}/1K tokens)`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {models.length === 0 && (
              <p className="text-sm text-amber-600 mt-2">
                ⚠️ No OpenRouter API key configured. Models won't be available for processing.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Process Button */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={handleProcess}
            disabled={!selectedDump || processMutation.isPending || models.length === 0}
          >
            {processMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Process Data'
            )}
          </Button>
        </div>

        {/* Results */}
        {processMutation.isSuccess && processMutation.data && (
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
            </CardHeader>
            <CardContent>
              {processMutation.data.results.map((result: CleaningResult, index: number) => (
                <div key={index} className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>Model: <strong>{result.metadata.model}</strong></div>
                      <div>Processing Time: <strong>{result.metadata.processingTimeMs}ms</strong></div>
                      <div>Confidence: <strong>{(result.metadata.confidenceScore * 100).toFixed(0)}%</strong></div>
                      <div>Tokens: <strong>{result.metadata.tokenCount}</strong></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {result.extractedData.companyName && (
                      <div>
                        <Label className="text-muted-foreground">Company Name</Label>
                        <p className="font-medium">{result.extractedData.companyName}</p>
                      </div>
                    )}
                    {result.extractedData.legalEntity && (
                      <div>
                        <Label className="text-muted-foreground">Legal Entity</Label>
                        <p className="font-medium">{result.extractedData.legalEntity}</p>
                      </div>
                    )}
                    {result.extractedData.addresses && result.extractedData.addresses.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Addresses</Label>
                        <ul className="list-disc list-inside">
                          {result.extractedData.addresses.map((addr, i) => (
                            <li key={i}>{addr}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {result.extractedData.phones && result.extractedData.phones.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Phone Numbers</Label>
                        <p>{result.extractedData.phones.join(', ')}</p>
                      </div>
                    )}
                    {result.extractedData.emails && result.extractedData.emails.length > 0 && (
                      <div>
                        <Label className="text-muted-foreground">Emails</Label>
                        <p>{result.extractedData.emails.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}