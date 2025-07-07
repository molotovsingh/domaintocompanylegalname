
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

      // Parse the JSON response from LLM
      let extractedData;
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', parseError);
        extractedData = {
          legal_entity: null,
          company_name: null,
          confidence: 0
        };
      }

      return {
        domain,
        method: 'perplexity_llm',
        companyName: extractedData.legal_entity || extractedData.company_name || null,
        confidence: extractedData.confidence || 0,
        processingTime: Date.now() - startTime,
        success: !!extractedData.legal_entity || !!extractedData.company_name,
        error: null,
        llmResponse: {
          ...llmResponse,
          citations: citations
        },
        rawAnalysis: analysisText,
        extractionMethod: 'perplexity_sonar_reasoning',
        technicalDetails: `Perplexity Sonar API with ${citations.length} citations`
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

Search the web for information about this domain and extract:
1. The primary legal entity name (official company name)
2. The entity type (Corp, Inc, Ltd, LLC, etc.)
3. Your confidence level (0-100)

Return ONLY a JSON object in this exact format:
{
  "legal_entity": "Company Name Inc.",
  "company_name": "Company Name",
  "entity_type": "Corporation",
  "confidence": 85,
  "reasoning": "Brief explanation of findings"
}

Focus on the official legal entity, not brand names or trading names.`;
  }
}
