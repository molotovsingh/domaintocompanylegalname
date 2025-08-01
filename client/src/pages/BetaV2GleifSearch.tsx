import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Building2, Globe, MapPin, Calendar, Shield, TrendingUp } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { toast } from '@/hooks/use-toast';

interface GLEIFCandidate {
  leiCode: string;
  legalName: string;
  entityStatus: string;
  legalForm?: string;
  jurisdiction: string;
  headquartersCountry?: string;
  headquartersCity?: string;
  nameMatchScore: number;
  fortune500Score: number;
  tldJurisdictionScore: number;
  entityComplexityScore: number;
  weightedTotalScore: number;
  selectionReason: string;
  registrationStatus: string;
  initialRegistrationDate?: string;
  lastUpdateDate?: string;
}

interface GLEIFSearchResult {
  searchRequest: {
    id: number;
    suspectedName: string;
    domain?: string;
    searchStatus: string;
    totalCandidates: number;
    createdAt: string;
  };
  candidates: GLEIFCandidate[];
}

export function BetaV2GleifSearch() {
  const [suspectedName, setSuspectedName] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null);

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (data: { suspectedName: string; domain?: string }) => {
      const response = await fetch('/api/beta/gleif-search/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Search failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.searchId) {
        setSelectedSearchId(data.searchId);
        queryClient.invalidateQueries({ queryKey: ['gleif-searches'] });
        toast({
          title: "Search completed",
          description: `Found ${data.totalMatches || 0} matching entities`
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Search failed", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Get search result
  const { data: searchResultResponse, isLoading: isLoadingResult } = useQuery({
    queryKey: [`/api/beta/gleif-search/search/${selectedSearchId}`],
    enabled: !!selectedSearchId,
    queryFn: async () => {
      const response = await fetch(`/api/beta/gleif-search/search/${selectedSearchId}`);
      if (!response.ok) throw new Error('Failed to fetch search result');
      const data = await response.json();
      return data.data || data; // Handle wrapped response
    }
  });
  
  const searchResult = searchResultResponse as GLEIFSearchResult;

  // Get recent searches
  const { data: recentSearches } = useQuery<Array<{
    id: number;
    suspectedName: string;
    domain?: string;
    totalCandidates: number;
    createdAt: string;
  }>>({
    queryKey: ['gleif-searches'],
    queryFn: async () => {
      const response = await fetch('/api/beta/gleif-search/searches');
      if (!response.ok) throw new Error('Failed to fetch searches');
      return response.json();
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!suspectedName.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter a company name to search",
        variant: "destructive"
      });
      return;
    }

    const searchData = {
      suspectedName: suspectedName.trim(),
      ...(domain.trim() && { domain: domain.trim() })
    };

    searchMutation.mutate(searchData);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    if (score >= 40) return 'outline';
    return 'destructive';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'default';
      case 'INACTIVE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" size="sm">
            ← Back to Main App
          </Button>
        </Link>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            GLEIF Entity Search (Beta V2)
          </CardTitle>
          <CardDescription>
            Search the Global Legal Entity Identifier Foundation database to find verified legal entities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="suspectedName">Company Name *</Label>
              <Input
                id="suspectedName"
                placeholder="e.g., Apple, Microsoft, Google"
                value={suspectedName}
                onChange={(e) => setSuspectedName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
              />
            </div>
            <div>
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                placeholder="e.g., apple.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
              />
            </div>
          </div>
          <Button 
            type="submit"
            disabled={!suspectedName.trim() || searchMutation.isPending}
            className="w-full md:w-auto"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching GLEIF Database...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Legal Entities
              </>
            )}
          </Button>
          </form>

          {searchMutation.error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                Search failed: {(searchMutation.error as any)?.message || 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {selectedSearchId && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            {searchResult && searchResult.candidates && searchResult.searchRequest && (
              <CardDescription>
                Found {searchResult.candidates.length} legal entities matching "{searchResult.searchRequest.suspectedName}"
                {searchResult.searchRequest.domain && ` for domain ${searchResult.searchRequest.domain}`}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingResult ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : searchResult && searchResult.candidates ? (
              <div className="space-y-4">
                {searchResult.candidates.map((candidate, index) => (
                  <Card key={candidate.leiCode} className="border-l-4" style={{
                    borderLeftColor: index === 0 ? '#10b981' : '#e5e7eb'
                  }}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            {candidate.legalName}
                          </h3>
                          <p className="text-sm text-muted-foreground">LEI: {candidate.leiCode}</p>
                        </div>
                        <div className="text-right">
                          <Badge className="text-lg px-3 py-1" variant={getScoreBadgeColor(candidate.weightedTotalScore)}>
                            Score: {candidate.weightedTotalScore}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">{candidate.selectionReason}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge variant={getStatusBadgeColor(candidate.entityStatus)}>
                            {candidate.entityStatus}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Legal Form</p>
                          <p className="font-medium">{candidate.legalForm || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Jurisdiction</p>
                          <p className="font-medium flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {candidate.jurisdiction}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Registration</p>
                          <Badge variant="outline">
                            {candidate.registrationStatus}
                          </Badge>
                        </div>
                      </div>

                      {candidate.headquartersCity && (
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                          <MapPin className="h-3 w-3" />
                          {candidate.headquartersCity}, {candidate.headquartersCountry}
                        </div>
                      )}

                      <Separator className="my-3" />

                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="text-center">
                          <p className="text-muted-foreground">Name Match</p>
                          <p className="font-semibold">{candidate.nameMatchScore}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Fortune 500</p>
                          <p className="font-semibold">{candidate.fortune500Score}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">TLD Match</p>
                          <p className="font-semibold">{candidate.tldJurisdictionScore}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-muted-foreground">Complexity</p>
                          <p className="font-semibold">{candidate.entityComplexityScore}%</p>
                        </div>
                      </div>

                      {candidate.lastUpdateDate && (
                        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last updated: {new Date(candidate.lastUpdateDate).toLocaleDateString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No results to display
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Searches */}
      {recentSearches && recentSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Searches</CardTitle>
            <CardDescription>
              View your previous GLEIF searches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex justify-between items-center p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => setSelectedSearchId(search.id)}
                >
                  <div>
                    <p className="font-medium">{search.suspectedName}</p>
                    <p className="text-sm text-muted-foreground">
                      {search.domain && `Domain: ${search.domain} • `}
                      {search.totalCandidates} candidates found
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {new Date(search.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}