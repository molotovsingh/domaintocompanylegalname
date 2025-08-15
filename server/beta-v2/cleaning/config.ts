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
  // DeepSeek Models
  'deepseek-chat': {
    modelId: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'deepseek-v3': {
    modelId: 'deepseek/deepseek-chat-v3-0324:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'deepseek-r1': {
    modelId: 'deepseek/deepseek-r1:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Qwen Models
  'qwen-2.5': {
    modelId: 'qwen/qwen-2.5-72b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'qwen3-coder': {
    modelId: 'qwen/qwen3-coder:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'qwen3-14b': {
    modelId: 'qwen/qwen3-14b:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Meta Models
  'llama-3-8b': {
    modelId: 'meta-llama/llama-3-8b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Mistral Models
  'mistral-7b': {
    modelId: 'mistralai/mistral-7b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Google Models
  'gemma-7b': {
    modelId: 'google/gemma-7b-it:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Additional Models
  'mixtral-8x7b': {
    modelId: 'mistralai/mixtral-8x7b-instruct:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'mistral-nemo': {
    modelId: 'mistralai/mistral-nemo:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Google Models
  'gemini-2-flash': {
    modelId: 'google/gemini-2.0-flash-exp:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // ============ PAID SOTA MODELS ============
  
  // OpenAI GPT-4 Models (Best for complex reasoning)
  'gpt-4-turbo': {
    modelId: 'openai/gpt-4-turbo',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.01, // $10 per 1M input tokens
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true // Enable for production use
  },
  'gpt-4': {
    modelId: 'openai/gpt-4',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.03, // $30 per 1M input tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'gpt-4o': {
    modelId: 'openai/gpt-4o',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.005, // $5 per 1M input tokens - optimized version
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'gpt-4o-mini': {
    modelId: 'openai/gpt-4o-mini',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00015, // $0.15 per 1M tokens - cost effective
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'gpt-3.5-turbo': {
    modelId: 'openai/gpt-3.5-turbo',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.0005, // $0.50 per 1M tokens
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  
  // Anthropic Claude 3 Models (Best for safety and nuanced understanding)
  'claude-3-opus': {
    modelId: 'anthropic/claude-3-opus',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.015, // $15 per 1M input tokens - most capable
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'claude-3-sonnet': {
    modelId: 'anthropic/claude-3-sonnet',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.003, // $3 per 1M input tokens - balanced
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'claude-3-haiku': {
    modelId: 'anthropic/claude-3-haiku',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00025, // $0.25 per 1M tokens - fastest
    maxTokens: 4000,
    temperature: 0.3,
    enabled: true
  },
  'claude-3.5-sonnet': {
    modelId: 'anthropic/claude-3.5-sonnet',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.003, // $3 per 1M input tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Google Gemini Models (Good for multimodal and long context)
  'gemini-pro': {
    modelId: 'google/gemini-pro',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00125, // $1.25 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'gemini-pro-1.5': {
    modelId: 'google/gemini-pro-1.5',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.0025, // $2.50 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Meta Llama 3.1 Larger Models (Open source excellence)
  'llama-3.1-70b': {
    modelId: 'meta-llama/llama-3.1-70b-instruct',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00088, // $0.88 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'llama-3.1-405b': {
    modelId: 'meta-llama/llama-3.1-405b-instruct',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.003, // $3 per 1M tokens - largest Llama
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Mistral Large Models
  'mistral-large': {
    modelId: 'mistralai/mistral-large',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.008, // $8 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // OpenAI Reasoning Models (For complex analysis)
  'o1-preview': {
    modelId: 'openai/o1-preview',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.015, // $15 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'o1-mini': {
    modelId: 'openai/o1-mini',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.003, // $3 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Perplexity Models (For web-aware responses)
  'perplexity-sonar-large': {
    modelId: 'perplexity/llama-3.1-sonar-large-128k-online',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.001, // $1 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Cohere Command R Models
  'command-r-plus': {
    modelId: 'cohere/command-r-plus',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.003, // $3 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Newer Free Models from 2025
  'llama-4-scout': {
    modelId: 'meta-llama/llama-4-scout:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'llama-4-maverick': {
    modelId: 'meta-llama/llama-4-maverick:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'mistral-small-3.1': {
    modelId: 'mistralai/mistral-small-3.1:free',
    provider: 'openrouter',
    isFree: true,
    costPer1kTokens: 0,
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  
  // Amazon Nova Models
  'nova-lite': {
    modelId: 'amazon/nova-lite',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.00035, // $0.35 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
  },
  'nova-pro': {
    modelId: 'amazon/nova-pro',
    provider: 'openrouter',
    isFree: false,
    costPer1kTokens: 0.0008, // $0.80 per 1M tokens
    maxTokens: 8000,
    temperature: 0.3,
    enabled: true
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
  
  // Enable paid models - set to true to include SOTA models
  enablePaidModels: true, // Enabled to provide access to high-quality SOTA models
  
  // OpenRouter API key
  openRouterApiKey: process.env.openrouter || '',
  
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