
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, ChevronRight, Copy, Download, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface RawGLEIFDisplayProps {
  result: any;
  loading: boolean;
  error?: string;
}

export const RawGLEIFDisplay: React.FC<RawGLEIFDisplayProps> = ({ result, loading, error }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Extracting complete GLEIF data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <XCircle className="mr-2 h-5 w-5" />
            GLEIF API Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          {result?.technicalDetails?.troubleshooting && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-yellow-800">
                💡 Troubleshooting: {result.technicalDetails.troubleshooting}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    // You could add a toast notification here if needed
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
          GLEIF Raw Data Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="formatted" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="formatted">📊 Formatted View</TabsTrigger>
            <TabsTrigger value="raw">🔧 Complete Raw JSON</TabsTrigger>
            <TabsTrigger value="technical">⚙️ Technical Details</TabsTrigger>
          </TabsList>

          <TabsContent value="formatted" className="space-y-4">
            {result?.rawApiResponse?.data && (
              <>
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.totalRecords || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Entities</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {result.processingTime}ms
                    </div>
                    <div className="text-sm text-gray-600">Processing Time</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.responseSize ? Math.round(result.responseSize / 1024) : 0}KB
                    </div>
                    <div className="text-sm text-gray-600">Response Size</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {result.gleifApiVersion || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">API Version</div>
                  </div>
                </div>

                {/* Entity Cards */}
                <div className="space-y-4">
                  {result.rawApiResponse.data.map((entity: any, index: number) => (
                    <Card key={index} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {entity.attributes.entity.legalName.name}
                            </h3>
                            <div className="flex space-x-2 mt-2">
                              <Badge variant="outline">
                                {entity.attributes.entity.status}
                              </Badge>
                              <Badge variant="secondary">
                                {entity.attributes.lei}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            onClick={() => copyToClipboard(entity)}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy Entity JSON
                          </Button>
                        </div>
                      </CardHeader>

                      <CardContent>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              className="w-full justify-between"
                              onClick={() => toggleSection(`entity-${index}`)}
                            >
                              <span>View Complete Entity Data</span>
                              {expandedSections.has(`entity-${index}`) ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-3">
                              <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                                <code>{JSON.stringify(entity, null, 2)}</code>
                              </pre>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="raw" className="space-y-4">
            {/* Complete Raw JSON Display */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Complete GLEIF API Response</CardTitle>
                  <div className="space-x-2">
                    <Button
                      onClick={() => copyToClipboard(result)}
                      variant="default"
                      size="sm"
                    >
                      <Copy className="mr-1 h-4 w-4" />
                      Copy All JSON
                    </Button>
                    <Button
                      onClick={() => downloadJSON(result, 'gleif-complete-data')}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="mr-1 h-4 w-4" />
                      Download JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                  <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
              </CardContent>
            </Card>

            {/* Individual Data Sections */}
            <div className="space-y-4">
              {/* Raw API Response */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">rawApiResponse</CardTitle>
                    <Button
                      onClick={() => copyToClipboard(result.rawApiResponse)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
                    <code>{JSON.stringify(result.rawApiResponse, null, 2)}</code>
                  </pre>
                </CardContent>
              </Card>

              {/* HTTP Headers */}
              {result.httpHeaders && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">httpHeaders</CardTitle>
                      <Button
                        onClick={() => copyToClipboard(result.httpHeaders)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
                      <code>{JSON.stringify(result.httpHeaders, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Meta Data */}
              {result.metaData && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">metaData</CardTitle>
                      <Button
                        onClick={() => copyToClipboard(result.metaData)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
                      <code>{JSON.stringify(result.metaData, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Request Details */}
              {result.requestDetails && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-lg">requestDetails</CardTitle>
                      <Button
                        onClick={() => copyToClipboard(result.requestDetails)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-4 rounded-lg text-xs overflow-auto max-h-64 border">
                      <code>{JSON.stringify(result.requestDetails, null, 2)}</code>
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="technical" className="space-y-4">
            {/* Technical Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">API Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base URL:</span>
                        <span className="font-mono text-xs">{result.technicalDetails?.apiUrl}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Search Type:</span>
                        <span>{result.technicalDetails?.searchType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">API Version:</span>
                        <span>{result.gleifApiVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Capture Method:</span>
                        <span>{result.technicalDetails?.captureMethod}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Data Integrity</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Data Integrity:</span>
                        <span>{result.technicalDetails?.dataIntegrity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Response Size:</span>
                        <span>{result.responseSize} bytes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Processing Time:</span>
                        <span>{result.processingTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Records:</span>
                        <span>{result.totalRecords}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Included Sections Analysis */}
            {result.technicalDetails?.includedSections && (
              <Card>
                <CardHeader>
                  <CardTitle>Response Structure Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(result.technicalDetails.includedSections).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                        <div className="text-lg">
                          {value ? '✅' : '❌'}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{key}</div>
                          <div className="text-xs text-gray-600">
                            {value ? 'Present' : 'Missing'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
