import { z } from 'zod';

// Simple implementations to avoid lodash import issues
const camelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

const mapKeys = (obj: any, iteratee: (value: any, key: string) => string): any => {
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = iteratee(obj[key], key);
      result[newKey] = obj[key];
    }
  }
  return result;
};

const groupBy = <T>(array: T[], key: string | ((item: T) => string)): Record<string, T[]> => {
  return array.reduce((result: any, item: any) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) result[groupKey] = [];
    result[groupKey].push(item);
    return result;
  }, {});
};

const uniqBy = <T>(array: T[], key: string): T[] => {
  const seen = new Set();
  return array.filter((item: any) => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const get = (obj: any, path: string, defaultValue?: any): any => {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined) return defaultValue;
  }
  return result;
};

// ============================================================================
// PHASE 1: CLAIMS NORMALIZATION SERVICE
// ============================================================================
// Purpose: Validate, normalize, and enrich claims data before arbitration
// Ensures consistent data format and quality for downstream processing
// ============================================================================

// Raw claim schema - handles both snake_case and camelCase inputs
const RawClaimSchema = z.object({
  // Accept both formats for backwards compatibility
  claim_number: z.number().optional(),
  claimNumber: z.number().optional(),
  
  claim_type: z.string().optional(),
  claimType: z.string().optional(),
  
  entity_name: z.string().optional(),
  entityName: z.string().optional(),
  
  lei_code: z.string().nullable().optional(),
  leiCode: z.string().nullable().optional(),
  LEICode: z.string().nullable().optional(), // Handle various capitalizations
  
  confidence_score: z.number().optional(),
  confidence: z.number().optional(),
  
  source: z.string().optional(),
  metadata: z.any().optional()
}).passthrough(); // Allow additional fields to pass through

// Normalized claim schema - strict output format
const NormalizedClaimSchema = z.object({
  claimNumber: z.number(),
  claimType: z.enum(['llm_extracted', 'gleif_candidate', 'website_claim']),
  entityName: z.string().min(1, 'Entity name is required'),
  leiCode: z.string().regex(/^[A-Z0-9]{20}$/).optional().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  metadata: z.object({
    legalName: z.string().optional(),
    jurisdiction: z.string().optional(),
    entityStatus: z.string().optional(),
    legalForm: z.string().optional(),
    headquarters: z.object({
      city: z.string().optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      addressLine: z.string().optional()
    }).optional(),
    legalAddress: z.object({
      city: z.string().optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      addressLine: z.string().optional()
    }).optional(),
    registrationStatus: z.string().optional(),
    lastUpdateDate: z.string().optional(),
    searchScore: z.number().optional(),
    hierarchyLevel: z.string().optional()
  }).optional()
});

// Normalized result types
export type NormalizedClaim = z.infer<typeof NormalizedClaimSchema>;
export type NormalizationResult = {
  success: boolean;
  normalizedClaims?: NormalizedClaim[];
  errors?: Array<{
    claimIndex: number;
    field: string;
    issue: string;
  }>;
  warnings?: string[];
  stats?: {
    totalClaims: number;
    validClaims: number;
    rejectedClaims: number;
    duplicatesRemoved: number;
    transformationsApplied: number;
  };
};

export class ClaimsNormalizationService {
  private validationErrors: Array<{ claimIndex: number; field: string; issue: string }> = [];
  private warnings: string[] = [];
  private stats = {
    totalClaims: 0,
    validClaims: 0,
    rejectedClaims: 0,
    duplicatesRemoved: 0,
    transformationsApplied: 0
  };

  /**
   * Main entry point for normalizing claims
   */
  async normalizeClaims(rawClaims: unknown[]): Promise<NormalizationResult> {
    console.log('[ClaimsNormalization] Starting normalization for', rawClaims.length, 'claims');
    
    this.resetState();
    this.stats.totalClaims = rawClaims.length;

    try {
      // Step 1: Validate and transform each claim
      const processedClaims = rawClaims
        .map((claim, index) => this.processSingleClaim(claim, index))
        .filter((claim): claim is NormalizedClaim => claim !== null);

      // Step 2: Remove duplicates
      const deduplicatedClaims = this.removeDuplicates(processedClaims);

      // Step 3: Sort by claim number
      const sortedClaims = deduplicatedClaims.sort((a, b) => a.claimNumber - b.claimNumber);

      this.stats.validClaims = sortedClaims.length;
      this.stats.rejectedClaims = this.stats.totalClaims - this.stats.validClaims;

      console.log('[ClaimsNormalization] Completed:', this.stats);

      return {
        success: true,
        normalizedClaims: sortedClaims,
        errors: this.validationErrors.length > 0 ? this.validationErrors : undefined,
        warnings: this.warnings.length > 0 ? this.warnings : undefined,
        stats: this.stats
      };
    } catch (error) {
      console.error('[ClaimsNormalization] Fatal error:', error);
      return {
        success: false,
        errors: [{
          claimIndex: -1,
          field: 'general',
          issue: error instanceof Error ? error.message : 'Unknown error occurred'
        }],
        stats: this.stats
      };
    }
  }

  /**
   * Process a single claim through validation and normalization
   */
  private processSingleClaim(rawClaim: unknown, index: number): NormalizedClaim | null {
    try {
      // Parse with raw schema first
      const parsed = RawClaimSchema.parse(rawClaim);
      
      // Debug logging for claim 0
      if (parsed.claim_number === 0 || parsed.claimNumber === 0) {
        console.log('[ClaimsNormalization] Processing Claim 0:', {
          claim_number: parsed.claim_number,
          claimNumber: parsed.claimNumber,
          entity_name: parsed.entity_name,
          entityName: parsed.entityName,
          source: parsed.source
        });
      }
      
      // Transform to normalized format
      const normalized = this.transformClaim(parsed, index);
      
      // CRITICAL: Always preserve Claim 0 (website extraction baseline)
      // Even if it doesn't have perfect data, it's essential for quality assessment
      const claimNumber = normalized.claimNumber;
      if (claimNumber === 0) {
        console.log('[ClaimsNormalization] PRESERVING CLAIM 0 as website extraction baseline');
        console.log('[ClaimsNormalization] Claim 0 data:', normalized);
        
        // For claim 0, use relaxed validation - ensure it has minimal required fields
        if (!normalized.entityName || normalized.entityName.trim() === '') {
          normalized.entityName = 'Unknown Entity (Website Extraction Failed)';
        }
        normalized.claimType = 'website_claim';
        normalized.confidence = normalized.confidence || 0.5;
        normalized.source = 'website_extraction'; // Always override source for claim 0
        
        // Skip strict validation for claim 0
        this.stats.transformationsApplied++;
        return normalized as NormalizedClaim;
      }
      
      // Validate other claims with strict schema
      const validated = NormalizedClaimSchema.parse(normalized);
      
      this.stats.transformationsApplied++;
      return validated;
    } catch (error) {
      // Log which claim is being rejected and why
      console.log('[ClaimsNormalization] Rejecting claim at index', index, ':', error instanceof z.ZodError ? error.errors : error);
      
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          this.validationErrors.push({
            claimIndex: index,
            field: err.path.join('.'),
            issue: err.message
          });
        });
      } else {
        this.validationErrors.push({
          claimIndex: index,
          field: 'unknown',
          issue: 'Failed to process claim'
        });
      }
      return null;
    }
  }

  /**
   * Transform raw claim data to normalized format
   */
  private transformClaim(raw: any, index: number): any {
    // Extract claim number (prefer claim_number over claimNumber)
    const claimNumber = raw.claim_number ?? raw.claimNumber ?? index;

    // Extract claim type
    const claimType = raw.claim_type || raw.claimType || this.inferClaimType(raw);

    // Extract and clean entity name
    let entityName = raw.entity_name || raw.entityName || '';
    
    // Fallback to metadata.legalName if entity name is missing
    if (!entityName && raw.metadata) {
      entityName = raw.metadata.legalName || raw.metadata.legal_name || '';
      if (entityName) {
        this.warnings.push(`Claim ${claimNumber}: Using metadata.legalName as entity name`);
      }
    }

    // Clean and standardize entity name
    entityName = this.standardizeEntityName(entityName);

    // Extract and validate LEI code
    const leiCode = this.normalizeLeiCode(
      raw.lei_code || raw.leiCode || raw.LEICode || raw.metadata?.leiCode
    );

    // Normalize confidence score
    const confidence = this.normalizeConfidence(
      raw.confidence_score ?? raw.confidence ?? 0
    );

    // Extract source
    const source = raw.source || 'unknown';

    // Normalize metadata
    const metadata = this.normalizeMetadata(raw.metadata || {});

    return {
      claimNumber,
      claimType,
      entityName,
      leiCode,
      confidence,
      source,
      metadata
    };
  }

  /**
   * Infer claim type from available data
   */
  private inferClaimType(claim: any): string {
    // CRITICAL: Claim 0 is ALWAYS the website extraction baseline
    if (claim.claim_number === 0 || claim.claimNumber === 0) {
      return 'website_claim';
    }
    if (claim.source?.includes('gleif')) {
      return 'gleif_candidate';
    }
    if (claim.source?.includes('llm') || claim.source?.includes('extraction')) {
      return 'llm_extracted';
    }
    return 'gleif_candidate'; // Default assumption
  }

  /**
   * Standardize entity names
   */
  private standardizeEntityName(name: string): string {
    if (!name) return '';

    let standardized = name.trim();
    
    // Remove extra spaces
    standardized = standardized.replace(/\s+/g, ' ');
    
    // Standardize common suffixes
    const suffixMap: Record<string, string> = {
      ' INC$': ', INC.',
      ' CORP$': ' CORP.',
      ' LLC$': ', LLC',
      ' LTD$': ' LTD.',
      ' LIMITED$': ' LIMITED',
      ' PLC$': ' PLC',
      ' GMBH$': ' GMBH',
      ' AG$': ' AG',
      ' SA$': ' S.A.',
      ' SPA$': ' S.P.A.',
      ' BV$': ' B.V.',
      ' NV$': ' N.V.'
    };

    for (const [pattern, replacement] of Object.entries(suffixMap)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(standardized)) {
        standardized = standardized.replace(regex, replacement);
        break;
      }
    }

    return standardized;
  }

  /**
   * Normalize and validate LEI codes
   */
  private normalizeLeiCode(lei: string | undefined | null): string | null {
    if (!lei) return null;
    
    const normalized = lei.toUpperCase().trim();
    
    // Validate LEI format (20 alphanumeric characters)
    if (!/^[A-Z0-9]{20}$/.test(normalized)) {
      this.warnings.push(`Invalid LEI code format: ${lei}`);
      return null;
    }
    
    return normalized;
  }

  /**
   * Normalize confidence scores to 0-1 range
   */
  private normalizeConfidence(confidence: number): number {
    // If confidence is greater than 1, assume it's a percentage
    if (confidence > 1) {
      return confidence / 100;
    }
    
    // Ensure within bounds
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Normalize metadata structure
   */
  private normalizeMetadata(rawMetadata: any): any {
    if (!rawMetadata || typeof rawMetadata !== 'object') {
      return {};
    }

    // Convert snake_case keys to camelCase
    const camelCased = mapKeys(rawMetadata, (value, key) => camelCase(key));

    // Ensure nested objects are also normalized
    if (camelCased.headquarters) {
      camelCased.headquarters = mapKeys(camelCased.headquarters, (v, k) => camelCase(k));
    }
    if (camelCased.legalAddress) {
      camelCased.legalAddress = mapKeys(camelCased.legalAddress, (v, k) => camelCase(k));
    }

    return camelCased;
  }

  /**
   * Remove duplicate claims based on LEI code or entity name
   */
  private removeDuplicates(claims: NormalizedClaim[]): NormalizedClaim[] {
    const beforeCount = claims.length;
    
    // First, deduplicate by LEI code (if present)
    const leiGroups = groupBy(claims, c => c.leiCode || 'no-lei');
    const deduped: NormalizedClaim[] = [];

    for (const [lei, group] of Object.entries(leiGroups)) {
      if (lei === 'no-lei') {
        // For claims without LEI, deduplicate by entity name
        const uniqueByName = uniqBy(group, 'entityName');
        deduped.push(...uniqueByName);
      } else {
        // For claims with same LEI, keep the one with highest confidence
        const best = (group as NormalizedClaim[]).reduce((prev, curr) => 
          curr.confidence > prev.confidence ? curr : prev
        );
        deduped.push(best);
      }
    }

    this.stats.duplicatesRemoved = beforeCount - deduped.length;
    
    if (this.stats.duplicatesRemoved > 0) {
      console.log(`[ClaimsNormalization] Removed ${this.stats.duplicatesRemoved} duplicate claims`);
    }

    return deduped;
  }

  /**
   * Reset internal state for new normalization run
   */
  private resetState(): void {
    this.validationErrors = [];
    this.warnings = [];
    this.stats = {
      totalClaims: 0,
      validClaims: 0,
      rejectedClaims: 0,
      duplicatesRemoved: 0,
      transformationsApplied: 0
    };
  }

  /**
   * Validate a set of claims without transforming them
   * Useful for pre-flight checks
   */
  async validateClaims(claims: unknown[]): Promise<boolean> {
    const result = await this.normalizeClaims(claims);
    return result.success && result.normalizedClaims?.length === claims.length;
  }
}

// Export singleton instance
export const claimsNormalizer = new ClaimsNormalizationService();