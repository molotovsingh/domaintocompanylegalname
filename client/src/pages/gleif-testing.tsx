import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Search, Database, AlertCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { RawGLEIFDisplay } from '../components/raw-gleif-display';
import { Link } from 'wouter';

interface GLEIFResult {
  success: boolean;
  companyName?: string;
  leiCode?: string;
  entityStatus?: string;
  country?: string;
  confidence?: string;
  processingTime?: number;
  error?: string;
  rawApiResponse?: any;
  totalRecords?: number;
  entityCount?: number;
}

export default function GLEIFTestingPage() {
  const [companyName, setCompanyName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [testResults, setTestResults] = useState<GLEIFResult | null>(null);
  const [testType, setTestType] = useState<'processed' | 'raw'>('processed');

  const runGLEIFTest = async () => {
    if (!companyName.trim()) return;

    setIsProcessing(true);
    setTestResults(null);

    try {
      const endpoint = testType === 'raw' ? '/api/beta/gleif-raw' : '/api/beta/gleif-test';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companyName: companyName.trim(),
          domain: companyName.trim() 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      setTestResults(result);

    } catch (error) {
      console.error('GLEIF test failed:', error);
      setTestResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: 0
      });
    } finally {
      setIsProcessing(false);
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
                <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg p-2">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">GLEIF API Testing</h1>
                  <p className="text-sm text-gray-600">Test Legal Entity Identifier extraction independently</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">GLEIF API Testing</h1>
          <p className="text-muted-foreground">
            Test GLEIF Legal Entity Identifier extraction independently
          </p>
        </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>GLEIF Entity Search</CardTitle>
          <CardDescription>
            Search for legal entity information using the GLEIF API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Company Name:</label>
            <Input
              placeholder="Enter company name (e.g., Apple, Microsoft)"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isProcessing && runGLEIFTest()}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Test Type:</label>
            <div className="flex space-x-2">
              <Button
                variant={testType === 'processed' ? 'default' : 'outline'}
                onClick={() => setTestType('processed')}
                size="sm"
              >
                Processed Results
              </Button>
              <Button
                variant={testType === 'raw' ? 'default' : 'outline'}
                onClick={() => setTestType('raw')}
                size="sm"
              >
                Raw API Data
              </Button>
            </div>
          </div>

          <Button 
            onClick={runGLEIFTest}
            disabled={!companyName.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing GLEIF...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Run GLEIF Test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results Display */}
      <RawGLEIFDisplay 
        result={testResults} 
        loading={isProcessing} 
        error={testResults?.success === false ? testResults.error : undefined}
      />
      </main>
    </div>
  );
}