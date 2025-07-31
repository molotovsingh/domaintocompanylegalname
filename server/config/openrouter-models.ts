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
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek Chat (Free)',
    provider: 'DeepSeek',
    useCase: ['cleaning', 'entity-extraction', 'quick-analysis'],
    priority: 1,  // Primary for cleaning tasks - completely free!
    maxTokens: 4096,
    temperature: 0.1,
    costLimit: 0,  // FREE model
    enabled: true
  },
  {
    id: 'meta-llama/llama-3-70b-instruct',
    name: 'Llama 3 70B',
    provider: 'Meta',
    useCase: ['entity-extraction', 'quick-analysis', 'complex-extraction', 'verification'],
    priority: 2,  // Still important but not for cleaning
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
    priority: 3,  // Third priority after free models
    maxTokens: 100,
    temperature: 0,
    costLimit: 0.005,
    enabled: true
  },
  
  // DeepSeek R1 Reasoning Models
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 3,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.01,
    enabled: false  // Premium reasoning model with transparent thinking
  },
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 Free',
    provider: 'DeepSeek',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 4,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0,
    enabled: false  // Free reasoning model
  },
  {
    id: 'deepseek/deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
    provider: 'DeepSeek',
    useCase: ['complex-extraction', 'reasoning'],
    priority: 5,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0.005,
    enabled: false  // Distilled reasoning model
  },
  
  // Microsoft Phi Reasoning
  {
    id: 'microsoft/phi-4-reasoning-plus',
    name: 'Phi-4 Reasoning Plus',
    provider: 'Microsoft',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 6,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.008,
    enabled: false  // Microsoft's reasoning model
  },
  
  // Qwen Reasoning Models
  {
    id: 'qwen/qwq-32b-preview',
    name: 'Qwen QWQ 32B Preview',
    provider: 'Alibaba',
    useCase: ['complex-extraction', 'reasoning', 'arbitration'],
    priority: 7,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.004,
    enabled: false  // Qwen reasoning model
  },
  {
    id: 'qwen/qwq-32b:free',
    name: 'Qwen QWQ 32B Free',
    provider: 'Alibaba',
    useCase: ['complex-extraction', 'reasoning'],
    priority: 8,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0,
    enabled: false  // Free Qwen reasoning
  },
  
  // Mistral Reasoning
  {
    id: 'mistralai/magistral-medium-2506:thinking',
    name: 'Mistral Magistral Thinking',
    provider: 'Mistral',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 9,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.007,
    enabled: false  // Mistral's thinking model
  },
  
  // Perplexity Reasoning
  {
    id: 'perplexity/sonar-reasoning',
    name: 'Perplexity Sonar Reasoning',
    provider: 'Perplexity',
    useCase: ['complex-extraction', 'reasoning', 'online-search'],
    priority: 10,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.01,
    enabled: false  // Perplexity reasoning with search
  },
  
  // Moonshot AI Kimi Models
  {
    id: 'moonshotai/kimi-k2',
    name: 'Kimi K2',
    provider: 'Moonshot AI',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 11,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0.008,
    enabled: false  // Premium Kimi reasoning model
  },
  {
    id: 'moonshotai/kimi-k2:free',
    name: 'Kimi K2 Free',
    provider: 'Moonshot AI',
    useCase: ['complex-extraction', 'reasoning', 'verification'],
    priority: 12,
    maxTokens: 200,
    temperature: 0,
    costLimit: 0,
    enabled: false  // Free Kimi reasoning model
  },
  
  // Additional DeepSeek R1 Distill Variants
  {
    id: 'deepseek/deepseek-r1-distill-qwen-14b:free',
    name: 'DeepSeek R1 Distill Qwen 14B Free',
    provider: 'DeepSeek',
    useCase: ['reasoning', 'entity-extraction'],
    priority: 13,
    maxTokens: 150,
    temperature: 0,
    costLimit: 0,
    enabled: false  // Free distilled reasoning
  },
  {
    id: 'deepseek/deepseek-r1-distill-qwen-7b',
    name: 'DeepSeek R1 Distill Qwen 7B',
    provider: 'DeepSeek',
    useCase: ['reasoning', 'quick-analysis'],
    priority: 14,
    maxTokens: 120,
    temperature: 0,
    costLimit: 0.002,
    enabled: false  // Smaller reasoning model
  },
  
  // Additional Open Source Models
  {
    id: 'google/gemma-7b-it',
    name: 'Gemma 7B',
    provider: 'Google',
    useCase: ['entity-extraction', 'quick-analysis'],
    priority: 13,
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
    priority: 14,
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
    priority: 15,
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
    priority: 16,
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
    priority: 17,
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
    priority: 18,
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
    priority: 19,
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
  strategy: keyof typeof modelStrategies = 'priorityBased',
  provider?: string
): ModelConfig[] {
  if (strategy === 'providerSpecific' && provider) {
    return modelStrategies[strategy](openRouterModels, useCase, provider);
  }
  return modelStrategies[strategy as 'costOptimized' | 'priorityBased' | 'consensus'](openRouterModels, useCase);
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