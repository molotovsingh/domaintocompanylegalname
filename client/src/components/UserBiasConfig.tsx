import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Save, RefreshCw, Globe, Building2, Calendar, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UserBias {
  profileName: string;
  jurisdictionPrimary: string;
  jurisdictionSecondary: string[];
  preferParent: boolean;
  parentWeight: number;
  jurisdictionWeight: number;
  entityStatusWeight: number;
  legalFormWeight: number;
  recencyWeight: number;
  industryFocus?: {
    technology?: boolean;
    finance?: boolean;
    healthcare?: boolean;
    manufacturing?: boolean;
    retail?: boolean;
  };
}

const defaultBias: UserBias = {
  profileName: 'Default Profile',
  jurisdictionPrimary: 'US',
  jurisdictionSecondary: ['GB', 'DE'],
  preferParent: true,
  parentWeight: 0.4,
  jurisdictionWeight: 0.3,
  entityStatusWeight: 0.1,
  legalFormWeight: 0.05,
  recencyWeight: 0.05,
  industryFocus: {
    technology: true,
    finance: false,
    healthcare: false,
    manufacturing: false,
    retail: false
  }
};

const jurisdictions = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'IN', label: 'India' },
  { value: 'SG', label: 'Singapore' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'AU', label: 'Australia' },
  { value: 'CA', label: 'Canada' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'IE', label: 'Ireland' },
  { value: 'CH', label: 'Switzerland' }
];

export function UserBiasConfig() {
  const [bias, setBias] = useState<UserBias>(defaultBias);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['/api/beta/arbitration/bias/profiles'],
    queryFn: async () => {
      const response = await fetch('/api/beta/arbitration/bias/profiles');
      const data = await response.json();
      return data.profiles || [];
    }
  });

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async (biasData: UserBias) => {
      return apiRequest('POST', '/api/beta/arbitration/bias/configure', biasData);
    },
    onSuccess: () => {
      toast({
        title: 'Profile Saved',
        description: 'Your arbitration preferences have been saved successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/beta/arbitration/bias/profiles'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleSaveProfile = () => {
    saveMutation.mutate(bias);
  };

  const handleLoadProfile = (profile: any) => {
    setBias({
      profileName: profile.profile_name,
      jurisdictionPrimary: profile.jurisdiction_primary,
      jurisdictionSecondary: profile.jurisdiction_secondary || [],
      preferParent: profile.prefer_parent,
      parentWeight: profile.parent_weight,
      jurisdictionWeight: profile.jurisdiction_weight,
      entityStatusWeight: profile.entity_status_weight || 0.1,
      legalFormWeight: profile.legal_form_weight || 0.05,
      recencyWeight: profile.recency_weight || 0.05,
      industryFocus: profile.industry_focus || defaultBias.industryFocus
    });
    setSelectedProfile(profile.id);
  };

  const handleSecondaryJurisdiction = (value: string, add: boolean) => {
    if (add && !bias.jurisdictionSecondary.includes(value)) {
      setBias({ ...bias, jurisdictionSecondary: [...bias.jurisdictionSecondary, value] });
    } else if (!add) {
      setBias({ 
        ...bias, 
        jurisdictionSecondary: bias.jurisdictionSecondary.filter(j => j !== value) 
      });
    }
  };

  const totalWeight = bias.parentWeight + bias.jurisdictionWeight + 
                      bias.entityStatusWeight + bias.legalFormWeight + bias.recencyWeight;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Arbitration Preferences</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBias(defaultBias)}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button 
                size="sm"
                onClick={handleSaveProfile}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                Save Profile
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Settings</TabsTrigger>
          <TabsTrigger value="weights">Ranking Weights</TabsTrigger>
          <TabsTrigger value="industry">Industry Focus</TabsTrigger>
          <TabsTrigger value="profiles">Saved Profiles</TabsTrigger>
        </TabsList>

        {/* Basic Settings Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Profile Name */}
              <div className="space-y-2">
                <Label htmlFor="profileName">Profile Name</Label>
                <Input
                  id="profileName"
                  value={bias.profileName}
                  onChange={(e) => setBias({ ...bias, profileName: e.target.value })}
                  placeholder="Enter profile name..."
                />
              </div>

              {/* Primary Jurisdiction */}
              <div className="space-y-2">
                <Label htmlFor="primaryJurisdiction">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Primary Jurisdiction
                </Label>
                <Select 
                  value={bias.jurisdictionPrimary}
                  onValueChange={(value) => setBias({ ...bias, jurisdictionPrimary: value })}
                >
                  <SelectTrigger id="primaryJurisdiction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jurisdictions.map(j => (
                      <SelectItem key={j.value} value={j.value}>
                        {j.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Secondary Jurisdictions */}
              <div className="space-y-2">
                <Label>Secondary Jurisdictions</Label>
                <div className="flex flex-wrap gap-2">
                  {jurisdictions.map(j => (
                    <Badge
                      key={j.value}
                      variant={bias.jurisdictionSecondary.includes(j.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleSecondaryJurisdiction(
                        j.value, 
                        !bias.jurisdictionSecondary.includes(j.value)
                      )}
                    >
                      {j.value}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Prefer Parent Entities */}
              <div className="flex items-center justify-between">
                <Label htmlFor="preferParent" className="flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Prefer Parent Entities for Acquisition
                </Label>
                <Switch
                  id="preferParent"
                  checked={bias.preferParent}
                  onCheckedChange={(checked) => setBias({ ...bias, preferParent: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ranking Weights Tab */}
        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Weight Balance Indicator */}
              {Math.abs(totalWeight - 1.0) > 0.01 && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Total weight: {(totalWeight * 100).toFixed(0)}% (should be 100%)
                  </p>
                </div>
              )}

              {/* Parent Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Parent Entity Weight</Label>
                  <span className="text-sm font-medium">{(bias.parentWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[bias.parentWeight * 100]}
                  onValueChange={([value]) => setBias({ ...bias, parentWeight: value / 100 })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Jurisdiction Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Jurisdiction Alignment Weight</Label>
                  <span className="text-sm font-medium">{(bias.jurisdictionWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[bias.jurisdictionWeight * 100]}
                  onValueChange={([value]) => setBias({ ...bias, jurisdictionWeight: value / 100 })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Entity Status Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Entity Status Weight</Label>
                  <span className="text-sm font-medium">{(bias.entityStatusWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[bias.entityStatusWeight * 100]}
                  onValueChange={([value]) => setBias({ ...bias, entityStatusWeight: value / 100 })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Legal Form Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Legal Form Weight</Label>
                  <span className="text-sm font-medium">{(bias.legalFormWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[bias.legalFormWeight * 100]}
                  onValueChange={([value]) => setBias({ ...bias, legalFormWeight: value / 100 })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Recency Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Registration Recency Weight</Label>
                  <span className="text-sm font-medium">{(bias.recencyWeight * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[bias.recencyWeight * 100]}
                  onValueChange={([value]) => setBias({ ...bias, recencyWeight: value / 100 })}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Industry Focus Tab */}
        <TabsContent value="industry" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-sm text-gray-600">
                Select industries of interest for acquisition research:
              </p>
              
              <div className="space-y-3">
                {Object.entries(bias.industryFocus || {}).map(([industry, enabled]) => (
                  <div key={industry} className="flex items-center justify-between">
                    <Label htmlFor={industry} className="capitalize">
                      {industry}
                    </Label>
                    <Switch
                      id={industry}
                      checked={enabled as boolean}
                      onCheckedChange={(checked) => setBias({
                        ...bias,
                        industryFocus: {
                          ...bias.industryFocus,
                          [industry]: checked
                        }
                      })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {profilesLoading ? (
                <div className="text-center py-4">Loading profiles...</div>
              ) : profiles && profiles.length > 0 ? (
                <div className="space-y-2">
                  {profiles.map((profile: any) => (
                    <div
                      key={profile.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedProfile === profile.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleLoadProfile(profile)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{profile.profile_name}</h4>
                          <p className="text-sm text-gray-600">
                            Primary: {profile.jurisdiction_primary} | 
                            Parent Priority: {profile.prefer_parent ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <Badge variant={selectedProfile === profile.id ? 'default' : 'outline'}>
                          {selectedProfile === profile.id ? 'Active' : 'Load'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">No saved profiles yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Primary Jurisdiction:</span>
              <span className="ml-2 font-medium">{bias.jurisdictionPrimary}</span>
            </div>
            <div>
              <span className="text-gray-600">Prefer Parent:</span>
              <span className="ml-2 font-medium">{bias.preferParent ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Weight:</span>
              <span className={`ml-2 font-medium ${Math.abs(totalWeight - 1.0) > 0.01 ? 'text-yellow-600' : 'text-green-600'}`}>
                {(totalWeight * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Active Industries:</span>
              <span className="ml-2 font-medium">
                {Object.entries(bias.industryFocus || {})
                  .filter(([_, enabled]) => enabled)
                  .map(([industry]) => industry)
                  .join(', ') || 'None'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}