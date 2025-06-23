import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractionResult {
  companyName: string | null;
  method: string;
  confidence: number;
  error?: string;
}

export class CompanyNameExtractor {
  private session: any;

  constructor() {
    this.session = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 3,
    });
  }

  async extractCompanyName(domain: string): Promise<ExtractionResult> {
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const response = await this.session.get(url);
      const html = response.data;
      
      // Try HTML title extraction first
      const titleResult = this.extractFromTitle(html);
      if (titleResult.companyName && titleResult.confidence > 70) {
        return titleResult;
      }

      // Try meta description extraction
      const metaResult = this.extractFromMeta(html);
      if (metaResult.companyName && metaResult.confidence > 60) {
        return metaResult;
      }

      // Fallback to domain parsing
      const domainResult = this.extractFromDomain(domain);
      return domainResult;

    } catch (error: any) {
      // Fallback to domain parsing on error
      const domainResult = this.extractFromDomain(domain);
      if (domainResult.companyName) {
        return domainResult;
      }

      return {
        companyName: null,
        method: 'failed',
        confidence: 0,
        error: error.message || 'Failed to extract company name'
      };
    }
  }

  private extractFromTitle(html: string): ExtractionResult {
    const $ = cheerio.load(html);
    const title = $('title').text().trim();
    
    if (!title) {
      return { companyName: null, method: 'html_title', confidence: 0 };
    }

    // Clean up common title patterns
    let companyName = title
      .replace(/\s*[-|–]\s*.*$/, '') // Remove everything after dash or pipe
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*:.*$/, '') // Remove everything after colon
      .replace(/^\s*Welcome to\s*/i, '')
      .replace(/^\s*Home\s*[-|]\s*/i, '')
      .trim();

    // Calculate confidence based on length and common patterns
    let confidence = 85;
    if (companyName.length < 3) confidence = 20;
    else if (companyName.length < 10) confidence = 60;
    else if (companyName.includes('Inc.') || companyName.includes('LLC') || 
             companyName.includes('Corp') || companyName.includes('Ltd')) {
      confidence = 95;
    }

    return {
      companyName: companyName || null,
      method: 'html_title',
      confidence
    };
  }

  private extractFromMeta(html: string): ExtractionResult {
    const $ = cheerio.load(html);
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || '';
    
    if (!description) {
      return { companyName: null, method: 'meta_description', confidence: 0 };
    }

    // Extract potential company name from description
    const sentences = description.split(/[.!?]/);
    const firstSentence = sentences[0]?.trim();
    
    if (!firstSentence) {
      return { companyName: null, method: 'meta_description', confidence: 0 };
    }

    // Look for company indicators
    const companyPatterns = [
      /^([A-Z][a-zA-Z\s&]+(?:Inc\.|LLC|Corp|Ltd|Corporation|Company))/,
      /^([A-Z][a-zA-Z\s&]+)\s+is\s+/,
      /^Welcome to ([A-Z][a-zA-Z\s&]+)/,
      /^([A-Z][a-zA-Z\s&]{3,30})\s*[-–]/
    ];

    for (const pattern of companyPatterns) {
      const match = firstSentence.match(pattern);
      if (match) {
        return {
          companyName: match[1].trim(),
          method: 'meta_description',
          confidence: 75
        };
      }
    }

    return { companyName: null, method: 'meta_description', confidence: 0 };
  }

  private extractFromDomain(domain: string): ExtractionResult {
    // Clean domain
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('.')[0];

    if (!cleanDomain || cleanDomain.length < 2) {
      return { companyName: null, method: 'domain_parse', confidence: 0 };
    }

    // Convert to title case
    const companyName = cleanDomain
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Calculate confidence based on domain characteristics
    let confidence = 50;
    if (cleanDomain.includes('-') || cleanDomain.includes('_')) confidence = 45;
    if (cleanDomain.length > 10) confidence = 40;
    if (/^[a-z]+$/.test(cleanDomain) && cleanDomain.length < 8) confidence = 65;

    return {
      companyName,
      method: 'domain_parse',
      confidence
    };
  }
}
