import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractionResult {
  companyName: string | null;
  method: 'html_title' | 'meta_description' | 'domain_parse';
  confidence: number;
  error?: string;
}

export class DomainExtractor {
  private timeout = 10000; // 10 seconds
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async extractCompanyName(domain: string): Promise<ExtractionResult> {
    try {
      // Ensure domain has protocol
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      // Try HTML extraction first
      const htmlResult = await this.extractFromHTML(url);
      if (htmlResult.companyName) {
        return htmlResult;
      }
      
      // Fallback to domain parsing
      return this.extractFromDomain(domain);
    } catch (error) {
      // Fallback to domain parsing on any error
      return this.extractFromDomain(domain);
    }
  }

  private async extractFromHTML(url: string): Promise<ExtractionResult> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
        },
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      
      // Try title tag first
      const title = $('title').text().trim();
      if (title) {
        const companyName = this.cleanCompanyName(title);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'html_title',
            confidence: this.calculateConfidence(companyName, 'html_title'),
          };
        }
      }
      
      // Try meta description
      const metaDescription = $('meta[name="description"]').attr('content');
      if (metaDescription) {
        const companyName = this.extractCompanyFromText(metaDescription);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'meta_description',
            confidence: this.calculateConfidence(companyName, 'meta_description'),
          };
        }
      }
      
      // Try other common selectors
      const selectors = [
        'h1',
        '.company-name',
        '#company-name',
        '.brand',
        '.logo',
        'header h1',
        'nav .brand',
      ];
      
      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length) {
          const text = element.text().trim();
          const companyName = this.cleanCompanyName(text);
          if (companyName && this.isValidCompanyName(companyName)) {
            return {
              companyName,
              method: 'html_title',
              confidence: this.calculateConfidence(companyName, 'html_title') - 10,
            };
          }
        }
      }
      
      return { companyName: null, method: 'html_title', confidence: 0 };
    } catch (error) {
      return { 
        companyName: null, 
        method: 'html_title', 
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractFromDomain(domain: string): ExtractionResult {
    // Remove protocol and www
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('.')[0];
    
    // Convert to company name format
    const companyName = this.domainToCompanyName(cleanDomain);
    
    return {
      companyName,
      method: 'domain_parse',
      confidence: this.calculateConfidence(companyName, 'domain_parse'),
    };
  }

  private cleanCompanyName(text: string): string {
    // Remove common suffixes and prefixes
    return text
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash
      .replace(/\s*\|\s*.*$/, '') // Remove everything after pipe
      .replace(/\s*:.*$/, '') // Remove everything after colon
      .replace(/^(Home|Welcome to|About)\s*/i, '') // Remove common prefixes
      .replace(/\s*(Inc|LLC|Ltd|Corp|Corporation|Company|Co)\.?$/i, '') // Remove company suffixes
      .trim();
  }

  private extractCompanyFromText(text: string): string {
    // Look for company patterns in text
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 2 && words.length <= 5) {
        // Check if it looks like a company name
        const potential = words.join(' ').trim();
        if (this.isValidCompanyName(potential)) {
          return potential;
        }
      }
    }
    return this.cleanCompanyName(text);
  }

  private domainToCompanyName(domain: string): string {
    // Convert domain to readable company name
    return domain
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private isValidCompanyName(name: string): boolean {
    if (!name || name.length < 2 || name.length > 100) return false;
    
    // Check for common invalid patterns
    const invalidPatterns = [
      /^(home|about|contact|login|register|sign|error|404|403|500)$/i,
      /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i,
      /^\d+$/,
      /^[^\w\s]+$/,
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(name.trim()));
  }

  private calculateConfidence(companyName: string, method: string): number {
    let confidence = 50; // Base confidence
    
    // Method-based confidence
    switch (method) {
      case 'html_title':
        confidence += 30;
        break;
      case 'meta_description':
        confidence += 20;
        break;
      case 'domain_parse':
        confidence += 10;
        break;
    }
    
    // Length-based confidence
    if (companyName.length >= 3 && companyName.length <= 30) {
      confidence += 10;
    }
    
    // Word count confidence
    const wordCount = companyName.split(/\s+/).length;
    if (wordCount >= 1 && wordCount <= 4) {
      confidence += 10;
    }
    
    // Capitalization confidence
    if (/^[A-Z]/.test(companyName)) {
      confidence += 5;
    }
    
    return Math.min(confidence, 100);
  }
}
