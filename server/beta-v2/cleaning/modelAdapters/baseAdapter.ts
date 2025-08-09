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
    return `You are a legal entity name extraction specialist. Your task is to identify potential company names for GLEIF (Global Legal Entity Identifier Foundation) database searches.

    IMPORTANT: Always respond in English, regardless of the source language.
    
    Return a JSON object with the following structure:
    {
      "primaryEntityName": "Most likely legal entity name found (with suffix if present)",
      "baseEntityName": "Core company name without any suffix or descriptive terms",
      "companyName": "Primary company name as commonly used (for backwards compatibility)",
      "entityCandidates": [
        "Array of potential legal entity names found in the text",
        "Include variations with different suffixes (Ltd, Inc, LLC, Pvt Ltd, etc.)",
        "Each should be a complete legal entity name"
      ],
      "nameVariations": [
        "Different spellings or formats of the base name",
        "Include with/without spaces, capitals, punctuation",
        "Example: 'ELcomponics', 'Elcomponics', 'EL componics'"
      ],
      "parentOrSubsidiaries": [
        "Any mentioned parent companies or subsidiaries",
        "Include group company names"
      ],
      "excludeTerms": [
        "Marketing or descriptive terms to NOT use in searches",
        "Examples: 'manufacturers', 'suppliers', 'solutions', 'provider'"
      ],
      "confidenceIndicators": {
        "hasLegalSuffix": true/false,
        "foundInCopyright": true/false,
        "foundInLegalText": true/false,
        "multipleNamesFound": true/false
      },
      "addresses": ["Array of physical addresses for reference"],
      "emails": ["Array of email addresses for reference"],
      "phones": ["Array of phone numbers for reference"]
    }
    
    Guidelines for Entity Name Extraction:
    - Focus ONLY on proper nouns that could be company names
    - Separate the base name from descriptive terms (e.g., "Apple" not "Apple technology leader")
    - If you see "CompanyName - description", extract only "CompanyName"
    - Common suffixes to recognize: Inc, Corp, LLC, Ltd, Limited, Pvt Ltd, GmbH, SA, SAS, BV, AG, SpA, s.r.o.
    - Do NOT include generic business terms as entity names
    - Look for names in: copyright notices, legal text, about sections, contact info
    - If multiple related entities exist (parent/subsidiary), list them all
    - Generate reasonable variations of the base name for search purposes
    
    Examples:
    - From "ELCOMPONICS-wire harness manufacturers" → baseEntityName: "Elcomponics", excludeTerms: ["wire", "harness", "manufacturers"]
    - From "© 2024 Acme Technologies Inc." → primaryEntityName: "Acme Technologies Inc", baseEntityName: "Acme"
    - From "Microsoft Corporation" → baseEntityName: "Microsoft", entityCandidates: ["Microsoft Corporation", "Microsoft Corp", "Microsoft Inc"]`;
  }
}