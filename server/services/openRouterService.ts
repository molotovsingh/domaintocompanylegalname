import axios from 'axios';
import { getModelsForUseCase, getModelById, ModelConfig } from '../config/openrouter-models';

interface OpenRouterRequest {
  domain: string;
  htmlContent?: string;
  footerText?: string;
  aboutPageText?: string;
  useCase?: 'entity-extraction' | 'complex-extraction' | 'arbitration' | 'verification' | 'reasoning' | 'online-search';
  strategy?: 'costOptimized' | 'priorityBased' | 'consensus' | 'providerSpecific';
  preferredProvider?: string;
}

interface OpenRouterResponse {
  success: boolean;
  entityName?: string;
  confidence?: number;
  modelUsed?: string;
  alternativeResults?: Array<{
    model: string;
    result: string;
    confidence: number;
  }>;
  cost?: number;
  processingTime?: number;
  error?: string;
}

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor() {
    this.apiKey = process.env.openrouter || '';
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found in environment variables');
    }
  }

  async extractEntity(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const startTime = Date.now();
    
    try {
      // Get models based on use case and strategy
      const useCase = request.useCase || 'entity-extraction';
      const strategy = request.strategy || 'priorityBased';
      const models = getModelsForUseCase(useCase, strategy);
      
      if (models.length === 0) {
        return {
          success: false,
          error: 'No enabled models found for this use case'
        };
      }

      // For consensus strategy, use multiple models
      if (strategy === 'consensus') {
        return await this.consensusExtraction(request, models);
      }

      // For other strategies, try models in order until one succeeds
      for (const model of models) {
        try {
          const result = await this.extractWithModel(request, model);
          if (result.success) {
            return {
              ...result,
              processingTime: Date.now() - startTime
            };
          }
        } catch (error) {
          console.error(`Model ${model.id} failed:`, error);
          // Continue to next model
        }
      }

      return {
        success: false,
        error: 'All models failed to extract entity',
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  private async extractWithModel(
    request: OpenRouterRequest, 
    model: ModelConfig
  ): Promise<OpenRouterResponse> {
    const requestId = Math.random().toString(36).substring(2, 15);
    const startTime = Date.now();
    
    console.log(`[OpenRouter API] Request ${requestId} starting:`, {
      model: model.id,
      domain: request.domain,
      useCase: request.useCase,
      strategy: request.strategy,
      promptLength: this.buildPrompt(request).length,
      timestamp: new Date().toISOString()
    });

    const messages = [
      {
        role: 'system',
        content: `You are a legal entity extraction specialist. Extract the primary legal entity name from website data.

RULES:
1. Return ONLY the complete legal entity name
2. Include proper legal suffix (Inc., Corp., Ltd., LLC, etc.)
3. Prefer names from copyright notices, legal pages, or structured data
4. If multiple entities found, return the primary operating entity
5. No explanations, just the entity name

Response format: Return only the entity name as plain text.`
      },
      {
        role: 'user',
        content: this.buildPrompt(request)
      }
    ];

    // Check if this is a reasoning model that supports include_reasoning
    const isReasoningModel = model.id.includes('reasoning') || 
                            model.id.includes(':thinking') || 
                            model.id.includes('r1') ||
                            model.id.includes('qwq') ||
                            model.id.includes('phi-4-reasoning') ||
                            model.id.includes('kimi-k2');

    const requestBody: any = {
      model: model.id,
      messages,
      max_tokens: model.maxTokens,
      temperature: model.temperature
    };

    // Add include_reasoning for models that support it
    if (isReasoningModel) {
      requestBody.include_reasoning = true;
      console.log(`[OpenRouter API] Request ${requestId}: Reasoning model detected, adding include_reasoning=true`);
    }

    console.log(`[OpenRouter API] Request ${requestId} payload:`, {
      model: requestBody.model,
      messageCount: requestBody.messages.length,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      includeReasoning: requestBody.include_reasoning || false,
      systemPromptLength: requestBody.messages[0].content.length,
      userPromptLength: requestBody.messages[1].content.length
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const processingTime = Date.now() - startTime;
      const result = response.data.choices[0].message.content.trim();
      const usage = response.data.usage;

      console.log(`[OpenRouter API] Request ${requestId} successful:`, {
        statusCode: response.status,
        processingTime: `${processingTime}ms`,
        resultLength: result.length,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens
        },
        responseHeaders: {
          'x-ratelimit-remaining': response.headers['x-ratelimit-remaining'],
          'x-ratelimit-limit': response.headers['x-ratelimit-limit'],
          'x-ratelimit-reset': response.headers['x-ratelimit-reset']
        }
      });

      // Calculate cost
      const cost = this.calculateCost(model.id, usage);

      // Simple confidence calculation based on result quality
      const confidence = this.calculateConfidence(result, request.domain);

      console.log(`[OpenRouter API] Request ${requestId} completed:`, {
        entityName: result,
        confidence,
        cost: `$${cost.toFixed(6)}`,
        processingTime: `${processingTime}ms`
      });

      return {
        success: true,
        entityName: result,
        confidence,
        modelUsed: model.id,
        cost
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      console.error(`[OpenRouter API] Request ${requestId} failed:`, {
        model: model.id,
        domain: request.domain,
        processingTime: `${processingTime}ms`,
        error: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers
        },
        requestBody: {
          model: requestBody.model,
          maxTokens: requestBody.max_tokens,
          temperature: requestBody.temperature,
          includeReasoning: requestBody.include_reasoning
        }
      });
      
      throw error;
    }
  }

  private async consensusExtraction(
    request: OpenRouterRequest,
    models: ModelConfig[]
  ): Promise<OpenRouterResponse> {
    const consensusId = Math.random().toString(36).substring(2, 15);
    const startTime = Date.now();

    console.log(`[OpenRouter Consensus] ${consensusId} starting:`, {
      domain: request.domain,
      modelCount: models.length,
      models: models.map(m => m.id),
      timestamp: new Date().toISOString()
    });

    const results = await Promise.allSettled(
      models.map(model => this.extractWithModel(request, model))
    );

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<OpenRouterResponse> => 
        r.status === 'fulfilled' && r.value.success
      )
      .map(r => r.value);

    const failedResults = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason);

    console.log(`[OpenRouter Consensus] ${consensusId} model results:`, {
      totalModels: models.length,
      successfulCount: successfulResults.length,
      failedCount: failedResults.length,
      successfulModels: successfulResults.map(r => r.modelUsed),
      failedReasons: failedResults.map(r => r.message || 'Unknown error')
    });

    if (successfulResults.length === 0) {
      console.error(`[OpenRouter Consensus] ${consensusId} failed: All models failed`, {
        domain: request.domain,
        models: models.map(m => m.id),
        failedReasons: failedResults.map(r => r.message || 'Unknown error')
      });
      
      return {
        success: false,
        error: 'All models failed in consensus extraction'
      };
    }

    // Find the most common result
    const resultCounts = new Map<string, number>();
    successfulResults.forEach(r => {
      if (r.entityName) {
        resultCounts.set(r.entityName, (resultCounts.get(r.entityName) || 0) + 1);
      }
    });

    const [consensusResult, count] = Array.from(resultCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    const consensusConfidence = (count / successfulResults.length) * 100;
    const totalCost = successfulResults.reduce((sum, r) => sum + (r.cost || 0), 0);
    const processingTime = Date.now() - startTime;

    console.log(`[OpenRouter Consensus] ${consensusId} completed:`, {
      domain: request.domain,
      consensusResult,
      agreementCount: count,
      totalSuccessful: successfulResults.length,
      consensusConfidence: `${consensusConfidence.toFixed(1)}%`,
      totalCost: `$${totalCost.toFixed(6)}`,
      processingTime: `${processingTime}ms`,
      resultBreakdown: Array.from(resultCounts.entries()).map(([result, count]) => ({
        result,
        count,
        percentage: `${((count / successfulResults.length) * 100).toFixed(1)}%`
      }))
    });

    return {
      success: true,
      entityName: consensusResult,
      confidence: consensusConfidence,
      modelUsed: 'consensus',
      alternativeResults: successfulResults.map(r => ({
        model: r.modelUsed || 'unknown',
        result: r.entityName || '',
        confidence: r.confidence || 0
      })),
      cost: totalCost
    };
  }

  private buildPrompt(request: OpenRouterRequest): string {
    const parts = [`Domain: ${request.domain}`];
    
    if (request.footerText) {
      parts.push(`Footer text: ${request.footerText}`);
    }
    
    if (request.aboutPageText) {
      parts.push(`About page: ${request.aboutPageText}`);
    }
    
    if (request.htmlContent) {
      // Include a snippet of HTML for context
      const snippet = request.htmlContent.substring(0, 1000);
      parts.push(`HTML snippet: ${snippet}...`);
    }
    
    return parts.join('\n\n');
  }

  private calculateCost(modelId: string, usage: any): number {
    // Simplified cost calculation - in production, fetch actual pricing
    const costPerMillion = {
      'openai/gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      'openai/gpt-4-turbo': { input: 10, output: 30 },
      'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
      'anthropic/claude-3-opus': { input: 15, output: 75 },
      'meta-llama/llama-3-70b-instruct': { input: 0.7, output: 0.9 },
      'mistralai/mixtral-8x7b-instruct': { input: 0.45, output: 0.45 }
    };

    const pricing = costPerMillion[modelId as keyof typeof costPerMillion] || 
                   { input: 1, output: 1 };

    const inputCost = (usage.prompt_tokens / 1_000_000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  private calculateConfidence(result: string, domain: string): number {
    // Simple confidence calculation
    let confidence = 50;

    // Check if result contains a legal suffix
    const legalSuffixes = ['Inc.', 'Corp.', 'Corporation', 'Ltd.', 'LLC', 'GmbH', 'S.A.', 'AG'];
    if (legalSuffixes.some(suffix => result.includes(suffix))) {
      confidence += 30;
    }

    // Check if result is related to domain name
    const domainName = domain.split('.')[0].toLowerCase();
    if (result.toLowerCase().includes(domainName)) {
      confidence += 20;
    }

    return Math.min(confidence, 100);
  }

  // Get current model configuration
  getModelConfiguration() {
    return {
      models: getModelsForUseCase('entity-extraction'),
      strategies: ['costOptimized', 'priorityBased', 'consensus', 'providerSpecific']
    };
  }

  // Update model settings
  updateModelSettings(modelId: string, settings: Partial<ModelConfig>) {
    const model = getModelById(modelId);
    if (model) {
      Object.assign(model, settings);
      return { success: true, model };
    }
    return { success: false, error: 'Model not found' };
  }

  // Generic method for making OpenRouter requests
  async makeRequest(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
    include_reasoning?: boolean;
  }): Promise<{ success: boolean; content?: string; error?: string; usage?: any }> {
    const requestId = Math.random().toString(36).substring(2, 15);
    const startTime = Date.now();

    console.log(`[OpenRouter Generic] Request ${requestId} starting:`, {
      model: params.model,
      messageCount: params.messages.length,
      maxTokens: params.max_tokens || 1000,
      temperature: params.temperature || 0,
      includeReasoning: params.include_reasoning || false,
      timestamp: new Date().toISOString()
    });

    if (!this.apiKey) {
      console.error(`[OpenRouter Generic] Request ${requestId} failed: No API key configured`);
      return {
        success: false,
        error: 'OpenRouter API key not configured'
      };
    }

    const requestBody = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens || 1000,
      temperature: params.temperature || 0,
      ...(params.include_reasoning && { include_reasoning: true })
    };

    console.log(`[OpenRouter Generic] Request ${requestId} payload:`, {
      model: requestBody.model,
      messageCount: requestBody.messages.length,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      includeReasoning: requestBody.include_reasoning || false,
      totalPromptLength: requestBody.messages.reduce((sum, msg) => sum + msg.content.length, 0)
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const processingTime = Date.now() - startTime;
      const content = response.data.choices[0].message.content.trim();
      const usage = response.data.usage;

      console.log(`[OpenRouter Generic] Request ${requestId} successful:`, {
        statusCode: response.status,
        processingTime: `${processingTime}ms`,
        contentLength: content.length,
        usage: {
          promptTokens: usage?.prompt_tokens,
          completionTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens
        },
        rateLimit: {
          remaining: response.headers['x-ratelimit-remaining'],
          limit: response.headers['x-ratelimit-limit'],
          reset: response.headers['x-ratelimit-reset']
        }
      });

      return {
        success: true,
        content,
        usage
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      console.error(`[OpenRouter Generic] Request ${requestId} failed:`, {
        model: params.model,
        processingTime: `${processingTime}ms`,
        error: {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: {
            'x-ratelimit-remaining': error.response?.headers?.['x-ratelimit-remaining'],
            'x-ratelimit-limit': error.response?.headers?.['x-ratelimit-limit'],
            'content-type': error.response?.headers?.['content-type']
          }
        },
        requestDetails: {
          model: requestBody.model,
          messageCount: requestBody.messages.length,
          maxTokens: requestBody.max_tokens,
          includeReasoning: requestBody.include_reasoning
        }
      });
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}