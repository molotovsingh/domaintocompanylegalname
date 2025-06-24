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
      // ALWAYS use domain mapping as PRIMARY method - this is the authoritative source
      const domainResult = this.extractFromDomain(domain);
      
      // For ANY known domain mapping, ALWAYS use it (highest priority)
      if (domainResult.companyName && domainResult.confidence >= 30) {
        // Only try HTML if we might get a legal entity name
        try {
          const url = domain.startsWith('http') ? domain : `https://${domain}`;
          const response = await this.session.get(url);
          const html = response.data;
          
          const titleResult = this.extractFromTitle(html);
          // Only use HTML if it contains legal suffixes and very high confidence
          if (titleResult.companyName && 
              titleResult.confidence >= 95 && 
              /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?)\b/i.test(titleResult.companyName)) {
            return titleResult;
          }
        } catch {
          // Ignore HTML errors, use domain result
        }
        
        return domainResult;
      }

      // For unknown domains, try HTML extraction with very strict validation
      try {
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        const response = await this.session.get(url);
        const html = response.data;
        
        const titleResult = this.extractFromTitle(html);
        // Only accept HTML with legal suffixes
        if (titleResult.companyName && 
            titleResult.confidence >= 90 && 
            /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?)\b/i.test(titleResult.companyName)) {
          return titleResult;
        }

        const metaResult = this.extractFromMeta(html);
        if (metaResult.companyName && 
            metaResult.confidence >= 85 && 
            /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?)\b/i.test(metaResult.companyName)) {
          return metaResult;
        }
      } catch {
        // HTML extraction failed, continue to domain fallback
      }

      // Return domain result even if low confidence
      if (domainResult.companyName) {
        return domainResult;
      }

      return { companyName: null, method: 'none', confidence: 0 };
    } catch (error) {
      return {
        companyName: null,
        method: 'error',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      // Additional companies from your data
      'gehealthcare': 'GE HealthCare Technologies Inc.',
      'kraftheinzcompany': 'The Kraft Heinz Company',
      'dexcom': 'DexCom, Inc.',
      'ansys': 'ANSYS, Inc.',
      'lululemon': 'lululemon athletica inc.',
      'wbd': 'Warner Bros. Discovery, Inc.',
      'cdw': 'CDW Corporation',
      'onsemi': 'onsemi',
      'biogen': 'Biogen Inc.',
      'rossstores': 'Ross Stores, Inc.',
      'diamondbackenergy': 'Diamondback Energy, Inc.',
      'xcelenergy': 'Xcel Energy Inc.',
      'ea': 'Electronic Arts Inc.',
      'cognizant': 'Cognizant Technology Solutions Corporation',
      'bakerhughes': 'Baker Hughes Company',
      'microchip': 'Microchip Technology Incorporated',
      'odfl': 'Old Dominion Freight Line, Inc.',
      'thetradedesk': 'The Trade Desk, Inc.',
      'costargroup': 'CoStar Group, Inc.',
      'paccar': 'PACCAR Inc',
      'fastenal': 'Fastenal Company',
      'copart': 'Copart, Inc.',
      'keurigdrpepper': 'Keurig Dr Pepper Inc.',
      'datadoghq': 'Datadog, Inc.',
      'take2games': 'Take-Two Interactive Software, Inc.',
      'exeloncorp': 'Exelon Corporation',
      'verisk': 'Verisk Analytics, Inc.',
      'idexx': 'IDEXX Laboratories, Inc.',
      'axon': 'Axon Enterprise, Inc.',
      'csx': 'CSX Corporation',
      'ropertech': 'Roper Technologies, Inc.',
      'regeneron': 'Regeneron Pharmaceuticals, Inc.',
      'aep': 'American Electric Power Company, Inc.',
      'paychex': 'Paychex, Inc.',
      'charter': 'Charter Communications, Inc.',
      'nxp': 'NXP Semiconductors N.V.',
      'atlassian': 'Atlassian Corporation',
      'zscaler': 'Zscaler, Inc.',
      'cadence': 'Cadence Design Systems, Inc.',
      'fortinet': 'Fortinet, Inc.',
      'oreillyauto': "O'Reilly Automotive, Inc.",
      'synopsys': 'Synopsys, Inc.',
      'marriott': 'Marriott International, Inc.',
      // INSTITUTIONS (no legal suffixes)
      'harvard': 'Harvard University',
      'mit': 'Massachusetts Institute of Technology',
      'stanford': 'Stanford University',
      'yale': 'Yale University',
      'princeton': 'Princeton University'
    };

    // Check for known mapping first - this is ALWAYS the preferred method
    if (knownMappings[cleanDomain.toLowerCase()]) {
      return {
        companyName: knownMappings[cleanDomain.toLowerCase()],
        method: 'domain_parse',
        confidence: 95
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
      // Remove descriptive phrases and marketing content
      .replace(/\s*,\s*(the\s+)?(world|global|leading|trusted|premier|top|best)\s+.*/i, '')
      .replace(/\s*-\s*(the\s+)?(world|global|leading|trusted|premier|top|best)\s+.*/i, '')
      .replace(/\s+(home\s+page|homepage)$/i, '')
      .replace(/\s+(inc|corp|corporation|company|co\.?)$/i, ' $1')
      // Remove navigation elements and UI text
      .replace(/(searchopen|go back|follow link|read icon|previous|pause|play|next|country selector)/gi, '')
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
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
      /software solutions/i,
      /home page/i,
      /empowering innovation/i,
      /intuition engineered/i,
      /superhuman speed/i,
      /continuous glucose monitoring/i,
      /leading game publisher/i,
      /cloud monitoring as a service/i,
      /leading source of information/i,
      /enhancing the health/i,
      /collaboration software/i,
      /leading cloud enterprise/i,
      /zero trust/i,
      /objectively better way/i,
      /homepage.*country.*selector/i,
      /searchopen/i,
      /^go back/i,
      /follow link/i,
      /read icon/i,
      /previous.*pause.*play.*next/i
    ];
    
    return invalidPatterns.some(pattern => pattern.test(text));
  }
  
  private calculateTitleConfidence(companyName: string): number {
    // Start with very low confidence for HTML titles
    let confidence = 30;
    
    if (companyName.length < 3) return 10;
    if (companyName.length > 100) return 10; // Too long, likely garbled
    
    // FOR-PROFIT COMPANIES: Only high confidence for proper legal entity suffixes
    const forProfitSuffixes = /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|PVT\.?\s+LTD\.?|Pvt\.?\s+Ltd\.?)\b/i;
    if (forProfitSuffixes.test(companyName)) {
      confidence = 95;
    }
    
    // INSTITUTIONS: Moderate confidence for educational/institutional patterns
    const institutionalPatterns = /\b(University|College|Institute|Foundation|School|Hospital|Medical|Center|Association|Society|Department|Agency|Bureau|Commission)\b/i;
    if (institutionalPatterns.test(companyName)) {
      confidence = 85;
    }
    
    // Completely reject marketing language and generic content
    if (/\b(leader|world|global|best|top|premier|innovative|solutions|services|products|empowering|engineered|monitoring|collaboration|enhancing|leading|cloud|enterprise|security|provider|software|platform|intelligence|artificial|continuous|glucose|game|publisher|source|information|insurance|risk|objectively|better|way|advertise)\b/i.test(companyName)) {
      return 10;
    }
    
    // Completely reject UI/navigation text
    if (/\b(home\s+page|homepage|search|selector|icon|pause|play|next|previous|strategy|collection|teamwork)\b/i.test(companyName)) {
      return 5;
    }
    
    // Reject taglines and descriptive phrases
    if (companyName.includes('—') || companyName.includes('as a Service') || companyName.includes('for Zero Trust')) {
      return 10;
    }
    
    return Math.max(confidence, 15);
  }
}
