
import axios from 'axios';

interface PerplexityExtractionResult {
  domain: string;
  method: string;
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
  extractionMethod: string | null;
  technicalDetails: string | null;
  llmResponse?: any;
  rawAnalysis?: string;
}

export class PerplexityExtractor {
  private apiKey: string;
  private baseURL: string = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ PERPLEXITY_API_KEY not found in environment variables');
    }
  }

  async extractFromDomain(domain: string): Promise<PerplexityExtractionResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return {
        domain,
        method: 'perplexity_llm',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: 'Perplexity API key not configured',
        extractionMethod: null,
        technicalDetails: 'PERPLEXITY_API_KEY environment variable not set'
      };
    }

    try {
      const prompt = this.createSimplePrompt(domain);
      
      const response = await axios.post(this.baseURL, {
        model: 'sonar-reasoning',
        messages: [
          {
            role: 'system',
            content: 'You are a corporate research expert. Search the web and provide direct answers about company legal entities. Be concise and factual.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        stream: false,
        web_search_options: {
          search_context_size: "medium"
        },
        reasoning_effort: "medium"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const llmResponse = response.data;
      const rawText = llmResponse.choices[0]?.message?.content || '';
      const citations = llmResponse.citations || [];

      console.log('🔍 Raw Perplexity Response for', domain);
      console.log('📄 Response:', rawText.slice(0, 200) + '...');

      // Try to parse JSON from the response
      let parsedJson = null;
      let extractedCompany = null;
      
      try {
        // Extract JSON from response (handle cases where JSON is wrapped in markdown or other text)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
          extractedCompany = parsedJson.legal_entity_name || null;
          console.log('✅ Parsed JSON:', JSON.stringify(parsedJson, null, 2));
          console.log('✅ Extracted company from JSON:', extractedCompany);
        }
      } catch (jsonError) {
        console.log('⚠️ JSON parsing failed, falling back to text extraction');
      }

      // If JSON parsing failed or didn't extract a company, fall back to text extraction
      if (!extractedCompany) {
        console.log('🔄 Falling back to text extraction');
        extractedCompany = this.extractCompanyFromResponse(rawText, domain);
      }

      const result = {
        domain,
        method: 'perplexity_llm',
        companyName: extractedCompany,
        confidence: extractedCompany ? 80 : 0,
        processingTime: Date.now() - startTime,
        success: !!extractedCompany,
        error: null,
        llmResponse: {
          content: rawText,
          citations: citations,
          parsedJson: parsedJson
        },
        rawAnalysis: rawText,
        extractionMethod: parsedJson ? 'perplexity_json' : 'perplexity_text_fallback',
        technicalDetails: `Sonar-reasoning model with ${citations.length} citations`
      };

      console.log('🔄 Final result being returned:', JSON.stringify(result, null, 2));
      return result;

    } catch (error: any) {
      console.error('❌ Perplexity extraction error:', error.message);
      return {
        domain,
        method: 'perplexity_llm',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error.message || 'Unknown error',
        extractionMethod: null,
        technicalDetails: `Error: ${error.code || 'UNKNOWN'}`
      };
    }
  }

  private createSimplePrompt(domain: string): string {
    return `What is the official legal entity name (company name with legal suffix like Inc, Corp, Ltd, LLC, etc.) that operates the website ${domain}?

Please search the web and provide your response in JSON format:

{
  "legal_entity_name": "exact company name with proper legal suffix",
  "confidence": "high/medium/low",
  "verification_sources": ["source1", "source2"],
  "additional_info": "brief context about the company",
  "extraction_reasoning": "explanation of how you found this information"
}

Focus on finding the registered corporate entity, not just brand names. Ensure the response is valid JSON format.`;
  }

  private extractCompanyFromResponse(text: string, domain: string): string | null {
    console.log('🔍 Processing response for:', domain);
    
    // Clean the text for better processing
    const cleanText = text.replace(/[\n\r]+/g, ' ').trim();
    
    // Try multiple extraction strategies in order of reliability
    const strategies = [
      () => this.extractFromDirectMention(cleanText),
      () => this.extractFromSentencePatterns(cleanText),
      () => this.extractFromKnownDomains(domain),
      () => this.extractFromBusinessContext(cleanText)
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) {
        console.log(`✅ Extracted: "${result}" using strategy`);
        return result;
      }
    }

    console.log('❌ No company name extracted');
    return null;
  }

  private extractFromDirectMention(text: string): string | null {
    // Look for direct mentions of companies with legal suffixes
    const directPattern = /\b([A-Z][A-Za-z\s&.'-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC|LLP|GmbH))\b/g;
    const matches = text.match(directPattern);
    
    if (matches && matches.length > 0) {
      // Return the first valid match that looks like a real company
      for (const match of matches) {
        const cleaned = match.trim();
        if (cleaned.length > 4 && cleaned.length < 80) {
          return cleaned;
        }
      }
    }
    return null;
  }

  private extractFromSentencePatterns(text: string): string | null {
    // Look for patterns like "operated by X", "owned by X", etc.
    const patterns = [
      /(?:operated by|owned by|belongs to|website of|company is)\s+([A-Z][A-Za-z\s&.'-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC))/i,
      /(?:legal entity|corporate name|company name)(?:\s+is)?\s+([A-Z][A-Za-z\s&.'-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC))/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1].trim();
        if (cleaned.length > 4 && cleaned.length < 80) {
          return cleaned;
        }
      }
    }
    return null;
  }

  private extractFromKnownDomains(domain: string): string | null {
    // Fallback for well-known domains
    const domainName = domain.split('.')[0].toLowerCase();
    const knownMappings: Record<string, string> = {
      'apple': 'Apple Inc.',
      'microsoft': 'Microsoft Corporation',
      'google': 'Alphabet Inc.',
      'amazon': 'Amazon.com, Inc.',
      'meta': 'Meta Platforms, Inc.',
      'tesla': 'Tesla, Inc.',
      'netflix': 'Netflix, Inc.',
      'disney': 'The Walt Disney Company',
      'walmart': 'Walmart Inc.',
      'jpmorgan': 'JPMorgan Chase & Co.',
      'visa': 'Visa Inc.',
      'mastercard': 'Mastercard Incorporated'
    };
    
    return knownMappings[domainName] || null;
  }

  private extractFromBusinessContext(text: string): string | null {
    // Look for business context clues in the response
    const words = text.split(/\s+/);
    let potentialCompany = '';
    
    for (let i = 0; i < words.length - 1; i++) {
      const word = words[i];
      const nextWord = words[i + 1];
      
      // Look for capitalized words followed by business suffixes
      if (/^[A-Z][a-z]+$/.test(word) && /^(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC)$/i.test(nextWord)) {
        potentialCompany = `${word} ${nextWord}`;
        
        // Check if there are more capitalized words before this
        let j = i - 1;
        while (j >= 0 && /^[A-Z][a-z]+$/.test(words[j])) {
          potentialCompany = `${words[j]} ${potentialCompany}`;
          j--;
        }
        
        if (potentialCompany.length > 4 && potentialCompany.length < 80) {
          return potentialCompany.trim();
        }
      }
    }
    
    return null;
  }
}
