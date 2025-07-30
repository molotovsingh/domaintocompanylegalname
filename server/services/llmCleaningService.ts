import axios from 'axios';

interface CleaningRequest {
  rawDump: string;
  domain: string;
}

interface CleanedData {
  companyName?: string;
  addresses: string[];
  phones: string[];
  emails: string[];
  currencies: string[];
  footerLegal?: string;
  keyText?: string;
  links: {
    internal: string[];
    external: string[];
  };
}

export class LLMCleaningService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenRouter API key not found - cleaning service disabled');
    }
  }

  async cleanDump(request: CleaningRequest): Promise<CleanedData | null> {
    if (!this.apiKey) {
      console.log('Skipping LLM cleaning - no API key');
      return null;
    }

    const systemPrompt = `You are a web scraping data cleaning assistant. Extract and structure the following information from the provided text:
1. Company legal name (with suffix like Inc, Ltd, S.A.)
2. All physical addresses found
3. Phone numbers with country codes
4. Email addresses
5. Currencies mentioned (codes or symbols)
6. Legal/copyright text from footer
7. Key business description text
8. Categorize links as internal or external

Return as JSON in this exact format:
{
  "companyName": "string or null",
  "addresses": ["array of addresses"],
  "phones": ["array of phones"],
  "emails": ["array of emails"],
  "currencies": ["array of currencies"],
  "footerLegal": "string or null",
  "keyText": "string or null",
  "links": {
    "internal": ["array of internal URLs"],
    "external": ["array of external URLs"]
  }
}`;

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Clean and extract data from this website dump for ${request.domain}:\n\n${request.rawDump}`
            }
          ],
          max_tokens: 4096,
          temperature: 0.1  // Low temperature for consistent output
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.choices[0].message.content;
      
      // Parse JSON response
      try {
        const parsed = JSON.parse(content);
        return parsed as CleanedData;
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content);
        // Attempt to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json?\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]) as CleanedData;
        }
        return null;
      }
      
    } catch (error) {
      console.error('LLM cleaning failed:', error);
      return null;
    }
  }

  /**
   * Two-stage cleaning pipeline:
   * 1. Traditional HTML stripping (instant, free)
   * 2. LLM enhancement (fast, FREE with Llama 3.1 8B!)
   */
  async cleanWithPipeline(rawHTML: string, domain: string): Promise<CleanedData | null> {
    // Stage 1: Traditional cleaning
    const stripped = this.stripHTML(rawHTML);
    
    // Stage 2: LLM enhancement (FREE!)
    return await this.cleanDump({
      rawDump: stripped,
      domain: domain
    });
  }

  private stripHTML(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000); // Limit to ~50k chars for token efficiency
  }
}

// Singleton instance
export const llmCleaningService = new LLMCleaningService();