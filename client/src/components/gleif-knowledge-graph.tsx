import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, Share2, Download, Filter, ArrowRight, ExternalLink, Globe, Building2, Users, TrendingUp, MapPin, Calendar, Hash, Link as LinkIcon, Network } from 'lucide-react';

interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: 'entity' | 'domain' | 'jurisdiction' | 'industry';
  data: any;
  size: number;
  color: string;
}

interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'owns' | 'subsidiary' | 'maps_to' | 'located_in' | 'operates_in';
  weight: number;
}

interface EntityIntelligence {
  entity: any;
  domainMappings: any[];
  relationships: any[];
  discoveryHistory: any;
}

export default function GLEIFKnowledgeGraph() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<KnowledgeGraphNode | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }>({ nodes: [], edges: [] });
  const [activeDemo, setActiveDemo] = useState<'search' | 'visualization' | 'intelligence' | 'hierarchy'>('search');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch intelligence data for search suggestions
  const { data: searchSuggestions } = useQuery({
    queryKey: ['/api/intelligence/search', searchTerm],
    enabled: searchTerm.length > 2,
    queryFn: async () => {
      const response = await fetch(`/api/intelligence/search?q=${encodeURIComponent(searchTerm)}`);
      return response.json();
    }
  });

  // Fetch entity intelligence for selected entity
  const { data: entityIntelligence } = useQuery<EntityIntelligence>({
    queryKey: ['/api/intelligence/entity', selectedNode?.id],
    enabled: selectedNode?.type === 'entity' && !!selectedNode?.id,
    queryFn: async () => {
      const response = await fetch(`/api/intelligence/entity/${selectedNode?.id}`);
      return response.json();
    }
  });

  // Generate demo knowledge graph data
  useEffect(() => {
    generateDemoGraph();
  }, []);

  const generateDemoGraph = () => {
    // Demo nodes representing accumulated GLEIF intelligence
    const nodes: KnowledgeGraphNode[] = [
      {
        id: 'apple-inc',
        label: 'Apple Inc.',
        type: 'entity',
        data: { lei: '549300QL3ULKHN32OM67', jurisdiction: 'US', status: 'ACTIVE', discoveryFreq: 47 },
        size: 30,
        color: '#4A90E2'
      },
      {
        id: 'apple-europe',
        label: 'Apple Europe Ltd',
        type: 'entity',
        data: { lei: '213800QILIUP4CSUZ214', jurisdiction: 'IE', status: 'ACTIVE', discoveryFreq: 12 },
        size: 20,
        color: '#7ED321'
      },
      {
        id: 'apple-com',
        label: 'apple.com',
        type: 'domain',
        data: { confidence: 95, mappings: 3 },
        size: 15,
        color: '#F5A623'
      },
      {
        id: 'microsoft-corp',
        label: 'Microsoft Corporation',
        type: 'entity',
        data: { lei: '549300FX2LBRA1XYWE41', jurisdiction: 'US', status: 'ACTIVE', discoveryFreq: 32 },
        size: 28,
        color: '#4A90E2'
      },
      {
        id: 'us-jurisdiction',
        label: 'United States',
        type: 'jurisdiction',
        data: { entityCount: 127, domainCount: 89 },
        size: 25,
        color: '#BD10E0'
      },
      {
        id: 'tech-industry',
        label: 'Technology',
        type: 'industry',
        data: { entityCount: 45 },
        size: 20,
        color: '#50E3C2'
      }
    ];

    // Demo edges representing relationships
    const edges: KnowledgeGraphEdge[] = [
      {
        id: 'apple-subsidiary',
        source: 'apple-inc',
        target: 'apple-europe',
        label: 'Subsidiary',
        type: 'subsidiary',
        weight: 0.9
      },
      {
        id: 'apple-domain',
        source: 'apple-inc',
        target: 'apple-com',
        label: 'Maps to (95%)',
        type: 'maps_to',
        weight: 0.95
      },
      {
        id: 'apple-jurisdiction',
        source: 'apple-inc',
        target: 'us-jurisdiction',
        label: 'Located in',
        type: 'located_in',
        weight: 1.0
      },
      {
        id: 'apple-industry',
        source: 'apple-inc',
        target: 'tech-industry',
        label: 'Operates in',
        type: 'operates_in',
        weight: 0.8
      }
    ];

    setGraphData({ nodes, edges });
  };

  // Simple canvas-based graph visualization
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Draw edges first
    graphData.edges.forEach((edge) => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        ctx.beginPath();
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = edge.weight * 3;

        // Simple positioning (circular layout)
        const sourceAngle = (graphData.nodes.indexOf(sourceNode) / graphData.nodes.length) * 2 * Math.PI;
        const targetAngle = (graphData.nodes.indexOf(targetNode) / graphData.nodes.length) * 2 * Math.PI;

        const sourceX = centerX + Math.cos(sourceAngle) * 120;
        const sourceY = centerY + Math.sin(sourceAngle) * 120;
        const targetX = centerX + Math.cos(targetAngle) * 120;
        const targetY = centerY + Math.sin(targetAngle) * 120;

        ctx.moveTo(sourceX, sourceY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
      }
    });

    // Draw nodes
    graphData.nodes.forEach((node, index) => {
      const angle = (index / graphData.nodes.length) * 2 * Math.PI;
      const x = centerX + Math.cos(angle) * 120;
      const y = centerY + Math.sin(angle) * 120;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, node.size / 2, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw node label
      ctx.fillStyle = '#333';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, x, y + node.size / 2 + 15);
    });
  }, [graphData]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    // Simulate finding and highlighting entity in graph
    const foundNode = graphData.nodes.find(n => 
      n.label.toLowerCase().includes(term.toLowerCase())
    );
    if (foundNode) {
      setSelectedNode(foundNode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">GLEIF Knowledge Graph Demo</h2>
          <p className="text-gray-600">Interactive visualization of accumulated entity intelligence</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-200">
          Demo Mode - {graphData.nodes.length} Entities Loaded
        </Badge>
      </div>

      {/* Demo Mode Selector */}
      <Tabs value={activeDemo} onValueChange={(value) => setActiveDemo(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Smart Search
          </TabsTrigger>
          <TabsTrigger value="visualization" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Graph Viz
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Entity Intel
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Hierarchies
          </TabsTrigger>
        </TabsList>

        {/* Smart Search & Disambiguation Demo */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Intelligent Entity Search & Disambiguation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="Search entities, domains, or LEI codes... (try 'Apple')"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              </div>

              {searchTerm && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-700">Smart Suggestions:</h4>
                  <div className="grid gap-2">
                    {graphData.nodes
                      .filter(n => n.label.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(node => (
                        <div 
                          key={node.id}
                          className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                          onClick={() => setSelectedNode(node)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {node.type === 'entity' && <Building2 className="h-4 w-4 text-blue-500" />}
                              {node.type === 'domain' && <Globe className="h-4 w-4 text-orange-500" />}
                              <span className="font-medium">{node.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {node.type}
                              </Badge>
                              {node.data.discoveryFreq && (
                                <Badge variant="secondary" className="text-xs">
                                  Seen {node.data.discoveryFreq}x
                                </Badge>
                              )}
                            </div>
                          </div>
                          {node.type === 'entity' && (
                            <div className="mt-1 text-sm text-gray-600">
                              LEI: {node.data.lei} • {node.data.jurisdiction} • {node.data.status}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">💡 Search Intelligence Features:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Fuzzy Matching:</strong> Find "Appel" → Apple Inc.</li>
                  <li>• <strong>LEI Resolution:</strong> Search by LEI code for exact matches</li>
                  <li>• <strong>Domain Intelligence:</strong> apple.com → Shows all mapped entities</li>
                  <li>• <strong>Frequency Ranking:</strong> Most-discovered entities ranked higher</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactive Network Visualization */}
        <TabsContent value="visualization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Interactive Knowledge Graph Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  className="border rounded-lg bg-gray-50"
                  style={{ width: '100%', height: '400px' }}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Legal Entities</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span>Domains</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span>Jurisdictions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                    <span>Industries</span>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">🌐 Visualization Capabilities:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• <strong>Interactive Navigation:</strong> Click nodes to explore connections</li>
                    <li>• <strong>Force-Directed Layout:</strong> Related entities cluster together</li>
                    <li>• <strong>Filtering:</strong> Show/hide by entity type, jurisdiction, industry</li>
                    <li>• <strong>Zoom & Pan:</strong> Navigate large corporate networks</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Intelligence Explorer */}
        <TabsContent value="intelligence" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Deep Entity Intelligence Explorer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{selectedNode.label}</h3>
                      <p className="text-gray-600">
                        {selectedNode.type === 'entity' && `LEI: ${selectedNode.data.lei}`}
                      </p>
                    </div>
                    <Badge variant="outline">
                      Discovered {selectedNode.data.discoveryFreq || 1} times
                    </Badge>
                  </div>

                  {selectedNode.type === 'entity' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">Location</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            Jurisdiction: {selectedNode.data.jurisdiction}<br/>
                            Status: {selectedNode.data.status}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">Domain Mappings</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            3 domains mapped<br/>
                            Avg confidence: 87%
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Relationships</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            2 subsidiaries<br/>
                            1 parent company
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-purple-900 mb-2">🧠 Intelligence Features:</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• <strong>Discovery History:</strong> When/how entity was first found</li>
                      <li>• <strong>Confidence Tracking:</strong> Quality scores for all mappings</li>
                      <li>• <strong>Relationship Discovery:</strong> Auto-detected corporate structures</li>
                      <li>• <strong>Data Freshness:</strong> Last GLEIF sync timestamps</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an entity from search or visualization to explore intelligence</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Corporate Hierarchy Explorer */}
        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Corporate Hierarchy Discovery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="text-lg font-bold text-blue-600">Apple Inc. (US)</div>
                      <div className="text-sm text-gray-500">Parent Entity • LEI: 549300QL3ULKHN32OM67</div>
                    </div>

                    <div className="flex justify-center items-center mb-4">
                      <div className="w-px h-8 bg-gray-300"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-800">Apple Europe Ltd</div>
                        <div className="text-sm text-green-600">Ireland • LEI: 213800QILIUP4CSUZ214</div>
                        <Badge variant="outline" className="mt-1 text-xs">Subsidiary</Badge>
                      </div>

                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-800">Apple Asia Pacific</div>
                        <div className="text-sm text-green-600">Singapore • LEI: 213800ABC123XYZ789</div>
                        <Badge variant="outline" className="mt-1 text-xs">Subsidiary</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-medium text-indigo-900 mb-2">🏢 Hierarchy Discovery Features:</h4>
                  <ul className="text-sm text-indigo-800 space-y-1">
                    <li>• <strong>Auto-Detection:</strong> Discovers parent-subsidiary relationships</li>
                    <li>• <strong>Geographic Analysis:</strong> Maps international corporate structures</li>
                    <li>• <strong>Ownership Tracking:</strong> Identifies beneficial ownership chains</li>
                    <li>• <strong>Compliance Ready:</strong> Export for regulatory reporting</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <Button onClick={() => handleSearch('Apple')} variant="outline">
          Try Demo Search
        </Button>
        <Button onClick={generateDemoGraph} variant="outline">
          Refresh Graph
        </Button>
        <Button className="bg-green-600 hover:bg-green-700">
          Enable Knowledge Graph
        </Button>
      </div>
    </div>
  );
}