/**
 * Fast entity extraction from HTML without LLM calls
 * Extracts company names directly from structured data
 */

export class FastEntityExtractor {
  private corporateSuffixes = [
    'Inc', 'Corp', 'LLC', 'Ltd', 'GmbH', 'AG', 'SA', 'SAS', 
    'SpA', 'BV', 'NV', 'Pty', 'PLC', 'SE', 'Limited', 
    'Corporation', 'Company', 'Incorporated'
  ];

  /**
   * Extract entities from dump data without LLM calls
   */
  async extractFromDump(dumpData: any, domain: string): Promise<{
    primaryEntity: string | null;
    entities: string[];
    confidence: number;
    metadata: any;
  }> {
    const entities: string[] = [];
    let primaryEntity: string | null = null;
    let confidence = 0;
    
    const metadata: any = {
      domain,
      sources: []
    };

    // Try to extract from different data structures based on dump type
    if (dumpData.pages?.[0]) {
      // Crawlee dump structure
      const page = dumpData.pages[0];
      this.extractFromPage(page, entities, metadata);
      
      // Check for structured data in the page
      if (page.structuredData) {
        console.log('[FastExtractor] Found structured data with', Array.isArray(page.structuredData) ? page.structuredData.length : 1, 'items');
        this.extractFromStructuredData(page.structuredData, entities, metadata);
      } else {
        console.log('[FastExtractor] No structured data found in page');
      }
    } else if (dumpData.html || dumpData.text) {
      // Playwright/Axios dump structure
      this.extractFromContent(dumpData, entities, metadata);
      
      // Check for structured data at top level
      if (dumpData.structuredData || dumpData.structured_data) {
        const structured = dumpData.structuredData || dumpData.structured_data;
        this.extractFromStructuredData(structured, entities, metadata);
      }
    } else if (dumpData.content) {
      // Scrapy dump structure
      this.extractFromScrapyContent(dumpData, entities, metadata);
    }

    // Process meta tags
    if (dumpData.metaTags || dumpData.meta || dumpData.meta_tags) {
      const metaTags = dumpData.metaTags || dumpData.meta || dumpData.meta_tags;
      this.extractFromMetaTags(metaTags, entities, metadata);
    }

    // Deduplicate and prioritize entities
    const uniqueEntities = this.deduplicateEntities(entities);
    
    // Select primary entity
    primaryEntity = this.selectPrimaryEntity(uniqueEntities, domain);
    
    // Calculate confidence based on sources and entity quality
    confidence = this.calculateConfidence(primaryEntity, metadata.sources);

    return {
      primaryEntity,
      entities: uniqueEntities,
      confidence,
      metadata
    };
  }

  private extractFromPage(page: any, entities: string[], metadata: any): void {
    // Extract from title
    if (page.title) {
      const titleEntity = this.cleanTitleEntity(page.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('page_title');
      }
    }

    // Extract from meta tags in page
    if (page.meta) {
      Object.entries(page.meta).forEach(([key, value]: [string, any]) => {
        if (key === 'og:site_name' && value) {
          const entity = this.cleanEntityName(value);
          if (entity) {
            entities.push(entity);
            metadata.sources.push('og:site_name');
          }
        }
      });
    }

    // Extract from text content
    if (page.text) {
      const copyrightEntities = this.extractFromCopyright(page.text);
      entities.push(...copyrightEntities);
      if (copyrightEntities.length > 0) {
        metadata.sources.push('copyright');
      }
    }
  }

  private extractFromContent(data: any, entities: string[], metadata: any): void {
    // Extract from title
    if (data.title) {
      const titleEntity = this.cleanTitleEntity(data.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('title');
      }
    }

    // Extract from text
    if (data.text) {
      const copyrightEntities = this.extractFromCopyright(data.text);
      entities.push(...copyrightEntities);
      if (copyrightEntities.length > 0) {
        metadata.sources.push('copyright');
      }
    }
  }

  private extractFromScrapyContent(data: any, entities: string[], metadata: any): void {
    // Scrapy specific extraction
    if (data.company_name) {
      const entity = this.cleanEntityName(data.company_name);
      if (entity) {
        entities.push(entity);
        metadata.sources.push('scrapy_company_name');
      }
    }

    if (data.title) {
      const titleEntity = this.cleanTitleEntity(data.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('scrapy_title');
      }
    }
  }

  private extractFromStructuredData(structured: any, entities: string[], metadata: any): void {
    if (!structured) return;

    const structuredArray = Array.isArray(structured) ? structured : [structured];
    
    structuredArray.forEach((item: any) => {
      // Handle nested @graph structures
      if (item['@graph']) {
        this.extractFromStructuredData(item['@graph'], entities, metadata);
        return;
      }
      
      // Extract from LocalBusiness type (common for business websites)
      if ((item['@type'] === 'LocalBusiness' || (Array.isArray(item['@type']) && item['@type'].includes('LocalBusiness'))) && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          // Add common suffixes for businesses if not present
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            // Try to infer suffix based on business type
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_local_business');
        }
      }
      
      // Extract from Organization type
      if (item['@type'] === 'Organization' && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          // Add Inc. suffix if it looks like a company name without suffix
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_organization');
        }
      }
      
      // Extract from WebSite type
      if (item['@type'] === 'WebSite' && item.name) {
        const entity = this.cleanEntityName(item.name);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('json_ld_website');
        }
      }
      
      // Extract from publisher
      if (item.publisher?.name) {
        const entity = this.cleanEntityName(item.publisher.name);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('json_ld_publisher');
        }
      }
      
      // Extract from brand (often contains the company name)
      if (item.brand?.name) {
        let entity = this.cleanEntityName(item.brand.name);
        if (entity) {
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_brand');
        }
      }
    });
  }

  private extractFromMetaTags(metaTags: any, entities: string[], metadata: any): void {
    if (!metaTags) return;

    // Check og:site_name
    if (metaTags['og:site_name']) {
      const entity = this.cleanEntityName(metaTags['og:site_name']);
      if (entity) {
        entities.push(entity);
        metadata.sources.push('meta_og_site_name');
      }
    }

    // Check twitter:site
    if (metaTags['twitter:site']) {
      const entity = this.cleanEntityName(metaTags['twitter:site'].replace('@', ''));
      if (entity && entity.length > 2) {
        entities.push(entity);
        metadata.sources.push('meta_twitter_site');
      }
    }

    // Check author
    if (metaTags.author) {
      const entity = this.cleanEntityName(metaTags.author);
      if (entity && this.hasCorporateSuffix(entity)) {
        entities.push(entity);
        metadata.sources.push('meta_author');
      }
    }
  }

  private extractFromCopyright(text: string): string[] {
    const entities: string[] = [];
    const copyrightRegex = /(?:©|Copyright|All rights reserved?)\s+(?:by\s+)?([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|\s+All|\s+Rights|\s+\d{4}|$)/gi;
    
    let match;
    while ((match = copyrightRegex.exec(text)) !== null) {
      const entity = this.cleanEntityName(match[1]);
      if (entity && entity.length > 2 && !entity.match(/^\d+$/)) {
        entities.push(entity);
      }
    }

    return entities;
  }

  private cleanTitleEntity(title: string): string | null {
    if (!title) return null;
    
    // Remove everything after common separators
    let cleaned = title.split(/\s*[\|–\-:]\s*/)[0];
    
    // Remove common prefixes
    const prefixes = ['Welcome to', 'Home', 'About', 'Official Website of'];
    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    // Remove marketing terms at the end
    const marketingTerms = ['Services', 'Solutions', 'Products', 'Website'];
    for (const term of marketingTerms) {
      const regex = new RegExp(`\\s+${term}\\s*$`, 'i');
      cleaned = cleaned.replace(regex, '');
    }
    
    return cleaned.length > 2 ? cleaned : null;
  }

  private cleanEntityName(name: string): string | null {
    if (!name) return null;
    
    // Remove extra whitespace
    name = name.replace(/\s+/g, ' ').trim();
    
    // Remove trailing punctuation
    name = name.replace(/[.,;!?]+$/, '');
    
    // Check if it's too long (likely a sentence)
    if (name.length > 100) return null;
    
    // Check if it's too short
    if (name.length < 3) return null;
    
    // Skip if it contains marketing language
    const marketingPhrases = [
      'leading provider',
      'best in class',
      'your partner',
      'trusted source',
      'comprehensive solutions'
    ];
    
    const nameLower = name.toLowerCase();
    for (const phrase of marketingPhrases) {
      if (nameLower.includes(phrase)) return null;
    }
    
    return name;
  }

  private hasCorporateSuffix(name: string): boolean {
    const nameLower = name.toLowerCase();
    return this.corporateSuffixes.some(suffix => 
      nameLower.endsWith(suffix.toLowerCase()) || 
      nameLower.endsWith(`${suffix.toLowerCase()}.`)
    );
  }

  private deduplicateEntities(entities: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];
    
    for (const entity of entities) {
      const normalized = entity.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(entity);
      }
    }
    
    return unique;
  }

  private selectPrimaryEntity(entities: string[], domain: string): string | null {
    if (entities.length === 0) return null;
    
    // Prioritize entities with corporate suffixes
    const withSuffix = entities.filter(e => this.hasCorporateSuffix(e));
    if (withSuffix.length > 0) {
      // Return the longest one with suffix (more specific)
      return withSuffix.sort((a, b) => b.length - a.length)[0];
    }
    
    // Otherwise, prefer shorter names (company names tend to be concise)
    const sorted = entities.sort((a, b) => {
      // Penalize very long names
      if (a.length > 50) return 1;
      if (b.length > 50) return -1;
      
      // Prefer names that don't look like descriptions
      const aHasSpace = a.includes(' ');
      const bHasSpace = b.includes(' ');
      if (!aHasSpace && bHasSpace) return -1;
      if (aHasSpace && !bHasSpace) return 1;
      
      // Otherwise shorter is better
      return a.length - b.length;
    });
    
    return sorted[0];
  }

  private calculateConfidence(entity: string | null, sources: string[]): number {
    if (!entity) return 0;
    
    let confidence = 0.5; // Base confidence
    
    // Add confidence based on sources
    const sourceWeights: Record<string, number> = {
      'json_ld_organization': 0.3,
      'meta_og_site_name': 0.2,
      'copyright': 0.15,
      'page_title': 0.1,
      'scrapy_company_name': 0.25,
      'json_ld_publisher': 0.15
    };
    
    for (const source of sources) {
      confidence += sourceWeights[source] || 0.05;
    }
    
    // Boost confidence if entity has corporate suffix
    if (this.hasCorporateSuffix(entity)) {
      confidence += 0.2;
    }
    
    // Cap at 0.95 since we're not using LLM verification
    return Math.min(confidence, 0.95);
  }
}

export const fastEntityExtractor = new FastEntityExtractor();