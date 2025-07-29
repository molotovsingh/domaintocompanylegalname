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
    const messages = [
      {
        role: 'system',
        content: `Extract the legal entity name from the provided website data. 
                 Include the full legal name with suffix (Inc., Corp., Ltd., etc.).
                 Respond with ONLY the company name, nothing else.`
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
                            model.id.includes('phi-4-reasoning');

    const requestBody: any = {
      model: model.id,
      messages,
      max_tokens: model.maxTokens,
      temperature: model.temperature
    };

    // Add include_reasoning for models that support it
    if (isReasoningModel) {
      requestBody.include_reasoning = true;
    }

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

    const result = response.data.choices[0].message.content.trim();
    const usage = response.data.usage;

    // Calculate cost
    const cost = this.calculateCost(model.id, usage);

    // Simple confidence calculation based on result quality
    const confidence = this.calculateConfidence(result, request.domain);

    return {
      success: true,
      entityName: result,
      confidence,
      modelUsed: model.id,
      cost
    };
  }

  private async consensusExtraction(
    request: OpenRouterRequest,
    models: ModelConfig[]
  ): Promise<OpenRouterResponse> {
    const results = await Promise.allSettled(
      models.map(model => this.extractWithModel(request, model))
    );

    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<OpenRouterResponse> => 
        r.status === 'fulfilled' && r.value.success
      )
      .map(r => r.value);

    if (successfulResults.length === 0) {
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
      cost: successfulResults.reduce((sum, r) => sum + (r.cost || 0), 0)
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
}