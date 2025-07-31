// Configuration for cleaning models and service

export interface ModelConfig {
  modelId: string; // OpenRouter model ID
  provider: 'openrouter' | 'openai' | 'local';
  isFree: boolean;
  costPer1kTokens: number;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string; // Optional custom prompt
  enabled: boolean;
}

export const CLEANING_MODELS: Record<string, ModelConfig> = {
  'deepseek-chat': {
    modelId: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'llama-3-8b': {
    modelId: 'meta-llama/llama-3-8b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'mixtral-8x7b': {
    modelId: 'mistralai/mixtral-8x7b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'qwen-2.5': {
    modelId: 'qwen/qwen-2.5-72b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'gpt-3.5-turbo': {
    modelId: 'openai/gpt-3.5-turbo',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.002,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: false // Disabled by default (paid model)
  },
  'claude-3-haiku': {
    modelId: 'anthropic/claude-3-haiku',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00025, // $0.25 per 1M tokens
    maxTokens: 4000,
    temperature: 0.3,
    enabled: false // Disabled by default (paid model)
  }
};

// Service configuration
export const CLEANING_SERVICE_CONFIG = {
  // Maximum concurrent cleaning operations
  maxConcurrentCleanings: 3,
  
  // Timeout for cleaning operations (ms)
  cleaningTimeoutMs: 30000,
  
  // Default model if none specified
  defaultModel: 'deepseek-chat',
  
  // Enable paid models
  enablePaidModels: process.env.ENABLE_PAID_MODELS === 'true',
  
  // OpenRouter API key
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  
  // Rate limiting
  rateLimiting: {
    maxRequestsPerMinute: 20,
    maxRequestsPerHour: 500
  },
  
  // Content size limits
  maxContentLength: 50000, // 50KB of text
  
  // Batch processing
  batchSize: 5,
  batchDelayMs: 1000 // Delay between batches
};

// Get enabled models
export function getEnabledModels(): string[] {
  return Object.keys(CLEANING_MODELS).filter(
    key => CLEANING_MODELS[key].enabled && 
    (CLEANING_MODELS[key].isFree || CLEANING_SERVICE_CONFIG.enablePaidModels)
  );
}

// Get model config
export function getModelConfig(modelName: string): ModelConfig | null {
  return CLEANING_MODELS[modelName] || null;
}