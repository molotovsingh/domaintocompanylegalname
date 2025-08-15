
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  ArrowLeft, 
  Target,
  Eye,
  Download,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Link } from 'wouter';

interface DumpSample {
  id: string;
  domain: string;
  method: string;
  size: number;
  preview: string;
  createdAt?: string;
}

interface ExtractionResult {
  entities: Array<{
    text: string;
    type: string;
    confidence: number;
    sourceLocation: {
      start: number;
      end: number;
      context: string;
    };
  }>;
  processingTime: number;
  tokensProcessed: number;
  sourceMapping: Array<{
    text: string;
    originalPosition: number;
    extractedPosition: number;
  }>;
  metadata: {
    language: string;
    documentLength: number;
    chunkCount: number;
  };
}

interface LangExtractTest {
  id: string;
  dumpId: string;
  domain: string;
  schema: string;
  result: ExtractionResult | null;
  error: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
}

export default function LangExtractDemo() {
  const [availableDumps, setAvailableDumps] = useState<DumpSample[]>([]);
  const [activeTests, setActiveTests] = useState<LangExtractTest[]>([]);
  const [selectedDump, setSelectedDump] = useState<string>('');
  const [customSchema, setCustomSchema] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState(false);

  // Available Gemini models
  const availableModels = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'High quality reasoning' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Balanced speed and quality' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', description: 'Latest experimental model' }
  ];

  // Predefined extraction schemas
  const predefinedSchemas = {
    'Legal Entity (Recommended)': `{
  "legal_entity_name": "string",
  "brand_name": "string",
  "registration_number": "string",
  "corporate_suffix": "string"
}`,
    'Multiple Entities (Subsidiaries)': `{
  "primary_entity": {
    "legal_name": "string",
    "corporate_suffix": "string",
    "registration_number": "string"
  },
  "subsidiaries": [{
    "legal_name": "string",
    "corporate_suffix": "string",
    "relationship": "string"
  }],
  "brand_names": ["string"],
  "total_entities_found": "number"
}`,
    'All Entities (Simple Array)': `{
  "legal_entities": ["string"],
  "brand_names": ["string"],
  "total_count": "number"
}`,
    'Company Information': `{
  "company_name": "string",
  "legal_entity_type": "string", 
  "headquarters_location": "string",
  "year_founded": "number",
  "industry": "string"
}`,
    'Contact Details': `{
  "email_addresses": ["string"],
  "phone_numbers": ["string"],
  "physical_addresses": ["string"],
  "social_media_links": ["string"]
}`,
    'Financial Information': `{
  "revenue": "string",
  "employees_count": "string",
  "stock_symbol": "string",
  "market_cap": "string"
}`,
    'Legal & Compliance': `{
  "legal_entity_name": "string",
  "registration_number": "string",
  "jurisdiction": "string",
  "regulatory_licenses": ["string"]
}`
  };

  useEffect(() => {
    fetchAvailableDumps();
  }, []);

  const fetchAvailableDumps = async () => {
    try {
      const response = await fetch('/api/langextract-demo/dumps');
      if (response.ok) {
        const dumps = await response.json();
        setAvailableDumps(dumps);
      }
    } catch (error) {
      console.error('Failed to fetch dumps:', error);
    }
  };

  const runExtraction = async (schemaName: string, schema: string) => {
    if (!selectedDump) {
      alert('Please select a dump first');
      return;
    }

    const testId = `test_${Date.now()}`;
    const newTest: LangExtractTest = {
      id: testId,
      dumpId: selectedDump,
      domain: availableDumps.find(d => d.id === selectedDump)?.domain || 'unknown',
      schema: schemaName,
      result: null,
      error: null,
      status: 'pending',
      startTime: new Date()
    };

    setActiveTests(prev => [newTest, ...prev]);
    setIsLoading(true);

    try {
      // Update test status to running
      setActiveTests(prev => prev.map(test => 
        test.id === testId ? { ...test, status: 'running' as const } : test
      ));

      const response = await fetch('/api/langextract-demo/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dumpId: selectedDump,
          schema: JSON.parse(schema),
          schemaName,
          modelName: selectedModel
        })
      });

      const result = await response.json();

      if (response.ok) {
        setActiveTests(prev => prev.map(test => 
          test.id === testId ? { 
            ...test, 
            status: 'completed' as const,
            result: result.extraction,
            endTime: new Date()
          } : test
        ));
      } else {
        throw new Error(result.error || 'Extraction failed');
      }
    } catch (error) {
      setActiveTests(prev => prev.map(test => 
        test.id === testId ? { 
          ...test, 
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          endTime: new Date()
        } : test
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setActiveTests([]);
  };

  const getStatusIcon = (status: LangExtractTest['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'running':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadgeColor = (status: LangExtractTest['status']) => {
    switch (status) {
      case 'pending': return 'bg-gray-500';
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link href="/settings" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" />
                Back to Settings
              </Link>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg p-2">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">LangExtract Demo</h1>
                  <p className="text-sm text-gray-600">Google's LangExtract library in action</p>
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              <Target className="w-4 h-4 mr-1" />
              Live Demo
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            This is a standalone demo showcasing Google's LangExtract library. No data is persisted - 
            results are for demonstration purposes only.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="demo" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="demo">Interactive Demo</TabsTrigger>
            <TabsTrigger value="results">Test Results</TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Input Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Data Source</CardTitle>
                  <CardDescription>
                    Choose from available dumps to test extraction
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Available Dumps:</label>
                    <select 
                      className="w-full mt-1 p-2 border rounded-md"
                      value={selectedDump}
                      onChange={(e) => setSelectedDump(e.target.value)}
                    >
                      <option value="">Select a dump...</option>
                      {availableDumps.map(dump => (
                        <option key={dump.id} value={dump.id}>
                          {dump.domain} ({dump.method}) - {Math.round(dump.size / 1024)}KB 
                          {dump.createdAt && ` - ${new Date(dump.createdAt).toLocaleDateString()}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedDump && (
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium text-sm">Preview:</h4>
                        {availableDumps.find(d => d.id === selectedDump)?.createdAt && (
                          <span className="text-xs text-gray-500">
                            Captured: {new Date(availableDumps.find(d => d.id === selectedDump)!.createdAt!).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {availableDumps.find(d => d.id === selectedDump)?.preview}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Model Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Model Selection</CardTitle>
                  <CardDescription>
                    Choose the Gemini model for extraction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <label className="text-sm font-medium">Available Models:</label>
                    <select 
                      className="w-full mt-1 p-2 border rounded-md"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name} - {model.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              {/* Schema Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Extraction Schema</CardTitle>
                  <CardDescription>
                    Choose what information to extract
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(predefinedSchemas).map(([name, schema]) => (
                      <Button
                        key={name}
                        variant="outline"
                        size="sm"
                        disabled={isLoading || !selectedDump}
                        onClick={() => runExtraction(name, schema)}
                        className="h-auto py-2 px-3 text-left"
                      >
                        <div>
                          <div className="font-medium text-xs">{name}</div>
                          <div className="text-xs text-muted-foreground">
                            {Object.keys(JSON.parse(schema)).length} fields
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>

                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium">Custom Schema (JSON):</label>
                    <textarea
                      className="w-full mt-1 p-2 border rounded-md text-sm"
                      rows={4}
                      placeholder='{"field_name": "type", ...}'
                      value={customSchema}
                      onChange={(e) => setCustomSchema(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={isLoading || !selectedDump || !customSchema.trim()}
                      onClick={() => {
                        try {
                          JSON.parse(customSchema);
                          runExtraction('Custom Schema', customSchema);
                        } catch {
                          alert('Invalid JSON schema');
                        }
                      }}
                      className="mt-2"
                    >
                      Run Custom Extraction
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <Button variant="outline" size="sm" onClick={clearResults}>
                Clear Results
              </Button>
            </div>

            {activeTests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tests run yet. Go to the Demo tab to start testing.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {activeTests.map(test => (
                  <Card key={test.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(test.status)}
                          <CardTitle className="text-lg">{test.domain}</CardTitle>
                          <Badge className={getStatusBadgeColor(test.status)}>
                            {test.schema}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {test.startTime.toLocaleTimeString()}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {test.status === 'running' && (
                        <Progress value={undefined} className="mb-4" />
                      )}

                      {test.error && (
                        <Alert className="mb-4">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            Error: {test.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {test.result && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-purple-600" />
                                Model:
                              </span>
                              <div className="text-xs font-mono text-purple-600">{test.result.metadata?.model || 'unknown'}</div>
                            </div>
                            <div>
                              <span className="font-medium">Processing Time:</span>
                              <div>{test.result.processingTime || 0}ms</div>
                            </div>
                            <div>
                              <span className="font-medium">Entities Found:</span>
                              <div>{test.result.entities?.length || 0}</div>
                            </div>
                            <div>
                              <span className="font-medium">Tokens Processed:</span>
                              <div>{test.result.tokensProcessed?.toLocaleString() || '0'}</div>
                            </div>
                          </div>

                          {test.result.entities && test.result.entities.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Extracted Entities:</h4>
                              <div className="space-y-2">
                                {test.result.entities.map((entity, index) => (
                                  <div key={index} className="p-3 bg-gray-50 rounded-md">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{entity.type}</span>
                                      <Badge variant="outline">
                                        {Math.round(entity.confidence * 100)}% confidence
                                      </Badge>
                                    </div>
                                    <div className="text-sm text-gray-700 mb-1">
                                      "{entity.text}"
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Context: "{entity.sourceLocation.context}"
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="pt-3 border-t">
                            <h4 className="font-medium mb-2">Source Mapping:</h4>
                            <div className="text-sm text-gray-600">
                              {test.result.sourceMapping?.length || 0} source mappings • 
                              Document length: {test.result.metadata?.documentLength?.toLocaleString() || '0'} chars • 
                              Language: {test.result.metadata?.language || 'unknown'} • 
                              Chunks: {test.result.metadata?.chunkCount || 0}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
