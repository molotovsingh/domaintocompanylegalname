// OpenRouter Model Configuration
// Control which models are used and their priority

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  useCase: string[];
  priority: number; // Lower number = higher priority
  maxTokens: number;
  temperature: number;
  costLimit?: number; // Max cost per request in USD
  enabled: boolean;
}

// Configure your models here
export const openRouterModels: ModelConfig[] = [
  // Fast & Cheap Models (for initial extraction)
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 1,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.01,
    enabled: false  // DISABLED - Using only open models
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'Anthropic',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 2,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.01,
    enabled: false  // DISABLED - Using only open models
  },
  
  // Powerful Models (for complex cases)
  {
    id: 'openai/gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    useCase: ['complex-extraction', 'arbitration', 'verification'],
    priority: 3,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.05,
    enabled: false  // DISABLED - Using only open models
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    useCase: ['complex-extraction', 'arbitration', 'verification'],
    priority: 4,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.10,
    enabled: false // Expensive - disabled by default
  },
  
  // Open Source Models (PRIMARY - Now with higher priority)
  {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B',
    provider: 'Meta',
    useCase: ['entity-extraction', 'quick-analysis', 'complex-extraction', 'verification'],
    priority: 1,  // CHANGED from 5 to 1 - Now primary model
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.005,
    enabled: true
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct',
    name: 'Mixtral 8x7B',
    provider: 'Mistral',
    useCase: ['entity-extraction', 'quick-analysis', 'fallback'],
    priority: 2,  // CHANGED from 6 to 2 - Now secondary model
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.005,
    enabled: true
  },
  
  // Additional Open Source Models (Optional - Enable as needed)
  {
    id: 'google/gemma-7b-it',
    name: 'Gemma 7B',
    provider: 'Google',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 3,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Enable if you want more variety
  },
  {
    id: 'nousresearch/nous-capybara-7b',
    name: 'Nous Capybara 7B',
    provider: 'NousResearch',
    useCase: ['entity-extraction', 'fallback'],
    priority: 4,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Enable for additional fallback
  },
  {
    id: 'teknium/openhermes-2.5-mistral-7b',
    name: 'OpenHermes 2.5',
    provider: 'Teknium',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 5,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Enable for fast, cheap extraction
  }
];

// Model selection strategies
export const modelStrategies = {
  // Use the cheapest model first
  costOptimized: (models: ModelConfig[], useCase: string) => {
    return models
      .filter(m => m.enabled && m.useCase.includes(useCase))
      .sort((a, b) => (a.costLimit || 0) - (b.costLimit || 0));
  },
  
  // Use models by priority
  priorityBased: (models: ModelConfig[], useCase: string) => {
    return models
      .filter(m => m.enabled && m.useCase.includes(useCase))
      .sort((a, b) => a.priority - b.priority);
  },
  
  // Use multiple models and compare results
  consensus: (models: ModelConfig[], useCase: string) => {
    return models
      .filter(m => m.enabled && m.useCase.includes(useCase))
      .slice(0, 3); // Use top 3 models
  },
  
  // Use specific provider only
  providerSpecific: (models: ModelConfig[], useCase: string, provider: string) => {
    return models
      .filter(m => m.enabled && m.useCase.includes(useCase) && m.provider === provider)
      .sort((a, b) => a.priority - b.priority);
  }
};

// Get models for specific use case
export function getModelsForUseCase(
  useCase: string, 
  strategy: keyof typeof modelStrategies = 'priorityBased'
): ModelConfig[] {
  return modelStrategies[strategy](openRouterModels, useCase);
}

// Get a single model by ID
export function getModelById(modelId: string): ModelConfig | undefined {
  return openRouterModels.find(m => m.id === modelId);
}

// Update model configuration
export function updateModelConfig(modelId: string, updates: Partial<ModelConfig>) {
  const model = openRouterModels.find(m => m.id === modelId);
  if (model) {
    Object.assign(model, updates);
  }
}