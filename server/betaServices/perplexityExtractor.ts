
import OpenAI from 'openai';

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
}

export class PerplexityExtractor {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai'
    });
  }

  async extractFromDomain(domain: string, includeDetails: boolean = false): Promise<PerplexityResult> {
    const startTime = Date.now();

    try {
      if (!process.env.PERPLEXITY_API_KEY) {
        throw new Error('PERPLEXITY_API_KEY environment variable is not set');
      }

      const prompt = `What is the official company name for the domain ${domain}? Please provide:
1. The exact legal company name
2. The country where the company is registered
3. The type of legal entity (e.g., Corporation, LLC, Ltd, etc.)

Respond in JSON format with keys: companyName, country, legalEntityType`;

      const response = await this.client.chat.completions.create({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Perplexity API');
      }

      // Try to parse JSON response
      let parsedData;
      try {
        parsedData = JSON.parse(content);
      } catch {
        // If JSON parsing fails, extract company name from text
        const lines = content.split('\n');
        const companyLine = lines.find(line => 
          line.toLowerCase().includes('company') || 
          line.toLowerCase().includes('name')
        );
        parsedData = { 
          companyName: companyLine?.split(':')[1]?.trim() || null,
          country: null,
          legalEntityType: null
        };
      }

      const processingTime = Date.now() - startTime;

      return {
        companyName: parsedData.companyName,
        confidence: parsedData.companyName ? 80 : 0,
        success: !!parsedData.companyName,
        error: null,
        extractionMethod: 'perplexity_llm',
        technicalDetails: `Perplexity API response processed in ${processingTime}ms`,
        processingTime,
        country: parsedData.country,
        llmResponse: includeDetails ? content : undefined,
        sources: [],
        legalEntityType: parsedData.legalEntityType
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      return {
        companyName: null,
        confidence: 0,
        success: false,
        error: error.message,
        extractionMethod: null,
        technicalDetails: `Error after ${processingTime}ms: ${error.message}`,
        processingTime
      };
    }
  }
}
