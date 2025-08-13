interface PerplexityRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: 'month' | 'year';
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  top_k?: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations?: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class PerplexityAdapter {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Perplexity] No API key found. Arbitration will use fallback strategies.');
    }
  }

  async callPerplexity(
    prompt: string,
    model: 'sonar' | 'sonar-pro' | 'sonar-reasoning' | 'sonar-reasoning-pro' = 'sonar-pro',
    temperature: number = 0.2
  ): Promise<PerplexityResponse | null> {
    if (!this.apiKey) {
      console.error('[Perplexity] Cannot make API call without API key');
      return null;
    }

    const requestBody: PerplexityRequest = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert in corporate entity resolution and acquisition research. Focus on identifying parent companies, understanding corporate hierarchies, and applying jurisdiction-based ranking. Provide step-by-step reasoning for your analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: 4000,
      search_domain_filter: ['gleif.org', 'sec.gov', 'companieshouse.gov.uk'],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: 'year',
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    };

    try {
      console.log('[Perplexity] Making arbitration request with model:', model);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Perplexity] API error:', response.status, errorText);
        return null;
      }

      const data = await response.json() as PerplexityResponse;
      console.log('[Perplexity] Response received. Tokens used:', data.usage?.total_tokens);
      
      if (data.citations) {
        console.log('[Perplexity] Citations provided:', data.citations.length);
      }

      return data;
    } catch (error) {
      console.error('[Perplexity] Request failed:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.callPerplexity(
        'What is GLEIF and what does LEI stand for? Answer in one sentence.',
        'sonar',
        0.1
      );
      
      return response !== null && response.choices?.length > 0;
    } catch (error) {
      console.error('[Perplexity] Connection test failed:', error);
      return false;
    }
  }

  parseArbitrationResponse(response: PerplexityResponse | null): any {
    if (!response || !response.choices?.[0]?.message?.content) {
      return null;
    }

    const content = response.choices[0].message.content;
    
    // Try to extract JSON from the response
    try {
      // Look for JSON block in the response
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try parsing the entire content as JSON
      return JSON.parse(content);
    } catch (error) {
      // If JSON parsing fails, return structured text response
      console.log('[Perplexity] Could not parse JSON, returning text response');
      return {
        rawResponse: content,
        citations: response.citations || []
      };
    }
  }
}

export const perplexityAdapter = new PerplexityAdapter();