
import axios from 'axios';

interface PerplexityExtractionResult {
  domain: string;
  method: 'perplexity_llm';
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
  llmResponse: any;
  rawAnalysis: string;
}

export class PerplexityExtractor {
  private apiKey: string | undefined;
  private baseURL = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    // You'll need to set your Perplexity API key in Secrets
    this.apiKey = process.env.PERPLEXITY_API_KEY;
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
        llmResponse: null,
        rawAnalysis: ''
      };
    }

    try {
      const prompt = this.createExtractionPrompt(domain);
      
      const response = await axios.post(this.baseURL, {
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const llmResponse = response.data;
      const analysisText = llmResponse.choices[0]?.message?.content || '';

      // Parse the JSON response from LLM
      let extractedData;
      try {
        extractedData = JSON.parse(analysisText);
      } catch (parseError) {
        // If JSON parsing fails, try to extract from text
        extractedData = this.fallbackExtraction(analysisText);
      }

      return {
        domain,
        method: 'perplexity_llm',
        companyName: extractedData.legal_entity || extractedData.company_name || null,
        confidence: extractedData.confidence || 0,
        processingTime: Date.now() - startTime,
        success: !!extractedData.legal_entity || !!extractedData.company_name,
        error: null,
        llmResponse: llmResponse,
        rawAnalysis: analysisText
      };

    } catch (error: any) {
      console.error('[Perplexity] API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      
      return {
        domain,
        method: 'perplexity_llm',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error.response?.data?.error?.message || error.message || 'Unknown error',
        llmResponse: null,
        rawAnalysis: ''
      };
    }
  }

  private createExtractionPrompt(domain: string): string {
    return `
Please visit the homepage of ${domain} and analyze it to find the official legal entity name of the company.

Your task:
1. Read the homepage content of https://${domain}
2. Look for the official legal entity name (company name with legal suffix like Inc., Corp., LLC, Ltd., AG, S.A., etc.)
3. Check footer copyright notices, about sections, legal pages, terms of service
4. Identify the primary business entity that owns/operates this website

Return your response in this exact JSON format:
{
  "legal_entity": "Exact Legal Entity Name with suffix",
  "confidence": number between 0-100,
  "evidence_source": "where you found this information",
  "business_description": "brief description of what the company does",
  "jurisdiction": "country/state where incorporated if found",
  "analysis": "brief explanation of your findings"
}

Requirements:
- Include legal suffixes (Inc., Corp., LLC, Ltd., AG, S.A., GmbH, etc.)
- If multiple entities found, return the primary/parent company
- If no clear legal entity found, set legal_entity to null
- Confidence should reflect how certain you are about the legal entity name
- Return ONLY valid JSON, no additional text

Domain to analyze: https://${domain}
`;
  }

  private fallbackExtraction(text: string): any {
    // Simple fallback to extract company name if JSON parsing fails
    const companyMatch = text.match(/(?:legal_entity|company)[":]*\s*["']([^"']+)["']/i);
    const confidenceMatch = text.match(/confidence[":]*\s*(\d+)/i);
    
    return {
      legal_entity: companyMatch ? companyMatch[1] : null,
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 0,
      evidence_source: 'fallback_extraction',
      analysis: text.substring(0, 200)
    };
  }
}
