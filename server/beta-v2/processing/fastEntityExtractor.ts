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
    evidenceTrail?: {
      entitiesFound: Array<{
        name: string;
        source: string;
        rawValue: any;
        confidence: number;
      }>;
      structuredDataSummary?: any;
      extractionMethod: string;
      extractionTimestamp: string;
    };
  }> {
    const entities: string[] = [];
    const entitiesWithEvidence: Array<{
      name: string;
      source: string;
      rawValue: any;
      confidence: number;
    }> = [];
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
      this.extractFromPageWithEvidence(page, entities, metadata, entitiesWithEvidence);
      
      // Check for structured data in the page
      if (page.structuredData) {
        console.log('[FastExtractor] Found structured data with', Array.isArray(page.structuredData) ? page.structuredData.length : 1, 'items');
        this.extractFromStructuredDataWithEvidence(page.structuredData, entities, metadata, entitiesWithEvidence);
      } else {
        console.log('[FastExtractor] No structured data found in page');
      }
    } else if (dumpData.html || dumpData.text) {
      // Playwright/Axios dump structure
      this.extractFromContentWithEvidence(dumpData, entities, metadata, entitiesWithEvidence);
      
      // Check for structured data at top level
      if (dumpData.structuredData || dumpData.structured_data) {
        const structured = dumpData.structuredData || dumpData.structured_data;
        this.extractFromStructuredDataWithEvidence(structured, entities, metadata, entitiesWithEvidence);
      }
    } else if (dumpData.content) {
      // Scrapy dump structure
      this.extractFromScrapyContentWithEvidence(dumpData, entities, metadata, entitiesWithEvidence);
    }

    // Process meta tags
    if (dumpData.metaTags || dumpData.meta || dumpData.meta_tags) {
      const metaTags = dumpData.metaTags || dumpData.meta || dumpData.meta_tags;
      this.extractFromMetaTagsWithEvidence(metaTags, entities, metadata, entitiesWithEvidence);
    }

    // Deduplicate and prioritize entities
    const uniqueEntities = this.deduplicateEntities(entities);
    
    // Select primary entity
    primaryEntity = this.selectPrimaryEntity(uniqueEntities, domain);
    
    // Calculate confidence based on sources and entity quality
    confidence = this.calculateConfidence(primaryEntity, metadata.sources);

    // Build evidence trail
    const evidenceTrail = {
      entitiesFound: entitiesWithEvidence,
      extractionMethod: 'fast_extractor',
      extractionTimestamp: new Date().toISOString()
    };

    return {
      primaryEntity,
      entities: uniqueEntities,
      confidence,
      metadata,
      evidenceTrail
    };
  }

  private extractFromPageWithEvidence(
    page: any, 
    entities: string[], 
    metadata: any,
    entitiesWithEvidence: Array<{name: string; source: string; rawValue: any; confidence: number}>
  ): void {
    // Extract from title
    if (page.title) {
      const titleEntity = this.cleanTitleEntity(page.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('page_title');
        entitiesWithEvidence.push({
          name: titleEntity,
          source: 'page_title',
          rawValue: page.title,
          confidence: 0.7
        });
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
            entitiesWithEvidence.push({
              name: entity,
              source: 'og:site_name',
              rawValue: value,
              confidence: 0.85
            });
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
        // Find the copyright text for evidence
        const copyrightMatch = page.text.match(/©\s*\d{4}\s+([^,\n]+)/);
        copyrightEntities.forEach(entity => {
          entitiesWithEvidence.push({
            name: entity,
            source: 'copyright',
            rawValue: copyrightMatch ? copyrightMatch[0] : `© ${entity}`,
            confidence: 0.75
          });
        });
      }
    }
  }

  // Keep the original method for backward compatibility
  private extractFromPage(page: any, entities: string[], metadata: any): void {
    const dummyEvidence: any[] = [];
    this.extractFromPageWithEvidence(page, entities, metadata, dummyEvidence);
  }

  private extractFromContentWithEvidence(
    data: any, 
    entities: string[], 
    metadata: any,
    entitiesWithEvidence: Array<{name: string; source: string; rawValue: any; confidence: number}>
  ): void {
    // Extract from title
    if (data.title) {
      const titleEntity = this.cleanTitleEntity(data.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('title');
        entitiesWithEvidence.push({
          name: titleEntity,
          source: 'title',
          rawValue: data.title,
          confidence: 0.7
        });
      }
    }

    // Extract from text
    if (data.text) {
      const copyrightEntities = this.extractFromCopyright(data.text);
      entities.push(...copyrightEntities);
      if (copyrightEntities.length > 0) {
        metadata.sources.push('copyright');
        const copyrightMatch = data.text.match(/©\s*\d{4}\s+([^,\n]+)/);
        copyrightEntities.forEach(entity => {
          entitiesWithEvidence.push({
            name: entity,
            source: 'copyright',
            rawValue: copyrightMatch ? copyrightMatch[0] : `© ${entity}`,
            confidence: 0.75
          });
        });
      }
    }
  }

  private extractFromContent(data: any, entities: string[], metadata: any): void {
    const dummyEvidence: any[] = [];
    this.extractFromContentWithEvidence(data, entities, metadata, dummyEvidence);
  }

  private extractFromScrapyContentWithEvidence(
    data: any, 
    entities: string[], 
    metadata: any,
    entitiesWithEvidence: Array<{name: string; source: string; rawValue: any; confidence: number}>
  ): void {
    // Scrapy specific extraction
    if (data.company_name) {
      const entity = this.cleanEntityName(data.company_name);
      if (entity) {
        entities.push(entity);
        metadata.sources.push('scrapy_company_name');
        entitiesWithEvidence.push({
          name: entity,
          source: 'scrapy_company_name',
          rawValue: data.company_name,
          confidence: 0.9
        });
      }
    }

    if (data.title) {
      const titleEntity = this.cleanTitleEntity(data.title);
      if (titleEntity) {
        entities.push(titleEntity);
        metadata.sources.push('scrapy_title');
        entitiesWithEvidence.push({
          name: titleEntity,
          source: 'scrapy_title',
          rawValue: data.title,
          confidence: 0.7
        });
      }
    }
  }

  private extractFromScrapyContent(data: any, entities: string[], metadata: any): void {
    const dummyEvidence: any[] = [];
    this.extractFromScrapyContentWithEvidence(data, entities, metadata, dummyEvidence);
  }

  private extractFromStructuredData(structured: any, entities: string[], metadata: any): void {
    if (!structured) return;

    const structuredArray = Array.isArray(structured) ? structured : [structured];
    
    structuredArray.forEach((item: any) => {
      // Handle nested arrays (common in Crawlee dumps)
      if (Array.isArray(item) && !item['@type']) {
        item.forEach((subItem: any) => {
          this.extractFromStructuredData(subItem, entities, metadata);
        });
        return;
      }
      
      // Handle nested @graph structures
      if (item['@graph']) {
        this.extractFromStructuredData(item['@graph'], entities, metadata);
        return;
      }
      
      // Extract from LocalBusiness type (common for business websites)
      const itemTypes = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      
      if (itemTypes.includes('LocalBusiness') && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          // Add common suffixes for businesses if not present
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            // Try to infer suffix based on business type
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_local_business');
          console.log('[FastExtractor] Found LocalBusiness:', entity);
        }
      }
      
      // Extract from Organization type
      if (itemTypes.includes('Organization') && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          // Add Inc. suffix if it looks like a company name without suffix
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_organization');
          console.log('[FastExtractor] Found Organization:', entity);
        }
      }
      
      // Extract from WebSite type
      if (itemTypes.includes('WebSite') && item.name) {
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
          console.log('[FastExtractor] Found brand:', entity);
        }
      }
    });
  }

  // Stub methods for enhanced extraction with evidence
  private extractFromStructuredDataWithEvidence(
    structured: any,
    entities: string[],
    metadata: any,
    entitiesWithEvidence: Array<{name: string; source: string; rawValue: any; confidence: number}>
  ): void {
    if (!structured) return;

    const structuredArray = Array.isArray(structured) ? structured : [structured];
    
    structuredArray.forEach((item: any) => {
      // Handle nested arrays
      if (Array.isArray(item) && !item['@type']) {
        item.forEach((subItem: any) => {
          this.extractFromStructuredDataWithEvidence(subItem, entities, metadata, entitiesWithEvidence);
        });
        return;
      }
      
      // Handle nested @graph structures
      if (item['@graph']) {
        this.extractFromStructuredDataWithEvidence(item['@graph'], entities, metadata, entitiesWithEvidence);
        return;
      }
      
      const itemTypes = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      
      // Extract Organization entities (highest confidence)
      if (itemTypes.includes('Organization') && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          // Add suffix if needed
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_organization');
          entitiesWithEvidence.push({
            name: entity,
            source: 'json-ld_organization',
            rawValue: item,
            confidence: 0.95
          });
          console.log('[FastExtractor] Found Organization entity:', entity);
        }
      }
      
      // Extract LocalBusiness entities (high confidence)
      if (itemTypes.includes('LocalBusiness') && item.name) {
        let entity = this.cleanEntityName(item.name);
        if (entity) {
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_local_business');
          entitiesWithEvidence.push({
            name: entity,
            source: 'json-ld_local_business',
            rawValue: item,
            confidence: 0.90
          });
        }
      }
      
      // Extract from brand
      if (item.brand?.name) {
        let entity = this.cleanEntityName(item.brand.name);
        if (entity) {
          if (!this.hasCorporateSuffix(entity) && entity.match(/^[A-Z0-9]/)) {
            entity = entity + ' Inc.';
          }
          entities.push(entity);
          metadata.sources.push('json_ld_brand');
          entitiesWithEvidence.push({
            name: entity,
            source: 'json-ld_brand',
            rawValue: item.brand,
            confidence: 0.85
          });
        }
      }
      
      // Extract from publisher
      if (item.publisher?.name) {
        const entity = this.cleanEntityName(item.publisher.name);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('json_ld_publisher');
          entitiesWithEvidence.push({
            name: entity,
            source: 'json-ld_publisher',
            rawValue: item.publisher,
            confidence: 0.80
          });
        }
      }
    });
  }

  private extractFromMetaTagsWithEvidence(
    metaTags: any,
    entities: string[],
    metadata: any,
    entitiesWithEvidence: Array<{name: string; source: string; rawValue: any; confidence: number}>
  ): void {
    if (!metaTags) return;

    // Handle array of meta tags (common structure)
    if (Array.isArray(metaTags)) {
      // Look for og:site_name (high confidence)
      const ogSiteName = metaTags.find((tag: any) => 
        tag.property === 'og:site_name' || tag.name === 'og:site_name'
      );
      if (ogSiteName?.content) {
        const entity = this.cleanEntityName(ogSiteName.content);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('og:site_name');
          entitiesWithEvidence.push({
            name: entity,
            source: 'meta_og:site_name',
            rawValue: ogSiteName,
            confidence: 0.90
          });
          console.log('[FastExtractor] Found entity from og:site_name:', entity);
        }
      }

      // Look for application-name (medium confidence)
      const appName = metaTags.find((tag: any) => tag.name === 'application-name');
      if (appName?.content) {
        const entity = this.cleanEntityName(appName.content);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('application-name');
          entitiesWithEvidence.push({
            name: entity,
            source: 'meta_application-name',
            rawValue: appName,
            confidence: 0.85
          });
        }
      }

      // Look for og:title as fallback (lower confidence)
      const ogTitle = metaTags.find((tag: any) => 
        tag.property === 'og:title' || tag.name === 'og:title'
      );
      if (ogTitle?.content) {
        const titleEntity = this.cleanTitleEntity(ogTitle.content);
        if (titleEntity) {
          entities.push(titleEntity);
          metadata.sources.push('og:title');
          entitiesWithEvidence.push({
            name: titleEntity,
            source: 'meta_og:title',
            rawValue: ogTitle,
            confidence: 0.70
          });
        }
      }
    } else if (typeof metaTags === 'object') {
      // Handle object format meta tags
      if (metaTags['og:site_name']) {
        const entity = this.cleanEntityName(metaTags['og:site_name']);
        if (entity) {
          entities.push(entity);
          metadata.sources.push('og:site_name');
          entitiesWithEvidence.push({
            name: entity,
            source: 'meta_og:site_name',
            rawValue: metaTags['og:site_name'],
            confidence: 0.90
          });
        }
      }
    }
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