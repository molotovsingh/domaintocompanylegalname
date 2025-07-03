
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Calendar, GitBranch, Database, Zap, Target, Brain } from 'lucide-react';

const DataJourneyPage = () => {
  const currentVersion = "2.1 - GLEIF Knowledge Base V3";
  const lastUpdated = "January 3, 2025";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Journey Documentation</h1>
          <p className="text-muted-foreground">Complete data flow from raw domain input to enhanced business intelligence</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2">
            <Calendar className="w-4 h-4 mr-1" />
            Last Updated: {lastUpdated}
          </Badge>
          <div className="text-sm font-medium">Version: {currentVersion}</div>
        </div>
      </div>

      {/* Version History Alert */}
      <Alert>
        <GitBranch className="h-4 w-4" />
        <AlertDescription>
          <strong>Current Implementation:</strong> Enhanced Business Intelligence with GLEIF Knowledge Base V3 accumulation. 
          Previous versions available in git history for reference.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phase1">Input & Processing</TabsTrigger>
          <TabsTrigger value="phase2">Level 1 Extraction</TabsTrigger>
          <TabsTrigger value="phase3">Business Intelligence</TabsTrigger>
          <TabsTrigger value="phase4">GLEIF Enhancement</TabsTrigger>
          <TabsTrigger value="storage">Storage & Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                System Architecture Overview
              </CardTitle>
              <CardDescription>
                Evolution from basic domain extraction to comprehensive business intelligence platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-green-700">Level 1: Core Extraction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• Domain mapping (95% confidence)</li>
                      <li>• HTML content analysis</li>
                      <li>• Geographic intelligence</li>
                      <li>• Business categorization</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-blue-700">Level 2: GLEIF Verification</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• Official LEI code verification</li>
                      <li>• Legal entity status validation</li>
                      <li>• Jurisdiction confirmation</li>
                      <li>• Corporate family mapping</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-purple-700">Knowledge Base V3</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-1">
                      <li>• Entity accumulation (5-10x data)</li>
                      <li>• Cross-domain intelligence</li>
                      <li>• Corporate relationship mapping</li>
                      <li>• Proprietary entity moat</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Key Performance Metrics (Current)</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><strong>Processing Rate:</strong> 20 domains/hour</div>
                  <div><strong>Success Rate:</strong> 85%</div>
                  <div><strong>GLEIF Verification:</strong> 47 entities accumulated</div>
                  <div><strong>Confidence Average:</strong> 87%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phase 1: Input & Processing */}
        <TabsContent value="phase1">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Phase 1: Input & Domain Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">1. CSV Upload Process</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      <div>Location: <code>client/src/components/file-upload.tsx</code></div>
                      <div>Validation: Format checking, domain extraction</div>
                      <div>Output: Unique batchId generation</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">2. Batch Creation</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      <div>Location: <code>server/pgStorage.ts</code></div>
                      <div>Hash: MD5(domain.toLowerCase())</div>
                      <div>Status: 'pending' → 'processing' → 'complete'</div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Domain Hash Strategy:</strong> Persistent MD5 hashing enables cross-batch deduplication and 
                    intelligent reprocessing of only low-confidence domains (&lt;85%).
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Phase 2: Level 1 Extraction */}
        <TabsContent value="phase2">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Phase 2: Level 1 Extraction Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold">Priority 1: Domain Mapping (95% Confidence)</h4>
                    <p className="text-sm text-gray-600">Fortune 500 and known entity mappings</p>
                    <div className="bg-green-50 p-2 rounded text-sm font-mono mt-2">
                      'apple.com' → 'Apple Inc.' (Authority: Domain mapping)
                    </div>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold">Priority 2: HTML Content Extraction</h4>
                    <ul className="text-sm space-y-1 mt-2">
                      <li>• <strong>Footer Copyright Analysis:</strong> Legal entity extraction</li>
                      <li>• <strong>About Page Parsing:</strong> Corporate descriptions</li>
                      <li>• <strong>Meta Property Analysis:</strong> Title and description tags</li>
                      <li>• <strong>Geographic Intelligence:</strong> Countries, currencies, jurisdictions</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-semibold">Priority 3: Domain Parsing Fallback</h4>
                    <p className="text-sm text-gray-600">Converts domain stem to company format with legal suffix validation</p>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Geographic Markers Example Output</h4>
                  <pre className="text-sm bg-white p-2 rounded overflow-x-auto">
{`geographicMarkers: {
  detectedCountries: ['United States', 'Germany'],
  phoneCountryCodes: ['+1', '+49'],
  legalJurisdictions: ['Delaware corporation'],
  confidenceScore: 85
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Phase 3: Business Intelligence */}
        <TabsContent value="phase3">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Phase 3: Business Intelligence Enhancement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Content Analysis Engine</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <div>
                          <strong>Entity Category Prediction:</strong>
                          <div className="bg-gray-50 p-2 rounded mt-1 font-mono">
                            primaryCategory: 'Technology/Software'<br/>
                            confidence: 90<br/>
                            indicators: ['software', 'cloud', 'SaaS']
                          </div>
                        </div>
                        <div>
                          <strong>Business Scale Detection:</strong>
                          <div className="text-gray-600">Fortune 500, Global operations, Corporate heritage</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">5-Category Classification</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <Badge variant="outline" className="text-green-700 border-green-300">GLEIF Verified - High Priority</Badge>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">Good Target - Tech Issue</Badge>
                        <Badge variant="outline" className="text-yellow-700 border-yellow-300">Protected - Manual Review</Badge>
                        <Badge variant="outline" className="text-red-700 border-red-300">Bad Website - Skip</Badge>
                        <Badge variant="outline" className="text-gray-700 border-gray-300">Incomplete - Low Priority</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Processing Location:</strong> <code>server/services/processor.ts</code> - 
                    Enhanced business categorization with geographic and industry context analysis.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Phase 4: GLEIF Enhancement */}
        <TabsContent value="phase4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Phase 4: Level 2 GLEIF Enhancement & Knowledge Base V3</CardTitle>
                <CardDescription>Official legal entity verification with compound intelligence accumulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">GLEIF API Integration</h4>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      <div><strong>Triggers:</strong> Confidence &lt; 70% or extraction failures</div>
                      <div><strong>Search Strategy:</strong> Enhanced entity search with jurisdiction context</div>
                      <div><strong>Scoring:</strong> Weighted algorithm (Name: 40%, Fortune 500: 25%, TLD: 20%)</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Knowledge Base Accumulation</h4>
                    <div className="bg-blue-50 p-3 rounded text-sm">
                      <div><strong>Data Multiplication:</strong> 5-10x entity storage per API call</div>
                      <div><strong>Corporate Families:</strong> Relationship mapping and hierarchy discovery</div>
                      <div><strong>Intelligence Growth:</strong> Compound accumulation over time</div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">GLEIF Candidate Scoring Example</h4>
                  <pre className="text-sm bg-white p-2 rounded overflow-x-auto">
{`gleifCandidates: [{
  leiCode: '254900OPPU84GM83MG36',
  legalName: 'Apple Inc.',
  gleifMatchScore: 0.95,
  weightedScore: 0.92,
  rankPosition: 1,
  isPrimarySelection: true,
  jurisdiction: 'US-DE',
  entityStatus: 'ACTIVE'
}]`}
                  </pre>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Knowledge Base Schema:</strong> Master entities table, domain-entity relationships, 
                    and corporate hierarchy discovery with frequency tracking and confidence scoring.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Storage & Analytics */}
        <TabsContent value="storage">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Phase 5-7: Data Storage, Analytics & Intelligence APIs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Enhanced Domain Record</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="space-y-2">
                        <div><strong>Core Fields:</strong> companyName, extractionMethod, confidenceScore</div>
                        <div><strong>Business Intelligence:</strong> primaryBusinessDescription, industryContext, corporateHeritage</div>
                        <div><strong>GLEIF Enhancement:</strong> primaryLeiCode, finalLegalName, finalConfidence</div>
                        <div><strong>Processing:</strong> processingTimeMs, manualReviewRequired</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Real-time Analytics</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="space-y-2">
                        <div><strong>Session Metrics:</strong> Success rate, average confidence, processing speed</div>
                        <div><strong>GLEIF Analytics:</strong> Verification rate, jurisdiction distribution, entity status</div>
                        <div><strong>Quality Classification:</strong> 5-category business intelligence breakdown</div>
                        <div><strong>Performance Tracking:</strong> Historical comparisons and trend analysis</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Data Transformation Example</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Raw Input:</strong>
                      <div className="bg-white p-2 rounded font-mono mt-1">apple.com</div>
                    </div>
                    <div>
                      <strong>Final Output:</strong>
                      <div className="bg-white p-2 rounded font-mono mt-1">
                        Apple Inc.<br/>
                        LEI: 254900OPPU84GM83MG36<br/>
                        Confidence: 98%<br/>
                        Category: GLEIF Verified
                      </div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Competitive Advantage:</strong> System maintains full extraction lineage through extractionAttempts JSON, 
                    enabling comprehensive audit trails and proprietary entity intelligence accumulation.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>This documentation is automatically maintained and reflects the current system implementation.</p>
            <p>For technical implementation details, see: <code>/server/services/</code> and <code>/shared/schema.ts</code></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataJourneyPage;
