import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code, Settings, Target, FileText, Globe, Database } from "lucide-react";

export default function ParsingRules() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Domain Parsing Rules & Logic</h1>
          <p className="text-gray-600">Developer documentation for company name extraction algorithms and rules</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="methods">Methods</TabsTrigger>
            <TabsTrigger value="confidence">Confidence</TabsTrigger>
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Extraction Priority Order
                </CardTitle>
                <CardDescription>
                  The system attempts extraction methods in order of reliability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div>
                      <div className="font-medium">1. Domain Mapping</div>
                      <div className="text-sm text-gray-600">Known Fortune 500/FTSE companies</div>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">95% confidence</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div>
                      <div className="font-medium">2. HTML Extraction</div>
                      <div className="text-sm text-gray-600">Structured data, titles, meta tags</div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">65-95% confidence</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div>
                      <div className="font-medium">3. Sub-page Crawling</div>
                      <div className="text-sm text-gray-600">About Us, Terms, Legal pages</div>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">75-85% confidence</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div>
                      <div className="font-medium">4. Domain Parsing</div>
                      <div className="text-sm text-gray-600">Generic domain-to-name conversion</div>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">55% confidence</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Processing Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Timeout:</strong> 10 seconds per request
                  </div>
                  <div>
                    <strong>Max Redirects:</strong> 3
                  </div>
                  <div>
                    <strong>Batch Size:</strong> 10 domains concurrently
                  </div>
                  <div>
                    <strong>Retry Logic:</strong> 1 retry on failure
                  </div>
                  <div>
                    <strong>User Agent:</strong> Chrome/91.0.4472.124
                  </div>
                  <div>
                    <strong>Duplicate Detection:</strong> 85%+ confidence reuse
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="methods" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  HTML Extraction Methods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">1. Structured Data (JSON-LD)</h4>
                  <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                    {'<script type="application/ld+json">'}
                    <br />
                    {'  { "name": "Company Name", "legalName": "Legal Entity" }'}
                    <br />
                    {'</script>'}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Highest confidence (95%) - official business data</p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">2. About Section Extraction</h4>
                  <div className="space-y-2">
                    <div className="text-sm"><strong>Selectors:</strong></div>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      section[class*="about"] p:first-of-type<br />
                      .about-section p:first-of-type<br />
                      #about p:first-of-type<br />
                      [class*="company-info"] p:first-of-type
                    </div>
                    <div className="text-sm"><strong>Pattern Matching:</strong></div>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      • "We are [Company Name] Corp"<br />
                      • "[Company Name] is a leading..."<br />
                      • "Founded [Company Name] Limited"
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">3. Legal Footer Extraction</h4>
                  <div className="space-y-2">
                    <div className="text-sm"><strong>Selectors:</strong></div>
                    <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                      footer p:contains("©")<br />
                      footer p:contains("Copyright")<br />
                      .copyright, .footer-legal
                    </div>
                    <div className="text-sm"><strong>Pattern Matching:</strong></div>
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      • "© 2024 [Company Name] Inc."<br />
                      • "Copyright [Company Name] Corporation"<br />
                      • "All rights reserved [Company Name] Ltd."
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">4. Sub-page Crawling</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">About Pages</div>
                      <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                        /about<br />
                        /about-us<br />
                        /company<br />
                        /who-we-are<br />
                        /our-company<br />
                        /corporate
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Legal Pages</div>
                      <div className="bg-gray-50 p-3 rounded text-sm font-mono">
                        /terms<br />
                        /legal<br />
                        /terms-and-conditions<br />
                        /privacy
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confidence" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Confidence Scoring Algorithm
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Base Confidence: 50%</h4>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Method Bonuses:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Domain Mapping:</strong> +45% (95% total)
                      </div>
                      <div>
                        <strong>Structured Data:</strong> +45% (95% total)
                      </div>
                      <div>
                        <strong>About Page/Section:</strong> +35% (85% total)
                      </div>
                      <div>
                        <strong>Legal Page/Text:</strong> +25% (75% total)
                      </div>
                      <div>
                        <strong>HTML Title:</strong> +20% (70% total)
                      </div>
                      <div>
                        <strong>Meta Description:</strong> +15% (65% total)
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Legal Entity Bonuses:</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Inc, Corp, Corporation:</strong> +10%
                      </div>
                      <div>
                        <strong>Ltd, Limited:</strong> +10%
                      </div>
                      <div>
                        <strong>LLC, LP, LLP:</strong> +8%
                      </div>
                      <div>
                        <strong>plc (UK):</strong> +10%
                      </div>
                      <div>
                        <strong>Co. Ltd. (Asian):</strong> +8%
                      </div>
                      <div>
                        <strong>Group, Holdings:</strong> +5%
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Length Penalties:</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Too Short (&lt;3 characters):</strong> -20%</div>
                      <div><strong>Too Long (&gt;50 characters):</strong> -10%</div>
                      <div><strong>Optimal Length (3-20 characters):</strong> No penalty</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Domain Mapping Categories
                </CardTitle>
                <CardDescription>
                  Known company mappings for 95% confidence extraction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3 text-blue-700">UK FTSE 100 Companies</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>shell.com</span>
                        <span className="text-gray-600">Shell plc</span>
                      </div>
                      <div className="flex justify-between">
                        <span>unilever.com</span>
                        <span className="text-gray-600">Unilever PLC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>vodafone.com</span>
                        <span className="text-gray-600">Vodafone Group Plc</span>
                      </div>
                      <div className="flex justify-between">
                        <span>rolls-royce.com</span>
                        <span className="text-gray-600">Rolls-Royce Holdings plc</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">+ 36 more FTSE companies</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-green-700">US Fortune 500</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>walmart.com</span>
                        <span className="text-gray-600">Walmart Inc.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>amazon.com</span>
                        <span className="text-gray-600">Amazon.com Inc.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>apple.com</span>
                        <span className="text-gray-600">Apple Inc.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>microsoft.com</span>
                        <span className="text-gray-600">Microsoft Corp.</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">+ 50+ Fortune 500 companies</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-red-700">Chinese Global Companies</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>alibaba.com</span>
                        <span className="text-gray-600">Alibaba Group Holding Limited</span>
                      </div>
                      <div className="flex justify-between">
                        <span>tencent.com</span>
                        <span className="text-gray-600">Tencent Holdings Limited</span>
                      </div>
                      <div className="flex justify-between">
                        <span>bytedance.com</span>
                        <span className="text-gray-600">ByteDance Ltd.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>pingan.com</span>
                        <span className="text-gray-600">Ping An Insurance Group</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">+ 30+ Chinese companies</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-purple-700">European Companies</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>nestle.com</span>
                        <span className="text-gray-600">Nestlé S.A.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>asml.com</span>
                        <span className="text-gray-600">ASML Holding N.V.</span>
                      </div>
                      <div className="flex justify-between">
                        <span>sap.com</span>
                        <span className="text-gray-600">SAP SE</span>
                      </div>
                      <div className="flex justify-between">
                        <span>lvmh.com</span>
                        <span className="text-gray-600">LVMH Moët Hennessy Louis Vuitton SE</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">+ 20+ European companies</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Text Pattern Recognition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">About Page Patterns</h4>
                  <div className="bg-gray-50 p-4 rounded text-sm font-mono">
                    <div className="text-green-600">// Match: "We are XYZ Company"</div>
                    <div>/(?:we are|about)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i</div>
                    <br />
                    <div className="text-green-600">// Match: "XYZ Corp is a leading..."</div>
                    <div>/^([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))\s+(?:is|was|provides|offers|specializes)/i</div>
                    <br />
                    <div className="text-green-600">// Match: "Founded XYZ Company"</div>
                    <div>/(?:founded|established|created)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Legal Text Patterns</h4>
                  <div className="bg-gray-50 p-4 rounded text-sm font-mono">
                    <div className="text-blue-600">// Match: "This agreement between you and XYZ Corp"</div>
                    <div>/(?:this agreement|these terms).*?(?:between you and|with)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i</div>
                    <br />
                    <div className="text-blue-600">// Match: "© 2024 XYZ Corporation"</div>
                    <div>/(?:copyright|©|all rights reserved).*?(\d{`{4}`).*?([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Legal Entity Suffixes</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm font-medium mb-2">US Corporate</div>
                      <div className="text-sm space-y-1">
                        <div>Inc., Incorporated</div>
                        <div>Corp., Corporation</div>
                        <div>LLC, LP, LLP</div>
                        <div>Company, Co.</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">UK/International</div>
                      <div className="text-sm space-y-1">
                        <div>plc, PLC</div>
                        <div>Ltd., Limited</div>
                        <div>Holdings</div>
                        <div>Group</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Asian</div>
                      <div className="text-sm space-y-1">
                        <div>Co. Ltd.</div>
                        <div>Co., Ltd.</div>
                        <div>Limited</div>
                        <div>Pte Ltd</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Validation Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Invalid Pattern Detection</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2 text-red-600">Common Page Elements (Rejected)</div>
                      <div className="bg-red-50 p-3 rounded text-sm font-mono">
                        /^(home|about|contact|login|register|sign|error|404|403|500)$/i
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2 text-red-600">Stop Words (Rejected)</div>
                      <div className="bg-red-50 p-3 rounded text-sm font-mono">
                        /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2 text-red-600">Numbers Only (Rejected)</div>
                      <div className="bg-red-50 p-3 rounded text-sm font-mono">
                        /^\d+$/
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-2 text-red-600">Special Characters Only (Rejected)</div>
                      <div className="bg-red-50 p-3 rounded text-sm font-mono">
                        /^[^\w\s]+$/
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Length Validation</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="p-3 bg-red-50 rounded border border-red-200">
                      <div className="font-medium text-red-800">Too Short</div>
                      <div className="text-red-600">&lt; 2 characters</div>
                      <div className="text-red-600">Rejected</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded border border-green-200">
                      <div className="font-medium text-green-800">Optimal</div>
                      <div className="text-green-600">3-50 characters</div>
                      <div className="text-green-600">Accepted</div>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                      <div className="font-medium text-yellow-800">Too Long</div>
                      <div className="text-yellow-600">&gt; 100 characters</div>
                      <div className="text-yellow-600">Rejected</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Text Cleaning Rules</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <strong>Remove after dash:</strong> <code className="bg-gray-100 px-2 py-1 rounded">/\s*-\s*.*$/</code>
                      <div className="text-gray-600">Example: "Company Name - Welcome" → "Company Name"</div>
                    </div>
                    <div>
                      <strong>Remove after pipe:</strong> <code className="bg-gray-100 px-2 py-1 rounded">/\s*\|\s*.*$/</code>
                      <div className="text-gray-600">Example: "Company Name | Home" → "Company Name"</div>
                    </div>
                    <div>
                      <strong>Remove after colon:</strong> <code className="bg-gray-100 px-2 py-1 rounded">/\s*:.*$/</code>
                      <div className="text-gray-600">Example: "Company Name: Services" → "Company Name"</div>
                    </div>
                    <div>
                      <strong>Remove prefixes:</strong> <code className="bg-gray-100 px-2 py-1 rounded">/^(Home|Welcome to|About)\s*/i</code>
                      <div className="text-gray-600">Example: "Welcome to Company Name" → "Company Name"</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}