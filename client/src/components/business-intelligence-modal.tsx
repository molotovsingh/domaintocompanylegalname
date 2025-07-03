
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Building2, Clock, Globe, TrendingUp, Users, Lightbulb } from "lucide-react";

interface BusinessIntelligenceModalProps {
  domainId: number | null;
  domain: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function BusinessIntelligenceModal({ domainId, domain, isOpen, onClose }: BusinessIntelligenceModalProps) {
  const { data: businessData, isLoading } = useQuery({
    queryKey: ["/api/business-intelligence", domainId],
    queryFn: () => {
      if (!domainId) return null;
      return fetch(`/api/business-intelligence/${domainId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch business intelligence');
          return res.json();
        });
    },
    enabled: !!domainId && isOpen,
  });

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Building2 className="mr-2 h-5 w-5" />
            Business Intelligence: {domain}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading business intelligence...</p>
          </div>
        ) : businessData ? (
          <div className="space-y-6">
            {/* Primary Business Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Business Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {businessData.primaryBusinessDescription && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Primary Business Description</h4>
                    <p className="text-gray-700">{businessData.primaryBusinessDescription}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {businessData.businessCategory && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Industry</h4>
                      <Badge variant="default">{businessData.businessCategory}</Badge>
                      {businessData.businessSubcategory && (
                        <Badge variant="outline" className="ml-2">{businessData.businessSubcategory}</Badge>
                      )}
                    </div>
                  )}
                  
                  {businessData.marketPosition && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Market Position</h4>
                      <Badge variant="secondary">{businessData.marketPosition}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Corporate Intelligence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Building2 className="mr-2 h-4 w-4" />
                  Corporate Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessData.corporateHeritage && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                        <Clock className="mr-1 h-3 w-3" />
                        Heritage
                      </h4>
                      <p className="text-gray-700">{businessData.corporateHeritage}</p>
                    </div>
                  )}
                  
                  {businessData.businessScale && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        Scale
                      </h4>
                      <p className="text-gray-700">{businessData.businessScale}</p>
                    </div>
                  )}
                  
                  {businessData.corporateStructure && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">Structure</h4>
                      <p className="text-gray-700">{businessData.corporateStructure}</p>
                    </div>
                  )}
                  
                  {businessData.geographicPresence && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1 flex items-center">
                        <Globe className="mr-1 h-3 w-3" />
                        Geographic Presence
                      </h4>
                      <p className="text-gray-700">{businessData.geographicPresence}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Content Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Content Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {businessData.heroSectionContent && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Hero Section Content</h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded">{businessData.heroSectionContent}</p>
                  </div>
                )}
                
                {businessData.aboutSectionSummary && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">About Section Summary</h4>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded">{businessData.aboutSectionSummary}</p>
                  </div>
                )}
                
                {businessData.businessFocusKeywords && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Key Business Terms</h4>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(businessData.businessFocusKeywords).map((keyword: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {businessData.contentQualityScore && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Content Quality Score</h4>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${businessData.contentQualityScore}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{businessData.contentQualityScore}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Matched Patterns */}
            {businessData.matchedPatterns && businessData.matchedPatterns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detected Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {businessData.matchedPatterns.map((pattern: any, index: number) => (
                      <div key={index} className="border rounded p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{pattern.patternType}</Badge>
                          <span className="text-sm text-gray-600">{pattern.matchConfidence}% confidence</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          <strong>Matched:</strong> "{pattern.matchedText}"
                        </p>
                        <p className="text-xs text-gray-600">
                          Found in: {pattern.contentLocation}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No business intelligence available</h3>
            <p className="text-sm text-gray-600">
              Business intelligence has not been extracted for this domain yet.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
