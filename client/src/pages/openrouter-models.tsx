import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  useCase: string[];
  priority: number;
  maxTokens: number;
  temperature: number;
  costLimit?: number;
  enabled: boolean;
}

interface ModelsResponse {
  success: boolean;
  models: ModelConfig[];
  strategies: string[];
}

export default function OpenRouterModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [strategy, setStrategy] = useState('priorityBased');
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current configuration
  const { data, isLoading, error } = useQuery<ModelsResponse>({
    queryKey: ['/api/openrouter/models/config'],
  });

  // Update configuration mutation
  const updateConfig = useMutation({
    mutationFn: async (updates: { models: ModelConfig[], strategy: string }) => {
      try {
        const responses = await Promise.all(
          updates.models.map(async (model) => {
            const response = await fetch('/api/openrouter/models/update', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                modelId: model.id,
                updates: {
                  enabled: model.enabled,
                  priority: model.priority
                }
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Failed to update model ${model.id}`);
            }

            return response.json();
          })
        );
        return responses;
      } catch (error) {
        console.error('Update config error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Model settings have been updated successfully.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/openrouter/models/config'] });
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    }
  });

  // Initialize models when data loads
  useEffect(() => {
    if (data?.models) {
      setModels(data.models);
    }
  }, [data]);

  const handleModelToggle = (modelId: string, checked: boolean) => {
    setModels(prev => prev.map(model => 
      model.id === modelId ? { ...model, enabled: checked } : model
    ));
    setHasChanges(true);
  };

  const handlePriorityChange = (modelId: string, priority: string) => {
    const priorityNum = parseInt(priority, 10);
    if (!isNaN(priorityNum) && priorityNum >= 1 && priorityNum <= 10) {
      setModels(prev => prev.map(model => 
        model.id === modelId ? { ...model, priority: priorityNum } : model
      ));
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    try {
      updateConfig.mutate({ models, strategy });
    } catch (error) {
      console.error('Save handler error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate save operation",
        variant: "destructive",
      });
    }
  };

  // Sort models by priority for display
  const sortedModels = [...models].sort((a, b) => a.priority - b.priority);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-500">Error loading configuration</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h1 className="text-2xl font-bold mb-6">OpenRouter Model Configuration</h1>
        
        <div className="space-y-1 mb-6">
          <h2 className="text-lg font-semibold mb-3">🤖 Available Models:</h2>
          <div className="border rounded-lg divide-y">
            {sortedModels.map((model) => (
              <div
                key={model.id}
                className={`p-4 flex items-center justify-between ${
                  model.enabled ? 'bg-green-50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-4 flex-1">
                  <Checkbox
                    checked={model.enabled}
                    onCheckedChange={(checked) => 
                      handleModelToggle(model.id, checked as boolean)
                    }
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {model.name}
                      {model.enabled && (
                        <span className="ml-2 text-sm text-green-600">← Active</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{model.provider}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Priority:</label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={model.priority}
                    onChange={(e) => handlePriorityChange(model.id, e.target.value)}
                    className="w-16 text-center"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Strategy:</label>
          <Select value={strategy} onValueChange={(val) => {
            setStrategy(val);
            setHasChanges(true);
          }}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priorityBased">Priority Based</SelectItem>
              <SelectItem value="costOptimized">Cost Optimized</SelectItem>
              <SelectItem value="consensus">Consensus</SelectItem>
              <SelectItem value="providerSpecific">Provider Specific</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || updateConfig.isPending}
            className="flex items-center space-x-2"
          >
            {updateConfig.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </div>
  );
}