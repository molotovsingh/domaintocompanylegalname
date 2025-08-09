// OpenRouter adapter for LLM cleaning

import axios from 'axios';
import { BaseModelAdapter } from './baseAdapter';
import { CleaningResult, ModelInfo, ExtractedData } from '../types';

export class OpenRouterAdapter extends BaseModelAdapter {
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private modelId: string;
  private isFree: boolean;
  private costPer1kTokens: number;

  constructor(apiKey: string, modelName: string, modelId: string, isFree: boolean = true, costPer1kTokens: number = 0) {
    super(apiKey, modelName, 'openrouter');
    this.modelId = modelId;
    this.isFree = isFree;
    this.costPer1kTokens = costPer1kTokens;
  }

  async clean(rawData: any, systemPrompt?: string): Promise<CleaningResult> {
    const startTime = Date.now();
    const prompt = systemPrompt || this.getDefaultSystemPrompt();
    
    // Convert object format (crawlee/scrapy dumps) to HTML string
    let htmlContent: string;
    if (typeof rawData === 'string') {
      htmlContent = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // Handle crawlee/scrapy dump format
      if (rawData.pages && Array.isArray(rawData.pages)) {
        // Extract HTML from pages array
        htmlContent = rawData.pages.map((page: any) => {
          if (typeof page === 'string') return page;
          if (page.html) return page.html;
          if (page.content) return page.content;
          return '';
        }).join('\n\n');
      } else if (rawData.html) {
        htmlContent = rawData.html;
      } else if (rawData.content) {
        htmlContent = rawData.content;
      } else {
        // Fallback: stringify the object
        htmlContent = JSON.stringify(rawData);
      }
    } else {
      htmlContent = String(rawData);
    }
    
    try {
      // Estimate tokens for cost calculation
      const inputTokens = this.estimateTokens(prompt + htmlContent);
      
      // Make request to OpenRouter
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.modelId,
          messages: [
            {
              role: 'system',
              content: prompt
            },
            {
              role: 'user',
              content: `Extract company information from the following content:\n\n${htmlContent.substring(0, 15000)}` // Limit content size
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://domain-extractor.replit.app',
            'X-Title': 'Domain Extractor Cleaning Service'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      // Parse the response
      let content = response.data.choices[0].message.content;
      let extractedData: ExtractedData;
      
      try {
        // Strip markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          content = jsonMatch[1].trim();
        }
        
        extractedData = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content);
        extractedData = this.extractBasicInfo(htmlContent);
      }

      // Calculate tokens and cost
      const outputTokens = this.estimateTokens(JSON.stringify(extractedData));
      const totalTokens = inputTokens + outputTokens;
      const cost = this.estimateCost(totalTokens);

      // Calculate confidence score based on data completeness
      const confidenceScore = this.calculateConfidence(extractedData);

      const processingTime = Date.now() - startTime;

      return {
        extractedData,
        metadata: {
          processingTimeMs: processingTime,
          tokenCount: totalTokens,
          costEstimate: cost,
          confidenceScore,
          model: this.modelName,
          provider: this.provider
        }
      };
    } catch (error: any) {
      console.error(`OpenRouter cleaning error with ${this.modelName}:`, error.message);
      
      // Fallback to basic extraction
      const extractedData = this.extractBasicInfo(htmlContent);
      const processingTime = Date.now() - startTime;

      return {
        extractedData,
        metadata: {
          processingTimeMs: processingTime,
          tokenCount: 0,
          costEstimate: 0,
          confidenceScore: 0.3,
          model: this.modelName,
          provider: this.provider,
          errorMessage: error.message
        }
      };
    }
  }

  estimateCost(tokenCount: number): number {
    return (tokenCount / 1000) * this.costPer1kTokens;
  }

  getModelInfo(): ModelInfo {
    return {
      name: this.modelName,
      provider: this.provider,
      displayName: this.getDisplayName(),
      description: this.getModelDescription(),
      costPer1kTokens: this.costPer1kTokens,
      isFree: this.isFree,
      maxTokens: 4000,
      temperature: 0.3,
      status: 'available'
    };
  }

  private getDisplayName(): string {
    const displayNames: Record<string, string> = {
      'deepseek-chat': 'DeepSeek Chat (Free)',
      'deepseek-v3': 'DeepSeek V3 (Free)',
      'deepseek-r1': 'DeepSeek R1 Reasoning (Free)',
      'llama-3-8b': 'Llama 3 8B (Free)',
      'mixtral-8x7b': 'Mixtral 8x7B (Free)',
      'qwen-2.5': 'Qwen 2.5 72B (Free)',
      'qwen3-coder': 'Qwen3 Coder (Free)',
      'qwen3-14b': 'Qwen3 14B (Free)',
      'mistral-nemo': 'Mistral Nemo (Free)',
      'gemini-2-flash': 'Gemini 2.0 Flash (Free)',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3-haiku': 'Claude 3 Haiku'
    };
    return displayNames[this.modelName] || this.modelName;
  }

  private getModelDescription(): string {
    const descriptions: Record<string, string> = {
      'deepseek-chat': 'Fast and reliable free model, recommended for most extractions',
      'deepseek-v3': 'Latest DeepSeek V3 with 238B tokens, powerful and accurate',
      'deepseek-r1': 'Advanced reasoning model similar to OpenAI o1, best for complex analysis',
      'llama-3-8b': 'Open source model with good accuracy',
      'mixtral-8x7b': 'Mixture of experts model with strong performance',
      'qwen-2.5': 'Latest Qwen model with improved extraction capabilities',
      'qwen3-coder': 'Optimized for code and technical content, 159B tokens',
      'qwen3-14b': 'Efficient 14.8B parameter model, good balance of speed and quality',
      'mistral-nemo': '12B multilingual model, excellent for international domains',
      'gemini-2-flash': 'Google\'s fastest experimental model, great for quick processing',
      'gpt-3.5-turbo': 'OpenAI model with consistent quality ($0.002/1K tokens)',
      'claude-3-haiku': 'Anthropic model with excellent accuracy ($0.25/1M tokens)'
    };
    return descriptions[this.modelName] || 'General purpose extraction model';
  }

  private calculateConfidence(data: ExtractedData): number {
    let score = 0;
    let fields = 0;

    // Check new entity-focused fields first
    if (data.primaryEntityName && data.primaryEntityName.length > 2) { score += 0.25; fields++; }
    if (data.baseEntityName && data.baseEntityName.length > 2) { score += 0.2; fields++; }
    if (data.entityCandidates && data.entityCandidates.length > 0) { score += 0.15; fields++; }
    if (data.nameVariations && data.nameVariations.length > 0) { score += 0.1; fields++; }
    if (data.confidenceIndicators?.hasLegalSuffix) { score += 0.1; fields++; }
    
    // Legacy fields for backwards compatibility
    if (!data.primaryEntityName && data.companyName && data.companyName.length > 2) { score += 0.15; fields++; }
    
    // Supporting information
    if (data.addresses && data.addresses.length > 0) { score += 0.05; fields++; }

    // Normalize score between 0 and 1
    return Math.min(1, Math.max(0, score));
  }

  private extractBasicInfo(rawData: string): ExtractedData {
    // Basic regex-based extraction as fallback
    const text = rawData.toLowerCase();
    
    // Try to extract company name from title or copyright
    let primaryEntityName: string | undefined;
    let baseEntityName: string | undefined;
    
    // Look for copyright notices
    const copyrightMatch = rawData.match(/(?:©|Copyright)\s+(?:\d{4}\s+)?([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|\s+All|\s+Rights)/i);
    if (copyrightMatch) {
      primaryEntityName = copyrightMatch[1].trim();
      // Extract base name by removing common suffixes
      baseEntityName = primaryEntityName.replace(/\s+(?:Inc|Corp|LLC|Ltd|Limited|GmbH|AG|SA)\.?$/i, '').trim();
    }
    
    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(rawData.match(emailRegex) || [])];

    // Extract phone numbers (basic pattern)
    const phoneRegex = /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}/g;
    const phones = [...new Set(rawData.match(phoneRegex) || [])].filter(p => p.length >= 10);

    // Extract currency codes
    const currencyRegex = /\b(USD|EUR|GBP|JPY|CNY|CAD|AUD|CHF|INR|BRL)\b/g;
    const currencies = [...new Set(rawData.match(currencyRegex) || [])];

    return {
      primaryEntityName,
      baseEntityName,
      companyName: primaryEntityName, // For backwards compatibility
      entityCandidates: primaryEntityName ? [primaryEntityName] : [],
      nameVariations: [],
      excludeTerms: [],
      addresses: [],
      phones,
      emails,
      currencies,
      countries: [],
      socialMedia: [],
      businessIdentifiers: {
        registrationNumbers: [],
        taxIds: [],
        licenses: []
      }
    };
  }
}