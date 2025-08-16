import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Globe, FileText, Award, FileSearch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ArbitrationResultsProps {
  requestId?: number;
  domain?: string;
  onProcessDomain?: (domain: string) => void;
}

interface RankedEntity {
  rank: number;
  claimNumber?: number;
  entityName?: string;
  entity?: string; // Old format compatibility
  leiCode?: string;
  LEICode?: string; // Old format compatibility
  confidence: number;
  reasoning: string;
  acquisitionGrade?: string;
  metadata?: {
    jurisdiction?: string;
    entityStatus?: string;
    legalForm?: string;
    headquarters?: {
      city?: string;
      country?: string;
    };
    hierarchyLevel?: string;
    hasParent?: boolean;
    lastUpdateDate?: string;
  };
}

interface Claim {
  claimNumber: number;
  claimType: 'llm_extracted' | 'gleif_candidate';
  entityName: string;
  leiCode?: string;
  confidence: number;
  source: string;
  metadata?: any;
}

interface ArbitrationResponse {
  success: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  rankedEntities?: RankedEntity[];
  claims?: Claim[];
  citations?: string[];
  reasoning?: string;
  processingTimeMs?: number;
}

export function ArbitrationResults({ requestId, domain, onProcessDomain }: ArbitrationResultsProps) {
  const [selectedEntity, setSelectedEntity] = useState<RankedEntity | null>(null);

  // Fetch arbitration results
  const { data: results, isLoading, error } = useQuery<ArbitrationResponse>({
    queryKey: ['/api/beta/arbitration/results', requestId],
    queryFn: async () => {
      if (!requestId) return { success: false } as ArbitrationResponse;
      const response = await fetch(`/api/beta/arbitration/results/${requestId}`);
      return response.json();
    },
    enabled: !!requestId,
    refetchInterval: (query) => {
      // Keep polling if still processing
      const status = query.state.data?.status;
      if (status === 'processing' || status === 'pending') {
        return 2000; // Poll every 2 seconds
      }
      return false; // Stop polling when completed
    }
  });

  // Handle test arbitration for a domain
  const handleTestArbitration = async () => {
    if (!domain) return;
    
    try {
      const response = await apiRequest('/api/beta/arbitration/test-sample', 'POST', {
        domain,
        entityName: domain.replace('.com', '').replace('.', ' ')
      });
      
      if (onProcessDomain) {
        onProcessDomain(domain);
      }
    } catch (error) {
      console.error('Failed to test arbitration:', error);
    }
  };

  const getGradeBadgeColor = (grade?: string) => {
    if (grade?.startsWith('A')) return 'bg-green-500';
    if (grade?.startsWith('B')) return 'bg-blue-500';
    if (grade?.startsWith('C')) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-500';
      case 'INACTIVE': return 'bg-red-500';
      case 'PENDING': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  if (!requestId && !domain) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          Select a domain to view arbitration results
        </CardContent>
      </Card>
    );
  }

  if (isLoading || results?.status === 'processing') {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Processing arbitration...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || results?.status === 'failed') {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center space-x-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <span>{results?.error || 'Failed to load arbitration results'}</span>
          </div>
          {domain && (
            <div className="mt-4 text-center">
              <Button onClick={handleTestArbitration}>Retry Arbitration</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const rankedEntities = results?.rankedEntities || [];
  const claims = results?.claims || [];
  const citations = results?.citations || [];



  // Find the website claim (Claim 0) if it exists - handle snake_case from backend
  const websiteClaim = claims.find((c: any) => c.claim_number === 0 || c.claimNumber === 0);
  
  // Transform snake_case to camelCase for website claim
  const normalizedWebsiteClaim = websiteClaim ? {
    claimNumber: (websiteClaim as any).claim_number || (websiteClaim as any).claimNumber,
    claimType: (websiteClaim as any).claim_type || (websiteClaim as any).claimType,
    entityName: (websiteClaim as any).entity_name || (websiteClaim as any).entityName,
    leiCode: (websiteClaim as any).lei_code || (websiteClaim as any).leiCode,
    confidence: (websiteClaim as any).confidence_score || (websiteClaim as any).confidence || 0,
    source: (websiteClaim as any).source,
    metadata: (websiteClaim as any).metadata
  } : null;

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      {domain && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <CardTitle>{domain}</CardTitle>
              </div>
              <Badge variant="outline">
                {claims.length} Claims · {rankedEntities.length} Ranked
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Website Context - What the website claims to be */}
      {normalizedWebsiteClaim && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-sm text-amber-800">Website Claims To Be</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-lg font-semibold text-amber-900">
                {normalizedWebsiteClaim.entityName || 'Unknown Entity'}
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                  {normalizedWebsiteClaim.source || 'Website Extraction'}
                </Badge>
                <span className="text-amber-700">
                  Confidence: {(normalizedWebsiteClaim.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                This is what the website identifies itself as. GLEIF entities below are verified matches.
              </p>
              
              {/* Evidence Trail Display */}
              {normalizedWebsiteClaim.metadata?.evidenceTrail && (
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <FileSearch className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">Evidence Trail</span>
                    <Badge variant="secondary" className="text-xs">
                      {normalizedWebsiteClaim.metadata.evidenceTrail.entitiesFound?.length || 0} entities found
                    </Badge>
                  </div>
                  
                  {normalizedWebsiteClaim.metadata.evidenceTrail.entitiesFound?.map((entity: any, idx: number) => (
                    <div key={idx} className="mb-3 p-3 bg-white rounded-lg border border-amber-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">{entity.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {(entity.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            <span className="font-medium">Source:</span> {entity.source}
                          </div>
                          {entity.rawValue && entity.rawValue !== entity.name && (
                            <div className="mt-1 text-xs text-gray-500">
                              <span className="font-medium">Raw:</span> "{entity.rawValue}"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-xs text-amber-600 mt-2">
                    Extraction method: {normalizedWebsiteClaim.metadata.evidenceTrail.extractionMethod || 'unknown'}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Entity Highlight */}
      {rankedEntities[0] && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-yellow-500" />
                <span>Primary Acquisition Target</span>
              </CardTitle>
              <Badge className={getGradeBadgeColor(rankedEntities[0].acquisitionGrade)}>
                Grade {rankedEntities[0].acquisitionGrade}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{rankedEntities[0].entityName || rankedEntities[0].entity || 'Unknown Entity'}</h2>
                  {rankedEntities[0].claimNumber !== undefined && (
                    <span className="text-sm text-gray-500">
                      {rankedEntities[0].claimNumber === 0 
                        ? 'Extracted from website' 
                        : `GLEIF verified entity (Claim ${rankedEntities[0].claimNumber})`
                      }
                    </span>
                  )}
                </div>
                {(rankedEntities[0].leiCode || rankedEntities[0].LEICode) && (
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    LEI: {rankedEntities[0].leiCode || rankedEntities[0].LEICode}
                  </code>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {rankedEntities[0].metadata?.jurisdiction && (
                  <Badge variant="outline">
                    📍 {rankedEntities[0].metadata.jurisdiction}
                  </Badge>
                )}
                {rankedEntities[0].metadata?.entityStatus && (
                  <Badge className={getStatusBadgeColor(rankedEntities[0].metadata.entityStatus)}>
                    {rankedEntities[0].metadata.entityStatus}
                  </Badge>
                )}
                {rankedEntities[0].metadata?.legalForm && (
                  <Badge variant="outline">
                    {rankedEntities[0].metadata.legalForm}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Confidence Score</span>
                  <span className="font-medium">{(rankedEntities[0].confidence * 100).toFixed(0)}%</span>
                </div>
                <Progress value={rankedEntities[0].confidence * 100} />
              </div>

              <p className="text-sm text-gray-600">{rankedEntities[0].reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Different Views */}
      <Tabs defaultValue="ranked" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ranked">Ranked Entities</TabsTrigger>
          <TabsTrigger value="claims">All Claims</TabsTrigger>
          <TabsTrigger value="reasoning">Arbitration Logic</TabsTrigger>
        </TabsList>

        {/* Ranked Entities Tab */}
        <TabsContent value="ranked" className="space-y-4">
          {rankedEntities.slice(1).map((entity: RankedEntity) => (
            <Card 
              key={entity.rank} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedEntity(entity)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                      <span className="font-bold">#{entity.rank}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{entity.entityName || entity.entity || 'Unknown Entity'}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {entity.claimNumber !== undefined && (
                          <span className="text-xs text-gray-500">
                            {entity.claimNumber === 0 ? 'From website extraction' : `GLEIF verified entity #${entity.claimNumber}`}
                          </span>
                        )}
                        {(entity.leiCode || entity.LEICode) && (
                          <span className="text-xs text-gray-500">LEI: {entity.leiCode || entity.LEICode}</span>
                        )}
                        {entity.metadata?.jurisdiction && (
                          <Badge variant="outline" className="text-xs">
                            {entity.metadata.jurisdiction}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getGradeBadgeColor(entity.acquisitionGrade)}>
                      {entity.acquisitionGrade}
                    </Badge>
                    <div className="text-right">
                      <div className="text-sm font-medium">{(entity.confidence * 100).toFixed(0)}%</div>
                      <div className="text-xs text-gray-500">confidence</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Claims Tab */}
        <TabsContent value="claims" className="space-y-4">
          <div className="grid gap-2">
            {claims.map((claim: Claim) => (
              <Card key={claim.claimNumber}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant={claim.claimType === 'llm_extracted' ? 'default' : 'outline'}>
                        {claim.claimNumber === 0 ? 'Website Entity' : `GLEIF Entity ${claim.claimNumber}`}
                      </Badge>
                      <span className="font-medium">{claim.entityName}</span>
                      {claim.leiCode && (
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {claim.leiCode}
                        </code>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{claim.source}</Badge>
                      <span className="text-sm text-gray-500">
                        {(claim.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Reasoning Tab */}
        <TabsContent value="reasoning" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Arbitration Reasoning</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                {results?.reasoning || 'No detailed reasoning available'}
              </p>
              
              {citations.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Sources & Citations</h4>
                  <div className="space-y-2">
                    {citations.map((citation: string, idx: number) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
                        <a 
                          href={citation} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {citation}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results?.processingTimeMs && (
                <div className="mt-4 pt-4 border-t">
                  <span className="text-xs text-gray-500">
                    Processing time: {results.processingTimeMs}ms
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Entity Details Modal */}
      {selectedEntity && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Entity Details: {selectedEntity.entityName}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Rank</dt>
                <dd>#{selectedEntity.rank}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Grade</dt>
                <dd>{selectedEntity.acquisitionGrade}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">LEI Code</dt>
                <dd className="font-mono">{selectedEntity.leiCode || 'N/A'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Confidence</dt>
                <dd>{(selectedEntity.confidence * 100).toFixed(1)}%</dd>
              </div>
              {selectedEntity.metadata?.headquarters && (
                <div className="col-span-2">
                  <dt className="font-medium text-gray-500">Headquarters</dt>
                  <dd>
                    {selectedEntity.metadata.headquarters.city}, {selectedEntity.metadata.headquarters.country}
                  </dd>
                </div>
              )}
              <div className="col-span-2">
                <dt className="font-medium text-gray-500">Reasoning</dt>
                <dd className="mt-1">{selectedEntity.reasoning}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}