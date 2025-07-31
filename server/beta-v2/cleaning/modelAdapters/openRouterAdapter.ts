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

  async clean(rawData: string, systemPrompt?: string): Promise<CleaningResult> {
    const startTime = Date.now();
    const prompt = systemPrompt || this.getDefaultSystemPrompt();
    
    try {
      // Estimate tokens for cost calculation
      const inputTokens = this.estimateTokens(prompt + rawData);
      
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
              content: `Extract company information from the following content:\n\n${rawData.substring(0, 15000)}` // Limit content size
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
        extractedData = this.extractBasicInfo(rawData);
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
      const extractedData = this.extractBasicInfo(rawData);
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
      'llama-3-8b': 'Llama 3 8B (Free)',
      'mixtral-8x7b': 'Mixtral 8x7B (Free)',
      'qwen-2.5': 'Qwen 2.5 (Free)',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3-haiku': 'Claude 3 Haiku'
    };
    return displayNames[this.modelName] || this.modelName;
  }

  private getModelDescription(): string {
    const descriptions: Record<string, string> = {
      'deepseek-chat': 'Fast and reliable free model, recommended for most extractions',
      'llama-3-8b': 'Open source model with good accuracy',
      'mixtral-8x7b': 'Mixture of experts model with strong performance',
      'qwen-2.5': 'Latest Qwen model with improved extraction capabilities',
      'gpt-3.5-turbo': 'OpenAI model with consistent quality ($0.002/1K tokens)',
      'claude-3-haiku': 'Anthropic model with excellent accuracy ($0.25/1M tokens)'
    };
    return descriptions[this.modelName] || 'General purpose extraction model';
  }

  private calculateConfidence(data: ExtractedData): number {
    let score = 0;
    let fields = 0;

    // Check each field and add to score
    if (data.companyName && data.companyName.length > 2) { score += 0.2; fields++; }
    if (data.legalEntity && data.legalEntity.includes('.')) { score += 0.2; fields++; }
    if (data.addresses && data.addresses.length > 0) { score += 0.15; fields++; }
    if (data.phones && data.phones.length > 0) { score += 0.15; fields++; }
    if (data.emails && data.emails.length > 0) { score += 0.1; fields++; }
    if (data.countries && data.countries.length > 0) { score += 0.1; fields++; }
    if (data.currencies && data.currencies.length > 0) { score += 0.05; fields++; }
    if (data.socialMedia && data.socialMedia.length > 0) { score += 0.05; fields++; }

    // Normalize score between 0 and 1
    return Math.min(1, Math.max(0, score));
  }

  private extractBasicInfo(rawData: string): ExtractedData {
    // Basic regex-based extraction as fallback
    const text = rawData.toLowerCase();
    
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
      companyName: undefined,
      legalEntity: undefined,
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