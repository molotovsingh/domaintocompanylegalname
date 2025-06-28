import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Shield, Building, MapPin, Star, Clock, CheckCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GleifCandidate } from "@shared/schema";

interface GLEIFCandidatesModalProps {
  domainId: number | null;
  domain: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function GLEIFCandidatesModal({ domainId, domain, isOpen, onClose }: GLEIFCandidatesModalProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch GLEIF candidates for this domain
  const { data: candidates, isLoading } = useQuery<GleifCandidate[]>({
    queryKey: ['/api/domains', domainId, 'candidates'],
    enabled: !!domainId && isOpen,
  });

  // Mutation to select primary candidate
  const selectCandidateMutation = useMutation({
    mutationFn: async (leiCode: string) => {
      return apiRequest(`/api/domains/${domainId}/select-candidate`, 'POST', { leiCode });
    },
    onSuccess: () => {
      toast({
        title: "Primary selection updated",
        description: "The selected GLEIF candidate is now the primary choice for this domain.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Selection failed",
        description: error.message || "Failed to update primary candidate selection.",
        variant: "destructive",
      });
    }
  });

  const handleSelectCandidate = (leiCode: string) => {
    setSelectedCandidate(leiCode);
    selectCandidateMutation.mutate(leiCode);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case 'INACTIVE':
        return (
          <Badge variant="destructive">
            <Clock className="mr-1 h-3 w-3" />
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!domainId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5 text-blue-600" />
            GLEIF Candidates for {domain}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading GLEIF candidates...</p>
          </div>
        ) : !candidates || candidates.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No GLEIF candidates found</h3>
            <p className="text-sm text-gray-600">
              This domain has not been processed for GLEIF enhancement or no matches were found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Found {candidates.length} GLEIF candidate{candidates.length !== 1 ? 's' : ''} for verification
            </div>

            {candidates.map((candidate) => (
              <Card key={candidate.leiCode} className={`transition-all ${
                candidate.isPrimarySelection ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 mr-3">
                          {candidate.legalName}
                        </h3>
                        {candidate.isPrimarySelection && (
                          <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
                            <Star className="mr-1 h-3 w-3" />
                            Primary Selection
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Building className="mr-1 h-3 w-3" />
                          {candidate.legalForm || 'Unknown Form'}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="mr-1 h-3 w-3" />
                          {candidate.jurisdiction || 'Unknown Jurisdiction'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 mb-3">
                        {getStatusBadge(candidate.entityStatus || 'UNKNOWN')}
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {candidate.leiCode}
                        </code>
                      </div>

                      {candidate.entityCategory && (
                        <div className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Category:</span> {candidate.entityCategory}
                        </div>
                      )}
                    </div>

                    <div className="ml-6 text-right">
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">Weighted Score</div>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getScoreColor(candidate.weightedScore || 0)}`}
                              style={{ width: `${candidate.weightedScore || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{Math.round(candidate.weightedScore || 0)}%</span>
                        </div>
                      </div>

                      {candidate.gleifMatchScore && (
                        <div className="text-xs text-gray-500">
                          GLEIF Match: {Math.round(candidate.gleifMatchScore)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  {(candidate.domainTldScore || candidate.fortune500Score || candidate.nameMatchScore) && (
                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">TLD Match</div>
                        <div className="font-medium">{Math.round(candidate.domainTldScore || 0)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Fortune 500</div>
                        <div className="font-medium">{Math.round(candidate.fortune500Score || 0)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Name Match</div>
                        <div className="font-medium">{Math.round(candidate.nameMatchScore || 0)}%</div>
                      </div>
                    </div>
                  )}

                  {/* Selection Reason */}
                  {candidate.selectionReason && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xs text-blue-600 font-medium mb-1">Selection Reason</div>
                      <div className="text-sm text-blue-800">{candidate.selectionReason}</div>
                    </div>
                  )}

                  {/* Action Button */}
                  {!candidate.isPrimarySelection && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleSelectCandidate(candidate.leiCode)}
                        disabled={selectCandidateMutation.isPending || selectedCandidate === candidate.leiCode}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {selectCandidateMutation.isPending && selectedCandidate === candidate.leiCode ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                            Selecting...
                          </>
                        ) : (
                          <>
                            <Star className="mr-2 h-3 w-3" />
                            Make Primary
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}