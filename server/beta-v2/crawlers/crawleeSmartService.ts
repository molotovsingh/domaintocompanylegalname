// Crawlee Smart Service - Intelligent legal document crawler
// Purpose: Specifically targets home page + legal documents for accurate entity extraction

import { PlaywrightCrawler, Dataset } from 'crawlee';
import * as playwright from 'playwright';

interface LegalDocumentData {
  domain: string;
  homePage: {
    title?: string;
    copyrightText?: string;
    metaTags?: Record<string, string>;
  };
  legalDocuments: {
    privacyPolicy?: {
      url: string;
      content: string;
      legalEntities: string[];
      addresses: string[];
    };
    termsConditions?: {
      url: string;
      content: string;
      legalEntities: string[];
      addresses: string[];
    };
    imprint?: {
      url: string;
      content: string;
      legalEntities: string[];
      addresses: string[];
    };
  };
  extractedEntities: {
    primaryEntity?: string;
    subsidiaries: string[];
    parentCompany?: string;
  };
  timestamp: string;
}

export class CrawleeSmartService {
  private crawler: PlaywrightCrawler;

  constructor() {
    this.crawler = new PlaywrightCrawler({
      launchContext: {
        launcher: playwright.chromium,
        launchOptions: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      },
      requestHandlerTimeoutSecs: 60,
      navigationTimeoutSecs: 30,
      maxRequestRetries: 2,
      maxConcurrency: 1, // Process one domain at a time for focused crawling
    });
  }

  async crawlLegalDocuments(domain: string): Promise<LegalDocumentData> {
    console.log(`[Crawlee Smart] Starting intelligent crawl for ${domain}`);
    
    const result: LegalDocumentData = {
      domain,
      homePage: {},
      legalDocuments: {},
      extractedEntities: {
        subsidiaries: []
      },
      timestamp: new Date().toISOString()
    };

    // Define legal document patterns
    const legalLinkPatterns = {
      privacyPolicy: [
        /privacy/i, /datenschutz/i, /data-protection/i, 
        /privacy-policy/i, /confidentialit[eé]/i
      ],
      termsConditions: [
        /terms/i, /conditions/i, /legal/i, /agb/i,
        /terms-and-conditions/i, /terms-of-use/i
      ],
      imprint: [
        /imprint/i, /impressum/i, /about/i, /contact/i,
        /legal-notice/i, /mentions-l[eé]gales/i
      ]
    };

    await this.crawler.run([
      {
        url: `https://${domain}`,
        label: 'HOME_PAGE'
      }
    ]);

    // Process crawled data
    const dataset = await Dataset.open();
    await dataset.forEach(async (item) => {
      if (item.label === 'HOME_PAGE') {
        result.homePage = {
          title: item.title,
          copyrightText: this.extractCopyright(item.text),
          metaTags: item.metaTags
        };

        // Find legal document links
        const legalLinks = this.findLegalLinks(item.links, legalLinkPatterns);
        
        // Queue legal document pages
        for (const [type, url] of Object.entries(legalLinks)) {
          if (url) {
            await this.crawler.addRequests([{
              url,
              label: `LEGAL_${type.toUpperCase()}`
            }]);
          }
        }
      } else if (item.label?.startsWith('LEGAL_')) {
        const docType = item.label.replace('LEGAL_', '').toLowerCase();
        const entities = this.extractLegalEntities(item.text);
        const addresses = this.extractAddresses(item.text);

        result.legalDocuments[docType as keyof typeof result.legalDocuments] = {
          url: item.url,
          content: item.text.substring(0, 5000), // First 5000 chars
          legalEntities: entities,
          addresses: addresses
        };
      }
    });

    // Analyze and determine primary entity
    result.extractedEntities = this.analyzeLegalEntities(result);

    return result;
  }

  private extractCopyright(text: string): string | undefined {
    const copyrightRegex = /©\s*([^0-9\n]+)\s*\d{4}/i;
    const match = text.match(copyrightRegex);
    return match ? match[1].trim() : undefined;
  }

  private findLegalLinks(
    links: string[], 
    patterns: Record<string, RegExp[]>
  ): Record<string, string | null> {
    const found: Record<string, string | null> = {
      privacyPolicy: null,
      termsConditions: null,
      imprint: null
    };

    for (const link of links) {
      for (const [type, regexList] of Object.entries(patterns)) {
        if (regexList.some(regex => regex.test(link))) {
          found[type] = link;
          break;
        }
      }
    }

    return found;
  }

  private extractLegalEntities(text: string): string[] {
    const entities: string[] = [];
    
    // Common legal entity patterns
    const patterns = [
      // German entities
      /\b[\w\s&-]+\s+GmbH\b/gi,
      /\b[\w\s&-]+\s+AG\b/gi,
      /\b[\w\s&-]+\s+KG\b/gi,
      /\b[\w\s&-]+\s+GmbH\s*&\s*Co\.?\s*KG\b/gi,
      
      // US entities
      /\b[\w\s&-]+\s+(?:Inc\.|Incorporated|Corp\.|Corporation|LLC|L\.L\.C\.)\b/gi,
      
      // UK entities
      /\b[\w\s&-]+\s+(?:Ltd\.|Limited|PLC|P\.L\.C\.)\b/gi,
      
      // Dutch entities
      /\b[\w\s&-]+\s+(?:B\.V\.|BV|N\.V\.|NV)\b/gi,
      
      // French entities
      /\b[\w\s&-]+\s+(?:S\.A\.|SA|S\.A\.S\.|SAS|SARL|S\.A\.R\.L\.)\b/gi,
      
      // Other international
      /\b[\w\s&-]+\s+(?:Pty Ltd|Pte Ltd|S\.p\.A\.|SpA|S\.L\.|SL)\b/gi
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        entities.push(...matches.map(m => m.trim()));
      }
    }

    // Deduplicate and clean
    return [...new Set(entities)]
      .filter(e => e.length > 3 && e.length < 100)
      .slice(0, 10); // Limit to top 10
  }

  private extractAddresses(text: string): string[] {
    const addresses: string[] = [];
    
    // Look for address patterns (simplified)
    const addressRegex = /\b\d+[^,\n]{5,100}(?:,\s*\d{5}|\b[A-Z]{2}\b\s*\d{5})/gi;
    const matches = text.match(addressRegex);
    
    if (matches) {
      addresses.push(...matches.map(m => m.trim()));
    }

    return addresses.slice(0, 5); // Limit to top 5
  }

  private analyzeLegalEntities(data: LegalDocumentData): {
    primaryEntity?: string;
    subsidiaries: string[];
    parentCompany?: string;
  } {
    const allEntities: string[] = [];
    
    // Collect all entities from legal documents
    for (const doc of Object.values(data.legalDocuments)) {
      if (doc?.legalEntities) {
        allEntities.push(...doc.legalEntities);
      }
    }

    // Count occurrences
    const entityCounts = new Map<string, number>();
    for (const entity of allEntities) {
      entityCounts.set(entity, (entityCounts.get(entity) || 0) + 1);
    }

    // Sort by frequency
    const sortedEntities = Array.from(entityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([entity]) => entity);

    return {
      primaryEntity: sortedEntities[0],
      subsidiaries: sortedEntities.slice(1, 5),
      parentCompany: undefined // Would need GLEIF data for this
    };
  }
}