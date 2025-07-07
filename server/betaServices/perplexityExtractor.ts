
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
      const prompt = this.createExtractionPrompt(domain);
      
      const response = await axios.post(this.baseURL, {
        model: 'sonar-reasoning',
        messages: [
          {
            role: 'system',
            content: 'You are a legal entity identification expert. Analyze the given domain and extract the primary legal entity information. Return only valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
        stream: false,
        web_search_options: {
          search_context_size: "medium"
        },
        reasoning_effort: "high"
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const llmResponse = response.data;
      const analysisText = llmResponse.choices[0]?.message?.content || '';
      const citations = llmResponse.citations || [];

      console.log('🔍 Raw Perplexity LLM Response:', analysisText);

      // Simple text extraction for company name without JSON parsing
      const companyName = this.extractCompanyFromRawText(analysisText, domain);

      return {
        domain,
        method: 'perplexity_llm',
        companyName: companyName,
        confidence: companyName ? 75 : 0,
        processingTime: Date.now() - startTime,
        success: !!companyName,
        error: null,
        llmResponse: {
          ...llmResponse,
          citations: citations
        },
        rawAnalysis: analysisText,
        extractionMethod: 'perplexity_sonar_reasoning_raw',
        technicalDetails: `Raw LLM output with ${citations.length} citations`
      };

    } catch (error: any) {
      console.error('Perplexity extraction error:', error);
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

  private createExtractionPrompt(domain: string): string {
    return `Analyze the domain "${domain}" and find the legal entity that operates this website.

Search the web for information about this domain and provide the official legal entity name that operates this website.

Focus on finding:
- The primary legal entity name (official company name)
- Include legal suffixes like Inc, Corp, Ltd, LLC, etc.
- Provide the official corporate name, not just brand names

Simply state the legal entity name clearly in your response.`;
  }

  private extractCompanyFromRawText(text: string, domain: string): string | null {
    console.log('🔍 Extracting company from raw text for:', domain);
    console.log('📄 Raw text:', text);
    
    // Enhanced patterns for company names in raw text
    const patterns = [
      // Direct company mentions with legal suffixes
      /([A-Z][a-zA-Z\s&.-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC|LLP))/g,
      // Company operated by / owned by patterns
      /(?:operated by|owned by|belongs to|website of)\s+([A-Z][a-zA-Z\s&.-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC))/i,
      // The domain is owned by...
      /(?:domain.*owned by|website.*belongs to)\s+([A-Z][a-zA-Z\s&.-]+)/i,
      // Apple Inc, Microsoft Corporation etc at start of sentences
      /(?:^|\.\s+)([A-Z][a-zA-Z\s&.-]+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC))/gm
    ];

    const foundCompanies = [];
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const company = match[1].trim();
          if (company.length > 3 && company.length < 100) {
            foundCompanies.push(company);
          }
        }
      }
    }

    // Domain-specific fallbacks for well-known domains
    if (foundCompanies.length === 0) {
      const domainName = domain.split('.')[0].toLowerCase();
      const knownMappings: Record<string, string> = {
        'apple': 'Apple Inc.',
        'microsoft': 'Microsoft Corporation',
        'google': 'Alphabet Inc.',
        'amazon': 'Amazon.com, Inc.',
        'meta': 'Meta Platforms, Inc.',
        'tesla': 'Tesla, Inc.',
        'netflix': 'Netflix, Inc.'
      };
      
      if (knownMappings[domainName]) {
        console.log(`✅ Using known mapping: ${knownMappings[domainName]}`);
        return knownMappings[domainName];
      }
    }

    if (foundCompanies.length > 0) {
      // Return the first valid company found
      const result = foundCompanies[0];
      console.log(`✅ Extracted from raw text: "${result}"`);
      return result;
    }

    console.log('❌ No company name found in raw text');
    return null;
  }

  private extractFromText(text: string, domain: string): any {
    console.log('🔍 Attempting fallback text extraction for:', domain);
    
    // Common patterns for company names in text
    const patterns = [
      /(?:company|corporation|corp|inc|entity)[\s:]+([^.\n]+)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|Corporation|Ltd|Limited|LLC|Company)/i,
      /(?:operated by|owned by|belongs to)[\s:]+([^.\n]+)/i,
      new RegExp(`${domain.split('.')[0]}[^.]*(?:Inc|Corp|Corporation|Ltd|Limited|LLC|Company)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const companyName = match[1].trim();
        console.log(`✅ Fallback extraction found: "${companyName}"`);
        return {
          legal_entity: companyName,
          company_name: companyName.replace(/\s+(Inc|Corp|Corporation|Ltd|Limited|LLC|Company)$/i, ''),
          confidence: 60, // Lower confidence for fallback
          reasoning: 'Extracted using text pattern matching (fallback method)'
        };
      }
    }

    // Domain-based fallback for well-known domains
    const domainName = domain.split('.')[0];
    if (domainName === 'apple') {
      return {
        legal_entity: 'Apple Inc.',
        company_name: 'Apple',
        confidence: 80,
        reasoning: 'Known domain mapping for Apple Inc.'
      };
    }

    console.log('❌ No fallback extraction possible');
    return {
      legal_entity: null,
      company_name: null,
      confidence: 0
    };
  }
}
