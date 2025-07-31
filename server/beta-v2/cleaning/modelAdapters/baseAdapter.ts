// Base adapter interface for all model adapters

import { CleaningResult, ModelInfo } from '../types';

export abstract class BaseModelAdapter {
  protected apiKey: string;
  protected modelName: string;
  protected provider: string;

  constructor(apiKey: string, modelName: string, provider: string) {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.provider = provider;
  }

  /**
   * Clean/extract data from raw content using the model
   * @param rawData The raw HTML or text content to process
   * @param systemPrompt Optional custom prompt for extraction
   * @returns Promise with the cleaning result
   */
  abstract clean(rawData: string, systemPrompt?: string): Promise<CleaningResult>;

  /**
   * Estimate the cost for processing a given number of tokens
   * @param tokenCount Number of tokens to process
   * @returns Estimated cost in USD
   */
  abstract estimateCost(tokenCount: number): number;

  /**
   * Get information about the model
   * @returns Model information including status and capabilities
   */
  abstract getModelInfo(): ModelInfo;

  /**
   * Count tokens in a text (approximate)
   * Simple estimation: ~4 characters per token
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Default system prompt for entity extraction
   */
  protected getDefaultSystemPrompt(): string {
    return `You are a data extraction specialist. Extract company and business information from the provided text.
    
    IMPORTANT: Always respond in English, regardless of the source language.
    
    Return a JSON object with the following structure:
    {
      "companyName": "Official company name",
      "legalEntity": "Full legal entity name with suffix (Inc., LLC, Ltd., etc.)",
      "addresses": ["Array of physical addresses found"],
      "phones": ["Array of phone numbers"],
      "emails": ["Array of email addresses"],
      "currencies": ["Array of currency codes mentioned (USD, EUR, etc.)"],
      "countries": ["Array of countries mentioned or detected"],
      "socialMedia": ["Array of social media URLs or handles"],
      "businessIdentifiers": {
        "registrationNumbers": ["Company registration numbers"],
        "taxIds": ["Tax identification numbers"],
        "licenses": ["Business licenses mentioned"]
      }
    }
    
    Guidelines:
    - Extract only factual information present in the text
    - For company names, prefer the legal entity name with suffix
    - Normalize phone numbers to include country code when possible
    - Extract complete addresses, not partial ones
    - Return empty arrays for fields with no data
    - Be conservative - only extract clear, unambiguous information`;
  }
}