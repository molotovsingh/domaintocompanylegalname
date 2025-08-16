/**
 * GLEIF Claims Service
 * 
 * Generates entity claims from cleaned dumps for GLEIF verification.
 * Philosophy: Multiple claims with evidence, not single "correct" answers.
 * 
 * Flow: Cleaned Dump → Entity Extraction → Suffix Suggestions → GLEIF Claims
 */

// Use betaDb instead of production db for isolation
import { betaDb } from '../../betaDb';
import { gleifEntities, entityRelationships } from '../../../shared/schema';
import { eq, like, or, and } from 'drizzle-orm';
import { JURISDICTIONS, getJurisdictionByTLD, getJurisdictionSuffixes } from '../../../shared/jurisdictions';
import { GLEIFSearchService } from '../gleif-search/gleifSearchService';

interface EntityClaim {
  claimType: 'extracted' | 'gleif_verified' | 'suffix_suggestion' | 'gleif_relationship';
  entityName: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  leiCode?: string;
  evidence?: {
    type: string;
    relationships?: string[];
    jurisdiction?: string;
    parent?: string;
  };
  reasoning?: string;
  gleifData?: {
    legalName: string;
    legalForm?: string;
    entityStatus?: string;
    jurisdiction?: string;
    entityCategory?: string;
    legalAddress?: any;
    headquarters?: any;
    registrationStatus?: string;
    initialRegistrationDate?: string;
    lastUpdateDate?: string;
  };
}

interface WebsiteEntity {
  entityName: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  extractionMethod?: string;
}

interface GleifEntity {
  entityName: string;
  leiCode: string;
  confidence: 'high' | 'medium' | 'low';
  gleifData?: {
    legalName: string;
    legalForm?: string;
    entityStatus?: string;
    jurisdiction?: string;
    entityCategory?: string;
    legalAddress?: any;
    headquarters?: any;
    registrationStatus?: string;
    initialRegistrationDate?: string;
    lastUpdateDate?: string;
  };
  source?: string;
  evidence?: any;
  reasoning?: string;
}

interface GleifClaimsResult {
  domain: string;
  websiteEntity: WebsiteEntity | null;
  gleifEntities: GleifEntity[];
  entityClaims: EntityClaim[];  // Keep for backward compatibility
  searchPatternsUsed: string[];
  processingTime: number;
}

export class GleifClaimsService {
  private gleifSearchService: GLEIFSearchService;
  
  constructor() {
    this.gleifSearchService = new GLEIFSearchService();
  }

  /**
   * Generate entity claims from cleaned dump content
   */
  async generateClaims(domain: string, cleanedContent: any): Promise<GleifClaimsResult> {
    const startTime = Date.now();
    const claims: EntityClaim[] = [];
    const searchPatterns: string[] = [];

    try {
      // Step 1: Extract entities from cleaned content
      const extractedEntities = this.extractEntities(cleanedContent);
      
      // IMPORTANT: Create Claim 0 from the cleaned dump's primary entity
      // This represents what the website claims to be after LLM cleaning
      if (cleanedContent.primaryEntityName || cleanedContent.companyName || extractedEntities.length > 0) {
        const primaryEntity = cleanedContent.primaryEntityName || 
                              cleanedContent.companyName || 
                              extractedEntities[0]?.name;
        
        if (primaryEntity) {
          console.log(`[GleifClaimsService] Creating Claim 0 from cleaned dump: ${primaryEntity}`);
          
          // Try to get LEI for the primary entity
          let primaryLeiCode: string | undefined;
          let primaryGleifData: any = undefined;
          
          try {
            const gleifResult = await this.gleifSearchService.searchGLEIF(primaryEntity, domain);
            if (gleifResult.entities && gleifResult.entities.length > 0) {
              const gleifEntity = gleifResult.entities[0];
              primaryLeiCode = gleifEntity.leiCode;
              primaryGleifData = {
                legalName: gleifEntity.legalName,
                legalForm: gleifEntity.legalForm,
                entityStatus: gleifEntity.entityStatus,
                jurisdiction: gleifEntity.jurisdiction,
                entityCategory: gleifEntity.entityCategory,
                legalAddress: gleifEntity.legalAddress,
                headquarters: gleifEntity.headquarters,
                registrationStatus: gleifEntity.registrationStatus,
                initialRegistrationDate: gleifEntity.initialRegistrationDate,
                lastUpdateDate: gleifEntity.lastUpdateDate
              };
            }
          } catch (error) {
            console.log(`[GleifClaimsService] Could not find LEI for primary entity: ${primaryEntity}`);
          }
          
          // Add Claim 0 - the cleaned dump entity (with or without LEI)
          claims.push({
            claimType: 'extracted',
            entityName: primaryEntity,
            confidence: 'high',
            source: 'cleaned_dump_primary',
            leiCode: primaryLeiCode,
            gleifData: primaryGleifData,
            reasoning: 'Primary entity extracted from LLM-cleaned website data'
          });
        }
      }
      
      // Step 2: Search GLEIF for each extracted entity to get additional LEI codes
      const excludedTerms = cleanedContent.excludeTerms || [];
      const excludeSet = new Set(excludedTerms.map((t: string) => t.toLowerCase()));
      
      for (const entity of extractedEntities) {
        // Check if entity contains excluded terms
        const nameLower = entity.name.toLowerCase();
        const shouldSkip = [...excludeSet].some(term => nameLower.includes(term as string));
        
        let leiCode: string | undefined;
        
        // Search GLEIF for LEI code if entity is valid
        if (!shouldSkip) {
          try {
            const gleifResult = await this.gleifSearchService.searchGLEIF(entity.name, domain);
            if (gleifResult.entities && gleifResult.entities.length > 0) {
              console.log(`[GleifClaimsService] Found ${gleifResult.entities.length} GLEIF matches for ${entity.name}`);
              
              // Process ALL matching entities from GLEIF, not just the first one
              for (const gleifEntity of gleifResult.entities) {
                const gleifData = {
                  legalName: gleifEntity.legalName,  // Add primary legal name from GLEIF
                  legalForm: gleifEntity.legalForm,
                  entityStatus: gleifEntity.entityStatus,
                  jurisdiction: gleifEntity.jurisdiction,
                  entityCategory: gleifEntity.entityCategory,
                  legalAddress: gleifEntity.legalAddress,
                  headquarters: gleifEntity.headquarters,
                  registrationStatus: gleifEntity.registrationStatus,
                  initialRegistrationDate: gleifEntity.initialRegistrationDate,
                  lastUpdateDate: gleifEntity.lastUpdateDate
                };
                
                // Add a claim for each GLEIF entity found
                claims.push({
                  claimType: 'extracted',
                  entityName: gleifEntity.legalName,  // Use GLEIF's legal name
                  confidence: entity.confidence,
                  source: entity.source + '_gleif_match',
                  leiCode: gleifEntity.leiCode,
                  gleifData: gleifData
                });
                
                console.log(`[GleifClaimsService] Added claim for: ${gleifEntity.legalName} (LEI: ${gleifEntity.leiCode})`);
              }
            } else {
              // No GLEIF matches found - add claim without LEI
              claims.push({
                claimType: 'extracted',
                entityName: entity.name,
                confidence: entity.confidence,
                source: entity.source,
                leiCode: undefined,
                gleifData: undefined
              });
            }
          } catch (error) {
            console.log(`[GleifClaimsService] Could not search GLEIF for ${entity.name}:`, error);
            // Add claim without LEI on error
            claims.push({
              claimType: 'extracted',
              entityName: entity.name,
              confidence: entity.confidence,
              source: entity.source,
              leiCode: undefined,
              gleifData: undefined
            });
          }
        } else {
          // Skipped due to exclusion terms
          claims.push({
            claimType: 'extracted',
            entityName: entity.name,
            confidence: entity.confidence,
            source: entity.source,
            leiCode: undefined,
            gleifData: undefined
          });
        }
      }

      // Step 3: Generate search patterns with wildcards (excluding marketing terms)
      const patterns = this.generateSearchPatterns(extractedEntities, excludedTerms);
      searchPatterns.push(...patterns);

      // Step 4: Query GLEIF database with patterns
      const gleifResults = await this.queryGleifDatabase(patterns);

      // Step 5: Add GLEIF verified claims
      for (const gleifEntity of gleifResults) {
        claims.push({
          claimType: 'gleif_verified',
          entityName: gleifEntity.legalName,
          leiCode: gleifEntity.leiCode,
          evidence: {
            type: 'database_match',
            jurisdiction: gleifEntity.jurisdiction || undefined
          }
        });

        // Add relationship claims
        const relationships = await this.getEntityRelationships(gleifEntity.leiCode);
        for (const rel of relationships) {
          const relatedEntity = await this.getGleifEntity(
            rel.relationshipType === 'parent' ? rel.parentLei! : rel.childLei!
          );
          
          if (relatedEntity) {
            claims.push({
              claimType: 'gleif_relationship',
              entityName: relatedEntity.legalName,
              leiCode: relatedEntity.leiCode,
              evidence: {
                type: rel.relationshipType === 'parent' ? 'parent_entity' : 'child_entity',
                parent: rel.relationshipType === 'child' ? gleifEntity.legalName : undefined
              }
            });
          }
        }
      }

      // Step 5: Generate suffix suggestions for base entities
      const suffixSuggestions = this.generateSuffixSuggestions(extractedEntities, cleanedContent);
      claims.push(...suffixSuggestions);

      // Separate website entity (Claim 0) from GLEIF entities
      let websiteEntity: WebsiteEntity | null = null;
      const gleifEntities: GleifEntity[] = [];
      
      // Find the website entity (extracted from cleaned dump, no LEI)
      const websiteClaim = claims.find(c => c.source === 'cleaned_dump_primary' && c.claimType === 'extracted');
      if (websiteClaim && !websiteClaim.leiCode) {
        websiteEntity = {
          entityName: websiteClaim.entityName,
          source: websiteClaim.source || 'website_extraction',
          confidence: websiteClaim.confidence || 'medium',
          extractionMethod: websiteClaim.source
        };
      }
      
      // Collect all GLEIF entities (claims with LEI codes)
      for (const claim of claims) {
        if (claim.leiCode && claim.leiCode.length > 0) {
          // Skip the website entity if it somehow got an LEI
          if (claim.source === 'cleaned_dump_primary') continue;
          
          gleifEntities.push({
            entityName: claim.entityName,
            leiCode: claim.leiCode,
            confidence: claim.confidence || 'medium',
            gleifData: claim.gleifData,
            source: claim.source,
            evidence: claim.evidence,
            reasoning: claim.reasoning
          });
        }
      }
      
      // Filter to only include claims with LEI codes for backward compatibility
      const verifiedClaims = claims.filter(claim => claim.leiCode && claim.leiCode.length > 0);
      
      console.log(`[GleifClaimsService] Results: websiteEntity=${websiteEntity?.entityName}, gleifEntities=${gleifEntities.length}, totalClaims=${claims.length}`);

      return {
        domain,
        websiteEntity,  // NEW: Separated website extraction
        gleifEntities,  // NEW: Only GLEIF entities with LEI codes
        entityClaims: verifiedClaims,  // Keep for backward compatibility
        searchPatternsUsed: searchPatterns,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('[GleifClaimsService] Error generating claims:', error);
      throw error;
    }
  }

  /**
   * Clean company name by removing marketing text and descriptions
   */
  private cleanCompanyName(text: string): string {
    // Remove common marketing phrases
    const marketingPhrases = [
      /\s*-\s*wire harness manufacturers?\s*/gi,
      /\s*-\s*electric cable assemblies\s*/gi,
      /\s*-\s*custom\/bulk cable assembly\s*/gi,
      /\s*is facebook.*ready!?\s*/gi,
      /\s*is google\+.*ready!?\s*/gi,
      /\s*manufacturers?\s*/gi,
      /\s*suppliers?\s*/gi,
      /\s*providers?\s*/gi,
      /\s*,\s*electric cable.*$/gi,
      /\s*,\s*custom\/bulk.*$/gi
    ];
    
    let cleaned = text;
    marketingPhrases.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Extract company name if it's in all caps at the beginning
    const capsMatch = cleaned.match(/^([A-Z][A-Z0-9]+)/);
    if (capsMatch) {
      // Convert to proper case (e.g., ELCOMPONICS -> Elcomponics)
      cleaned = capsMatch[1].charAt(0) + capsMatch[1].slice(1).toLowerCase();
    }
    
    return cleaned.trim();
  }

  /**
   * Extract entity mentions from cleaned content
   */
  private extractEntities(cleanedContent: any): Array<{name: string; confidence: 'high' | 'medium' | 'low'; source: string}> {
    const entities: Array<{name: string; confidence: 'high' | 'medium' | 'low'; source: string}> = [];
    
    console.log('[GleifClaimsService] Starting entity extraction from:', {
      hasPrimaryEntityName: !!cleanedContent.primaryEntityName,
      primaryEntityName: cleanedContent.primaryEntityName,
      hasBaseEntityName: !!cleanedContent.baseEntityName,
      baseEntityName: cleanedContent.baseEntityName,
      entityCandidatesCount: cleanedContent.entityCandidates?.length || 0,
      nameVariationsCount: cleanedContent.nameVariations?.length || 0,
      excludeTermsCount: cleanedContent.excludeTerms?.length || 0,
      hasCompanyName: !!cleanedContent.companyName,
      companyName: cleanedContent.companyName
    });
    
    // PRIORITY 1: Use new primaryEntityName field (most accurate)
    if (cleanedContent.primaryEntityName) {
      console.log('[GleifClaimsService] Found primary entity name:', cleanedContent.primaryEntityName);
      entities.push({
        name: cleanedContent.primaryEntityName,
        confidence: 'high',
        source: 'llm_primary_entity'
      });
    }
    
    // PRIORITY 2: Add all entity candidates
    if (cleanedContent.entityCandidates && cleanedContent.entityCandidates.length > 0) {
      console.log('[GleifClaimsService] Found entity candidates:', cleanedContent.entityCandidates);
      cleanedContent.entityCandidates.forEach((candidate: string) => {
        entities.push({
          name: candidate,
          confidence: 'high',
          source: 'llm_entity_candidate'
        });
      });
    }
    
    // PRIORITY 3: Add name variations for searching
    if (cleanedContent.nameVariations && cleanedContent.nameVariations.length > 0) {
      console.log('[GleifClaimsService] Found name variations:', cleanedContent.nameVariations);
      cleanedContent.nameVariations.forEach((variation: string) => {
        entities.push({
          name: variation,
          confidence: 'medium',
          source: 'llm_name_variation'
        });
      });
    }
    
    // FALLBACK: Use old companyName field for backwards compatibility
    if (entities.length === 0 && cleanedContent.companyName) {
      console.log('[GleifClaimsService] Falling back to companyName field:', cleanedContent.companyName);
      entities.push({
        name: cleanedContent.companyName,
        confidence: 'high',
        source: 'llm_extracted_company'
      });
    }
    
    // Extract from structured data if available
    if (cleanedContent.structuredData?.organization?.name) {
      console.log('[GleifClaimsService] Found entity in structured data:', cleanedContent.structuredData.organization.name);
      entities.push({
        name: cleanedContent.structuredData.organization.name,
        confidence: 'high',
        source: 'structured_data'
      });
    }

    // Extract from meta tags
    if (cleanedContent.metaTags?.['og:site_name']) {
      const rawName = cleanedContent.metaTags['og:site_name'];
      const cleanedName = this.cleanCompanyName(rawName);
      
      console.log('[GleifClaimsService] Found entity in og:site_name:', rawName, '-> cleaned:', cleanedName);
      
      // Add both raw and cleaned versions
      entities.push({
        name: rawName,
        confidence: 'medium',
        source: 'meta_og_site_name_raw'
      });
      
      if (cleanedName && cleanedName !== rawName) {
        entities.push({
          name: cleanedName,
          confidence: 'high',
          source: 'meta_og_site_name'
        });
      }
    }

    // Extract from title
    if (cleanedContent.title) {
      const titleEntity = this.extractFromTitle(cleanedContent.title);
      if (titleEntity) {
        console.log('[GleifClaimsService] Found entity in title:', titleEntity);
        entities.push({
          name: titleEntity,
          confidence: 'medium',
          source: 'page_title'
        });
      }
    }

    // Extract from copyright text
    if (cleanedContent.extractedText) {
      const copyrightEntities = this.extractFromCopyright(cleanedContent.extractedText);
      console.log('[GleifClaimsService] Copyright extraction found:', copyrightEntities.length, 'entities');
      copyrightEntities.forEach(entity => {
        entities.push({
          name: entity,
          confidence: 'medium',
          source: 'copyright_text'
        });
      });
    }

    // Deduplicate by name
    const uniqueEntities = new Map<string, typeof entities[0]>();
    entities.forEach(entity => {
      const normalized = entity.name.trim();
      if (!uniqueEntities.has(normalized) || 
          (uniqueEntities.get(normalized)!.confidence === 'low' && entity.confidence !== 'low')) {
        uniqueEntities.set(normalized, entity);
      }
    });

    return Array.from(uniqueEntities.values());
  }

  /**
   * Generate search patterns with wildcards
   */
  private generateSearchPatterns(entities: Array<{name: string}>, excludeTerms?: string[]): string[] {
    const patterns = new Set<string>();
    const excludeSet = new Set(excludeTerms?.map(t => t.toLowerCase()) || []);

    // Common corporate suffixes to strip
    const corpSuffixes = [
      'Inc', 'Inc.', 'Incorporated', 'Corp', 'Corp.', 'Corporation',
      'Ltd', 'Ltd.', 'Limited', 'LLC', 'L.L.C.', 'LLP',
      'GmbH', 'AG', 'SE', 'SA', 'S.A.', 'NV', 'N.V.',
      'Pty', 'Pty Ltd', 'Pte Ltd', 'Pvt Ltd', 'Co', 'Co.'
    ];

    entities.forEach(entity => {
      const baseName = entity.name.trim();
      
      // Skip if the name contains excluded terms
      const nameLower = baseName.toLowerCase();
      const shouldSkip = Array.from(excludeSet).some(term => nameLower.includes(term));
      if (shouldSkip) {
        console.log('[GleifClaimsService] Skipping entity with excluded terms:', baseName);
        return;
      }
      
      // Filter out generic marketing terms
      const marketingTerms = ['manufacturers', 'suppliers', 'providers', 'solutions', 'services', 'systems'];
      const containsMarketingTerm = marketingTerms.some(term => nameLower.includes(term));
      if (containsMarketingTerm) {
        console.log('[GleifClaimsService] Skipping entity with marketing terms:', baseName);
        return;
      }
      
      // Standard suffix wildcard
      patterns.add(`${baseName}%`);
      
      // Remove corporate suffixes and search for base name
      let cleanedName = baseName;
      corpSuffixes.forEach(suffix => {
        const regex = new RegExp(`\\s+${suffix.replace('.', '\\.')}$`, 'i');
        cleanedName = cleanedName.replace(regex, '').trim();
      });
      
      if (cleanedName !== baseName && cleanedName.length > 2) {
        patterns.add(`${cleanedName}%`);
        
        // Only add subsidiary patterns for clean base names
        patterns.add(`${cleanedName} Holdings%`);
        patterns.add(`${cleanedName} International%`);
        patterns.add(`${cleanedName} Global%`);
      }
      
      // Be more conservative with multi-word patterns
      const words = baseName.split(/\s+/);
      if (words.length > 1 && words[0].length > 3) {
        // Only use first word if it's a proper noun (starts with capital)
        if (words[0][0] === words[0][0].toUpperCase()) {
          patterns.add(`${words[0]}%`);
        }
      }
      
      // Only add variations for known entity names (not descriptions)
      if (!containsMarketingTerm && cleanedName.length > 3 && cleanedName.length < 30) {
        // Add space variations
        if (cleanedName.match(/^[A-Z]{2}/)) { // Starts with at least 2 capitals
          // ELcomponics -> EL componics
          const spaceVariant = cleanedName.replace(/^([A-Z]+)([a-z])/, '$1 $2');
          if (spaceVariant !== cleanedName) {
            patterns.add(`${spaceVariant}%`);
          }
        }
      }
    });

    return Array.from(patterns);
  }

  /**
   * Query GLEIF database with search patterns
   */
  private async queryGleifDatabase(patterns: string[]): Promise<any[]> {
    if (patterns.length === 0) return [];

    try {
      const conditions = patterns.map(pattern => 
        like(gleifEntities.legalName, pattern)
      );

      const results = await betaDb.select()
        .from(gleifEntities)
        .where(or(...conditions))
        .limit(100);

      return results;
    } catch (error) {
      console.error('[GleifClaimsService] Database query error:', error);
      return [];
    }
  }

  /**
   * Get entity relationships from database
   */
  private async getEntityRelationships(leiCode: string): Promise<any[]> {
    try {
      const relationships = await betaDb.select()
        .from(entityRelationships)
        .where(
          or(
            eq(entityRelationships.parentLei, leiCode),
            eq(entityRelationships.childLei, leiCode)
          )
        );

      return relationships;
    } catch (error) {
      console.error('[GleifClaimsService] Relationship query error:', error);
      return [];
    }
  }

  /**
   * Get single GLEIF entity by LEI
   */
  private async getGleifEntity(leiCode: string): Promise<any | null> {
    try {
      const [entity] = await betaDb.select()
        .from(gleifEntities)
        .where(eq(gleifEntities.leiCode, leiCode))
        .limit(1);

      return entity || null;
    } catch (error) {
      console.error('[GleifClaimsService] Entity query error:', error);
      return null;
    }
  }

  /**
   * Generate suffix suggestions based on jurisdiction clues
   */
  private generateSuffixSuggestions(
    entities: Array<{name: string}>, 
    cleanedContent: any
  ): EntityClaim[] {
    const suggestions: EntityClaim[] = [];
    
    // Try to detect country from content
    const countryHints = this.detectCountryHints(cleanedContent);
    
    entities.forEach(entity => {
      const baseName = entity.name.trim();
      
      // Skip if already has a suffix
      if (this.hasCorporateSuffix(baseName)) return;

      countryHints.forEach(country => {
        const jurisdictionKey = country.toLowerCase();
        const jurisdiction = JURISDICTIONS[jurisdictionKey];
        
        if (jurisdiction) {
          // Get all suffixes for this jurisdiction
          const suffixes = getJurisdictionSuffixes(jurisdictionKey);
          
          // Add top 3 most common suffixes
          suffixes.slice(0, 3).forEach((suffix: string, index: number) => {
            suggestions.push({
              claimType: 'suffix_suggestion',
              entityName: `${baseName} ${suffix}`,
              confidence: index === 0 ? 'medium' : 'low',
              source: 'llm_jurisdiction_guess',
              reasoning: `${jurisdiction.name} company, ${suffix} is ${index === 0 ? 'most common' : 'common'} suffix`
            });
          });
        }
      });
    });

    return suggestions;
  }

  /**
   * Extract entity from title
   */
  private extractFromTitle(title: string): string | null {
    // Remove common patterns
    const cleaned = title
      .replace(/\s*[\|–-]\s*.*$/, '') // Remove everything after separator
      .replace(/^(Home|Welcome to|About)\s+/i, '') // Remove common prefixes
      .trim();

    return cleaned.length > 2 ? cleaned : null;
  }

  /**
   * Extract entities from copyright text
   */
  private extractFromCopyright(text: string): string[] {
    const entities: string[] = [];
    const copyrightRegex = /(?:©|Copyright|All rights reserved?)\s+(?:by\s+)?([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\.|,|\s+All|\s+Rights|\s+\d{4}|$)/gi;
    
    let match;
    while ((match = copyrightRegex.exec(text)) !== null) {
      const entity = match[1].trim();
      if (entity.length > 2 && !entity.match(/^\d+$/)) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Check if entity name already has a corporate suffix
   */
  private hasCorporateSuffix(name: string): boolean {
    const suffixPatterns = [
      /\b(?:Inc|Corp|LLC|Ltd|GmbH|AG|SA|SAS|SpA|BV|NV|Pty|PLC|SE)\b\.?$/i,
      /\b(?:Limited|Corporation|Company|Incorporated)\b\.?$/i
    ];

    return suffixPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Detect country hints from content
   */
  private detectCountryHints(content: any): string[] {
    const countries = new Set<string>();

    // Check structured data
    if (content.structuredData?.address?.addressCountry) {
      countries.add(content.structuredData.address.addressCountry);
    }

    // Check meta tags
    if (content.metaTags?.['og:locale']) {
      const locale = content.metaTags['og:locale'];
      const country = locale.split('_')[1];
      if (country) countries.add(country);
    }

    // Check domain TLD
    if (content.domain) {
      const tld = content.domain.split('.').pop();
      const tldCountryMap: Record<string, string> = {
        'de': 'DE', 'fr': 'FR', 'uk': 'GB', 'it': 'IT',
        'es': 'ES', 'nl': 'NL', 'ch': 'CH', 'at': 'AT'
      };
      if (tld && tldCountryMap[tld]) {
        countries.add(tldCountryMap[tld]);
      }
    }

    return Array.from(countries);
  }
}