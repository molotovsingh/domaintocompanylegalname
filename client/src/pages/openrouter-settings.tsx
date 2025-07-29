import { useState, useEffect } from 'react';
import { ArrowLeft, Settings, Zap, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  details?: any;
}

export default function OpenRouterSettings() {
  const [apiKey, setApiKey] = useState('');
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Check if API key exists on mount
  useEffect(() => {
    checkStoredKey();
  }, []);

  const checkStoredKey = async () => {
    try {
      const response = await fetch('/api/openrouter/check-key');
      const data = await response.json();
      setHasStoredKey(data.hasKey);
      if (data.hasKey) {
        setApiKey('sk-or-***'); // Show masked key
      }
    } catch (error) {
      console.error('Failed to check stored key:', error);
      setHasStoredKey(false);
    }
  };

  const runSmokeTest = async () => {
    // Check if we have a key available (either stored or entered)
    const keyToUse = hasStoredKey ? 'USE_STORED_KEY' : apiKey;
    
    if (!hasStoredKey && !apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenRouter API key or add it to Replit Secrets.",
        variant: "destructive"
      });
      return;
    }

    setIsRunningTest(true);
    setTestResults([]);
    setCurrentTest('');

    try {
      const response = await fetch('/api/openrouter/smoke-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: keyToUse })
      });
      
      const data = await response.json();

      if (data.success) {
        setTestResults(data.results);
        if (data.allPassed) {
          toast({
            title: "Smoke Test Passed!",
            description: "All tests completed successfully. OpenRouter is ready for use.",
          });
        } else {
          toast({
            title: "Some Tests Failed",
            description: "Please check the results below for details.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Test Failed",
          description: data.error || "Failed to run smoke test",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to run smoke test",
        variant: "destructive"
      });
    } finally {
      setIsRunningTest(false);
      setCurrentTest('');
    }
  };

  const saveApiKey = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenRouter API key.",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/openrouter/save-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "API Key Saved",
          description: "Your OpenRouter API key has been securely saved.",
        });
      } else {
        toast({
          title: "Failed to Save",
          description: data.error || "Failed to save API key",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save API key",
        variant: "destructive"
      });
    }
  };

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
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-2">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">OpenRouter Settings</h1>
                  <p className="text-sm text-gray-600">Configure and test OpenRouter integration</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your OpenRouter API key for multi-model LLM access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasStoredKey ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    OpenRouter API key detected in Replit Secrets. You're ready to run tests!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="apiKey">OpenRouter API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get your API key from{' '}
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      openrouter.ai/keys
                    </a>
                    {' '}or add it to Replit Secrets as "openrouter"
                  </p>
                </div>
              )}
              
              <div className="flex gap-2">
                {!hasStoredKey && (
                  <Button 
                    onClick={saveApiKey}
                    variant="outline"
                    disabled={!apiKey}
                  >
                    Save API Key
                  </Button>
                )}
                <Button 
                  onClick={runSmokeTest}
                  disabled={(!hasStoredKey && !apiKey) || isRunningTest}
                  className={hasStoredKey ? 'w-full' : ''}
                >
                  {isRunningTest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Run Smoke Test
                    </>
                  )}
                </Button>
              </div>

              {currentTest && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Running: {currentTest}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>About OpenRouter</CardTitle>
              <CardDescription>
                Unified API for accessing multiple LLM providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">Supported Models</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">GPT-4</Badge>
                  <Badge variant="secondary">Claude 3</Badge>
                  <Badge variant="secondary">Llama 3</Badge>
                  <Badge variant="secondary">Mixtral</Badge>
                  <Badge variant="secondary">And more...</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Benefits</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Access multiple AI models with one API</li>
                  <li>Automatic fallback between models</li>
                  <li>Cost optimization and tracking</li>
                  <li>Enhanced entity extraction accuracy</li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium">Smoke Test Checks</h4>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>API key validation</li>
                  <li>Model availability</li>
                  <li>Chat completion test</li>
                  <li>Entity extraction test</li>
                  <li>Model comparison</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Smoke Test Results</CardTitle>
              <CardDescription>
                Detailed results from the OpenRouter integration test
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      result.passed ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    {result.passed ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{result.testName}</h4>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && (
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}