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
  
  // Reasoning Models (Excellent for complex extraction)
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 3,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.003,
    enabled: false  // Enable for reasoning tasks
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B',
    provider: 'Alibaba',
    useCase: ['complex-extraction', 'reasoning', 'arbitration'],
    priority: 4,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.004,
    enabled: false  // Strong reasoning capabilities
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-70b',
    name: 'Hermes 3 Llama 70B',
    provider: 'NousResearch',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 5,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.005,
    enabled: false  // Excellent reasoning model
  },
  
  // Additional Open Source Models
  {
    id: 'google/gemma-7b-it',
    name: 'Gemma 7B',
    provider: 'Google',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 6,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Enable if you want more variety
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    provider: 'Meta',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 7,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Smaller, faster Llama variant
  },
  {
    id: 'mistralai/mistral-7b-instruct',
    name: 'Mistral 7B',
    provider: 'Mistral',
    useCase: ['entity-extraction', 'quick-analysis', 'fallback'],
    priority: 8,
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Smaller Mistral model
  },
  {
    id: 'google/gemma-2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'Google',
    useCase: ['entity-extraction', 'reasoning'],
    priority: 9,
    maxTokens: 120,
    temperature: 0,
    costLimit: 0.003,
    enabled: false  // Newer Gemma with better performance
  },
  {
    id: 'databricks/dbrx-instruct',
    name: 'DBRX Instruct',
    provider: 'Databricks',
    useCase: ['complex-extraction', 'reasoning'],
    priority: 10,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.006,
    enabled: false  // Strong enterprise model
  },
  {
    id: 'cohere/command-r',
    name: 'Command R',
    provider: 'Cohere',
    useCase: ['entity-extraction', 'reasoning'],
    priority: 11,
    maxTokens: 120,
    temperature: 0,
    costLimit: 0.003,
    enabled: false  // Good for extraction tasks
  },
  {
    id: 'perplexity/llama-3.1-sonar-large-128k-online',
    name: 'Perplexity Sonar Large',
    provider: 'Perplexity',
    useCase: ['complex-extraction', 'verification', 'online-search'],
    priority: 12,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.008,
    enabled: false  // Can search online for verification
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