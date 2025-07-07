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
            content: 'You are a corporate research expert. Search the web and provide direct answers about company legal entities. Always respond with valid JSON format only.'
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
        // Look for JSON in the response
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[0]);
          extractedCompany = parsedJson.company_name || parsedJson.legal_entity || parsedJson.name;
          console.log('✅ Successfully parsed JSON:', parsedJson);
        } else {
          console.log('❌ No JSON found in response');
        }
      } catch (parseError) {
        console.log('❌ JSON parsing failed:', parseError);
      }

      const result = {
        domain,
        method: 'perplexity_llm',
        companyName: extractedCompany,
        confidence: extractedCompany ? 85 : 0,
        processingTime: Date.now() - startTime,
        success: !!extractedCompany,
        error: null,
        llmResponse: {
          content: rawText,
          citations: citations,
          parsedJson: parsedJson
        },
        extractionMethod: parsedJson ? 'perplexity_json' : null,
        technicalDetails: `Sonar-reasoning model with ${citations.length} citations`
      };

      console.log('🔄 Final result:', { 
        domain, 
        success: result.success, 
        companyName: result.companyName,
        hasJson: !!parsedJson
      });

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

Please search the web and provide your response in the following JSON format:

{
  "company_name": "Full legal entity name with suffix",
  "legal_entity_type": "Corporation/Limited Company/LLC/etc",
  "country": "Country of incorporation",
  "confidence": "high/medium/low",
  "sources": ["List of sources used"]
}

Only return the JSON object, no other text.`;
  }
}