
import OpenAI from 'openai';

// Configuration interface for better type safety
interface PerplexityConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
  baseURL: string;
}

// Enhanced result interface with more detailed information
interface PerplexityResult {
  companyName: string | null;
  confidence: number;
  success: boolean;
  error: string | null;
  extractionMethod: string | null;
  technicalDetails: string | null;
  processingTime: number;
  country?: string;
  llmResponse?: string;
  sources?: string[];
  legalEntityType?: string;
  errorCode?: string | null;
  citations?: any[];
  parsedJson?: any;
}

// Custom error classes for better error handling
class PerplexityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "PerplexityError";
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PerplexityExtractor {
  private client: OpenAI;
  private config: PerplexityConfig;
  private requestCache: Map<string, PerplexityResult> = new Map();
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

  constructor(customConfig?: Partial<PerplexityConfig>) {
    const apiKey = process.env.PERPLEXITY_API_KEY || "";
    
    if (!apiKey) {
      throw new PerplexityError(
        "PERPLEXITY_API_KEY not found in environment variables",
        "MISSING_API_KEY"
      );
    }

    this.config = {
      apiKey,
      model: "sonar", // Using sonar as specified
      maxTokens: 500,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3,
      baseURL: "https://api.perplexity.ai",
      ...customConfig,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL
    });
  }

  async extractFromDomain(
    domain: string, 
    includeDetails: boolean = false,
    useCache: boolean = true
  ): Promise<PerplexityResult> {
    const startTime = Date.now();
    const normalizedDomain = this.normalizeDomain(domain);

    try {
      // Input validation
      this.validateDomain(normalizedDomain);

      // Check cache first
      if (useCache && this.requestCache.has(normalizedDomain)) {
        const cachedResult = this.requestCache.get(normalizedDomain)!;
        console.log(`🎯 Cache hit for domain: ${normalizedDomain}`);
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
        };
      }

      // Rate limiting
      await this.enforceRateLimit();

      // Make API request with retry logic
      const result = await this.makeRequestWithRetry(normalizedDomain, startTime, includeDetails);

      // Cache successful results
      if (result.success && useCache) {
        this.requestCache.set(normalizedDomain, result);
      }

      return result;
    } catch (error) {
      return this.handleError(error, normalizedDomain, startTime);
    }
  }

  /**
   * Validate domain format
   */
  private validateDomain(domain: string): void {
    if (!domain || typeof domain !== "string") {
      throw new ValidationError("Domain must be a non-empty string");
    }

    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];
    
    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    
    if (!domainRegex.test(cleanDomain)) {
      throw new ValidationError(`Invalid domain format: ${domain}`);
    }

    if (cleanDomain.length > 253) {
      throw new ValidationError("Domain name too long (max 253 characters)");
    }
  }

  /**
   * Normalize domain by removing protocol and trailing slashes
   */
  private normalizeDomain(domain: string): string {
    return domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Make API request with retry logic
   */
  private async makeRequestWithRetry(
    domain: string,
    startTime: number,
    includeDetails: boolean
  ): Promise<PerplexityResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${this.config.maxRetries} for domain: ${domain}`);
        
        const result = await this.makeApiRequest(domain, startTime, includeDetails);
        
        if (result.success) {
          console.log(`✅ Success on attempt ${attempt} for domain: ${domain}`);
          return result;
        }
        
        // If not successful but no error, don't retry
        if (!result.error) {
          return result;
        }
        
        lastError = new Error(result.error);
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Attempt ${attempt} failed for domain: ${domain} - ${lastError.message}`);
        
        // Don't retry on validation errors or auth errors
        if (error instanceof ValidationError || 
            (error as any).response?.status === 401 || 
            (error as any).response?.status === 403) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const waitTime = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError || new PerplexityError("All retry attempts failed", "MAX_RETRIES_EXCEEDED");
  }

  /**
   * Make the actual API request
   */
  private async makeApiRequest(
    domain: string,
    startTime: number,
    includeDetails: boolean
  ): Promise<PerplexityResult> {
    const prompt = this.createOptimizedPrompt(domain);

    console.log(`🚀 Making API request for domain: ${domain} with model: ${this.config.model}`);

    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: this.getSystemPrompt(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    return this.processApiResponse(response, domain, startTime, includeDetails);
  }

  /**
   * Get optimized system prompt
   */
  private getSystemPrompt(): string {
    return `You are a corporate research expert specializing in identifying legal business entities from websites. 

Your task is to analyze the provided domain by examining:
- About us pages and company information
- Footer content and legal notices
- Terms of service and privacy policies
- Copyright notices and legal disclaimers
- Contact information and business registration details

Extract the official legal entity name that operates the website. Respond ONLY with a valid JSON object, no additional text.`;
  }

  /**
   * Create optimized prompt for domain extraction
   */
  private createOptimizedPrompt(domain: string): string {
    return `Analyze the website ${domain} and extract the official legal entity information.

Search for the complete legal business name including any corporate suffixes (Inc., Corp., Ltd., LLC, GmbH, etc.).

Respond with this exact JSON structure:
{
  "company_name": "Full legal entity name with suffix",
  "legal_entity_type": "Corporation/LLC/Limited Company/etc",
  "country": "Country of incorporation or primary business location",
  "confidence": "high/medium/low",
  "sources": ["List of specific pages or sections where information was found"]
}

Return only the JSON object, no other text.`;
  }

  /**
   * Process API response and extract company information
   */
  private processApiResponse(
    response: any,
    domain: string,
    startTime: number,
    includeDetails: boolean
  ): PerplexityResult {
    const content = response.choices?.[0]?.message?.content;
    const citations = response.citations || [];

    if (!content) {
      throw new Error('No response from Perplexity API');
    }

    console.log(`📄 Raw response for ${domain}:`, content.slice(0, 200) + "...");

    // Parse JSON response with multiple fallback strategies
    const { parsedJson, extractedData } = this.parseJsonResponse(content);

    // Calculate confidence score
    const confidence = this.calculateConfidence(extractedData, parsedJson, citations.length);

    const processingTime = Date.now() - startTime;

    return {
      companyName: extractedData.companyName,
      confidence,
      success: !!extractedData.companyName,
      error: null,
      errorCode: null,
      extractionMethod: parsedJson ? "json_extraction" : "text_extraction",
      technicalDetails: `Model: ${this.config.model}, Citations: ${citations.length}, Processing: ${processingTime}ms`,
      processingTime,
      country: extractedData.country,
      legalEntityType: extractedData.legalEntityType,
      sources: extractedData.sources,
      llmResponse: includeDetails ? content : undefined,
      citations: includeDetails ? citations : undefined,
      parsedJson: includeDetails ? parsedJson : undefined,
    };
  }

  /**
   * Parse JSON response with multiple fallback strategies
   */
  private parseJsonResponse(rawContent: string): {
    parsedJson: any;
    extractedData: {
      companyName: string | null;
      legalEntityType: string | null;
      country: string | null;
      sources: string[];
    };
  } {
    let parsedJson = null;
    let extractedData = {
      companyName: null as string | null,
      legalEntityType: null as string | null,
      country: null as string | null,
      sources: [] as string[],
    };

    // Strategy 1: Find JSON block between { and }
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log("🔍 JSON block parsing failed, trying full content...");
    }

    // Strategy 2: Try parsing entire content as JSON
    if (!parsedJson) {
      try {
        parsedJson = JSON.parse(rawContent.trim());
      } catch (error) {
        console.log("🔍 Full content JSON parsing failed");
      }
    }

    // Extract data from parsed JSON
    if (parsedJson) {
      extractedData = {
        companyName: parsedJson.company_name || parsedJson.legal_entity || parsedJson.name || null,
        legalEntityType: parsedJson.legal_entity_type || parsedJson.entity_type || null,
        country: parsedJson.country || parsedJson.jurisdiction || null,
        sources: Array.isArray(parsedJson.sources) ? parsedJson.sources : [],
      };
    } else {
      // Fallback text parsing
      const lines = rawContent.split('\n');
      const companyLine = lines.find(line => 
        line.toLowerCase().includes('company') || 
        line.toLowerCase().includes('name')
      );
      if (companyLine) {
        extractedData.companyName = companyLine.split(':')[1]?.trim() || null;
      }
    }

    return { parsedJson, extractedData };
  }

  /**
   * Calculate confidence score based on available data
   */
  private calculateConfidence(
    extractedData: any,
    parsedJson: any,
    citationCount: number
  ): number {
    if (!extractedData.companyName) return 0;

    let confidence = 60; // Base confidence for having company name

    // Boost confidence based on data completeness
    if (extractedData.legalEntityType) confidence += 15;
    if (extractedData.country) confidence += 10;
    if (extractedData.sources.length > 0) confidence += 10;

    // Boost confidence based on citation count
    confidence += Math.min(citationCount * 5, 15);

    // Use raw confidence if available and reasonable
    if (parsedJson?.confidence) {
      const rawConfidence = parsedJson.confidence.toLowerCase();
      if (rawConfidence === "high") confidence = Math.max(confidence, 90);
      else if (rawConfidence === "medium") confidence = Math.max(confidence, 70);
      else if (rawConfidence === "low") confidence = Math.max(confidence, 50);
    }

    // Additional boost for well-structured JSON response
    if (parsedJson && Object.keys(parsedJson).length > 2) {
      confidence += 5;
    }

    return Math.min(confidence, 95); // Cap at 95%
  }

  /**
   * Handle errors and return structured error response
   */
  private handleError(
    error: any,
    domain: string,
    startTime: number
  ): PerplexityResult {
    let errorMessage = "Unknown error occurred";
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof ValidationError) {
      errorMessage = error.message;
      errorCode = "VALIDATION_ERROR";
    } else if (error instanceof PerplexityError) {
      errorMessage = error.message;
      errorCode = error.code;
    } else if (error.response) {
      // HTTP error
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      errorCode = `HTTP_${error.response.status}`;
    } else if (error.code === "ECONNABORTED") {
      errorMessage = "Request timeout";
      errorCode = "TIMEOUT";
    } else if (error.message) {
      errorMessage = error.message;
      errorCode = error.code || "API_ERROR";
    }

    console.error(`❌ Error processing domain ${domain}:`, errorMessage);

    return {
      companyName: null,
      confidence: 0,
      success: false,
      error: errorMessage,
      errorCode,
      extractionMethod: null,
      technicalDetails: `Error occurred during processing: ${errorCode}`,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Clear the request cache
   */
  public clearCache(): void {
    this.requestCache.clear();
    console.log("🗑️ Request cache cleared");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.requestCache.size,
      domains: Array.from(this.requestCache.keys()),
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PerplexityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("⚙️ Configuration updated");
  }
}

// Export types for external use
export type { PerplexityResult, PerplexityConfig };
export { PerplexityError, ValidationError };
