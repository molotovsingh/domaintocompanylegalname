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

    // Extract potential company name patterns
    let companyName = this.cleanCompanyName(title);
    
    // Skip if result looks like error messages or generic content
    if (this.isInvalidExtraction(companyName)) {
      return { companyName: null, method: 'html_title', confidence: 0 };
    }

    // Calculate confidence based on quality indicators
    const confidence = this.calculateTitleConfidence(companyName);

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

    // Enhanced patterns for legal entity extraction
    const companyPatterns = [
      // FOR-PROFIT: Exact legal entity patterns with suffixes
      /^([A-Z][a-zA-Z\s&,.]+?(?:\s+Inc\.?|\s+LLC|\s+Corp\.?|\s+Corporation|\s+Ltd\.?|\s+Limited|\s+Company|\s+Co\.?|\s+PVT\.?\s+LTD\.?|\s+Pvt\.?\s+Ltd\.?))/,
      // INSTITUTIONS: Educational and institutional patterns
      /^([A-Z][a-zA-Z\s&,.]+?(?:\s+University|\s+College|\s+Institute|\s+Foundation|\s+School|\s+Hospital|\s+Medical\s+Center))/,
      // Company is/was patterns  
      /^([A-Z][a-zA-Z\s&,.]+?)\s+(?:is|was)\s+(?:a|an|the)/,
      // Welcome to patterns
      /^Welcome to ([A-Z][a-zA-Z\s&,.]+?)(?:\s*[-–|]|\s*$)/,
      // Leading company name before dash
      /^([A-Z][a-zA-Z\s&,.]{3,40}?)\s*[-–]/,
      // At company patterns
      /^At ([A-Z][a-zA-Z\s&,.]+?)(?:,|\s*[-–])/
    ];

    for (const pattern of companyPatterns) {
      const match = firstSentence.match(pattern);
      if (match) {
        const companyName = this.cleanCompanyName(match[1]);
        
        if (!this.isInvalidExtraction(companyName)) {
          return {
            companyName: companyName,
            method: 'meta_description',
            confidence: 80
          };
        }
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

    // Enhanced domain-to-company mapping for known entities
    const knownMappings: Record<string, string> = {
      // FOR-PROFIT COMPANIES (with legal suffixes)
      'jnj': 'Johnson & Johnson',
      'jpmorganchase': 'JPMorgan Chase & Co.',
      'pg': 'The Procter & Gamble Company',
      'chevron': 'Chevron Corporation', 
      'homedepot': 'The Home Depot, Inc.',
      'berkshirehathaway': 'Berkshire Hathaway Inc.',
      'nvidia': 'NVIDIA Corporation',
      'meta': 'Meta Platforms, Inc.',
      'alphabet': 'Alphabet Inc.',
      'tesla': 'Tesla, Inc.',
      'amazon': 'Amazon.com, Inc.',
      'apple': 'Apple Inc.',
      'microsoft': 'Microsoft Corporation',
      'google': 'Alphabet Inc.',
      'facebook': 'Meta Platforms, Inc.',
      'lilly': 'Eli Lilly and Company',
      'visa': 'Visa Inc.',
      'mastercard': 'Mastercard Incorporated',
      'broadcom': 'Broadcom Inc.',
      'walmart': 'Walmart Inc.',
      'abc': 'Alphabet Inc.',
      'merck': 'Merck & Co., Inc.',
      'ge': 'General Electric Company',
      'ibm': 'International Business Machines Corporation',
      'intel': 'Intel Corporation',
      'cisco': 'Cisco Systems, Inc.',
      'oracle': 'Oracle Corporation',
      'salesforce': 'Salesforce, Inc.',
      'netflix': 'Netflix, Inc.',
      'adobe': 'Adobe Inc.',
      'paypal': 'PayPal Holdings, Inc.',
      // INSTITUTIONS (no legal suffixes)
      'harvard': 'Harvard University',
      'mit': 'Massachusetts Institute of Technology',
      'stanford': 'Stanford University',
      'yale': 'Yale University',
      'princeton': 'Princeton University'
    };

    // Check for known mapping first
    if (knownMappings[cleanDomain.toLowerCase()]) {
      return {
        companyName: knownMappings[cleanDomain.toLowerCase()],
        method: 'domain_parse',
        confidence: 90
      };
    }

    // Convert to title case for unknown domains
    const companyName = cleanDomain
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Calculate confidence based on domain characteristics
    let confidence = 45;
    if (cleanDomain.includes('-') || cleanDomain.includes('_')) confidence = 40;
    if (cleanDomain.length > 10) confidence = 35;
    if (/^[a-z]+$/.test(cleanDomain) && cleanDomain.length < 8) confidence = 55;

    return {
      companyName,
      method: 'domain_parse',
      confidence
    };
  }
  
  private cleanCompanyName(text: string): string {
    return text
      // Remove common website patterns
      .replace(/\s*[-|–]\s*.*$/, '') // Remove everything after dash or pipe
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*:.*$/, '') // Remove everything after colon
      .replace(/^\s*Welcome to\s*/i, '')
      .replace(/^\s*Home\s*[-|]\s*/i, '')
      // Remove descriptive phrases
      .replace(/\s*,\s*(the\s+)?(world|global|leading|trusted)\s+.*/i, '')
      .replace(/\s*-\s*(the\s+)?(world|global|leading|trusted)\s+.*/i, '')
      // Clean up whitespace
      .trim();
  }
  
  private isInvalidExtraction(text: string): boolean {
    if (!text || text.length < 2) return true;
    
    const invalidPatterns = [
      /due to several reasons/i,
      /access denied/i,
      /blocked/i,
      /error/i,
      /page not found/i,
      /404/i,
      /403/i,
      /unauthorized/i,
      /world leader in/i,
      /global leader in/i,
      /spend less\. smile more/i,
      /investor relations/i,
      /pay, send and save money/i,
      /ai infrastructure/i,
      /secure networking/i,
      /software solutions/i
    ];
    
    return invalidPatterns.some(pattern => pattern.test(text));
  }
  
  private calculateTitleConfidence(companyName: string): number {
    let confidence = 75;
    
    if (companyName.length < 3) confidence = 20;
    else if (companyName.length < 10) confidence = 60;
    
    // FOR-PROFIT COMPANIES: Higher confidence for proper legal entity suffixes
    const forProfitSuffixes = /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|PVT\.?\s+LTD\.?|Pvt\.?\s+Ltd\.?|L\.?L\.?C\.?)\b/i;
    if (forProfitSuffixes.test(companyName)) {
      confidence = 95;
    }
    
    // INSTITUTIONS: Moderate confidence for educational/institutional patterns
    const institutionalPatterns = /\b(University|College|Institute|Foundation|School|Hospital|Medical|Center|Association|Society|Department|Agency|Bureau|Commission)\b/i;
    if (institutionalPatterns.test(companyName)) {
      confidence = 85;
    }
    
    // Lower confidence for generic descriptive text or marketing language
    if (/\b(leader|world|global|best|top|premier|innovative|solutions|services|products)\b/i.test(companyName)) {
      confidence = Math.max(30, confidence - 40);
    }
    
    return confidence;
  }
}
