
import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';

// Zod schemas for runtime validation
const GLEIFAddressSchema = z.object({
  firstAddressLine: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  addressLines: z.array(z.string()).optional()
});

const GLEIFApiEntitySchema = z.object({
  id: z.string(),
  attributes: z.object({
    lei: z.string(),
    entity: z.object({
      legalName: z.object({
        name: z.string(),
        language: z.string().optional()
      }),
      otherNames: z.array(z.object({
        name: z.string(),
        type: z.string().optional(),
        language: z.string().optional()
      })).optional(),
      status: z.string(),
      legalForm: z.object({
        id: z.string(),
        other: z.string().optional()
      }).optional(),
      jurisdiction: z.string().optional(),
      legalAddress: GLEIFAddressSchema.optional(),
      headquartersAddress: GLEIFAddressSchema.optional()
    }),
    registration: z.object({
      registrationStatus: z.string(),
      initialRegistrationDate: z.string().optional(),
      lastUpdateDate: z.string().optional(),
      managingLOU: z.string().optional()
    })
  })
});

const GLEIFApiResponseSchema = z.object({
  data: z.array(GLEIFApiEntitySchema),
  meta: z.object({
    pagination: z.object({
      total: z.number()
    }).optional()
  }).optional()
});

interface GLEIFAddress {
  firstAddressLine?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
}

interface GLEIFEntityName {
  name: string;
  type?: string;
  language?: string;
}

interface GLEIFApiEntity {
  id: string;
  attributes: {
    lei: string;
    entity: {
      legalName: {
        name: string;
        language?: string;
      };
      otherNames?: GLEIFEntityName[];
      category?: string;
      subCategory?: string;
      status: string;
      legalForm?: {
        id: string;
        other?: string;
      };
      jurisdiction?: string;
      creationDate?: string;
      legalAddress?: GLEIFAddress;
      headquartersAddress?: GLEIFAddress;
    };
    registration: {
      registrationStatus: string;
      initialRegistrationDate?: string;
      lastUpdateDate?: string;
      nextRenewalDate?: string;
      managingLOU?: string;
      validationSources?: string;
    };
  };
}

interface GLEIFApiResponse {
  data: GLEIFApiEntity[];
  meta?: {
    pagination?: {
      total: number;
    };
  };
}

export interface GLEIFExtractionResult {
  companyName: string;
  legalEntityType: string;
  country: string;
  confidence: 'high' | 'medium' | 'low';
  sources: string[];
  leiCode?: string;
  entityStatus?: string;
  registrationStatus?: string;
  jurisdiction?: string;
  legalForm?: string;
  addresses?: {
    legal?: GLEIFAddress;
    headquarters?: GLEIFAddress;
  };
  otherNames?: string[];
  registrationDate?: string;
  lastUpdateDate?: string;
  rawData?: GLEIFApiEntity;
  // Raw JSON passthrough fields like Perplexity
  rawApiResponse?: any;
  fullGleifResponse?: GLEIFApiResponse;
  unprocessedEntities?: GLEIFApiEntity[];
}

export class GLEIFExtractor {
  private baseUrl = 'https://api.gleif.org/api/v1';
  private headers = {
    'Accept': 'application/vnd.api+json',
    'User-Agent': 'Domain-Intelligence-Platform/1.0'
  };

  /**
   * Extract raw JSON from GLEIF API without ANY processing (complete passthrough like Perplexity)
   */
  async extractRawGleifData(companyName: string): Promise<{
    success: boolean;
    rawApiResponse: any;
    fullGleifResponse?: any;
    unprocessedEntities?: any[];
    completeRawData?: any;
    httpHeaders?: any;
    requestDetails?: any;
    error?: string;
    processingTime: number;
    totalRecords?: number;
    paginationInfo?: any;
    includesLinks?: any;
    metaData?: any;
    gleifApiVersion?: string;
    responseSize?: number;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`[GLEIF-RAW] Starting COMPLETE raw extraction for: ${companyName}`);
      
      // Try exact search first - capture EVERYTHING
      let result = await this.searchGLEIFWithCompleteCapture(companyName, false);
      
      if (!result.data || result.data.data.length === 0) {
        console.log(`[GLEIF-RAW] No exact matches, trying fuzzy search...`);
        result = await this.searchGLEIFWithCompleteCapture(companyName, true);
      }

      const processingTime = Date.now() - startTime;

      if (!result.data || result.data.data.length === 0) {
        return {
          success: false,
          rawApiResponse: null,
          error: "No GLEIF matches found",
          processingTime,
          requestDetails: result.requestDetails
        };
      }

      // Calculate response size
      const responseSize = JSON.stringify(result.data).length;

      // Return ABSOLUTELY EVERYTHING - zero processing
      return {
        success: true,
        rawApiResponse: result.data, // Complete unmodified API response
        fullGleifResponse: result.data, // Same data, different key for compatibility
        unprocessedEntities: result.data.data, // Just the entities array
        completeRawData: result.data, // Complete raw response
        httpHeaders: result.headers, // All HTTP headers from GLEIF
        requestDetails: result.requestDetails, // Request URL, method, etc.
        processingTime,
        totalRecords: result.data.data ? result.data.data.length : 0,
        paginationInfo: result.data.meta || null,
        includesLinks: result.data.links || null,
        metaData: result.data.meta || null,
        gleifApiVersion: result.headers?.['api-version'] || 'unknown',
        responseSize
      };

    } catch (error: any) {
      return {
        success: false,
        rawApiResponse: null,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Enhanced search method that captures EVERYTHING from GLEIF API
   */
  private async searchGLEIFWithCompleteCapture(companyName: string, fuzzy: boolean = false): Promise<{
    data: any;
    headers: any;
    requestDetails: any;
  }> {
    try {
      // Clean and prepare search term
      const cleanedName = companyName.trim().replace(/['"]/g, '');
      const encodedTerm = encodeURIComponent(cleanedName);
      
      // Enhanced search pattern
      let searchTerm: string;
      if (fuzzy) {
        searchTerm = `*${encodedTerm}*`;
      } else {
        searchTerm = encodedTerm;
      }
      
      // Increase page size to get more data - GLEIF allows up to 200
      const searchUrl = `${this.baseUrl}/lei-records?filter[entity.legalName]=${searchTerm}&page[size]=200`;

      console.log(`[GLEIF-RAW-COMPLETE] API Request (${fuzzy ? 'fuzzy' : 'exact'}): ${searchUrl}`);

      const requestDetails = {
        url: searchUrl,
        method: 'GET',
        headers: this.headers,
        searchTerm: companyName,
        fuzzySearch: fuzzy,
        timestamp: new Date().toISOString()
      };

      const response: AxiosResponse<any> = await axios.get(searchUrl, {
        headers: this.headers,
        timeout: 30000, // Longer timeout for more data
        validateStatus: (status) => status < 500,
      });

      // Enhanced response validation but preserve ALL data
      const contentType = response.headers['content-type'] || '';
      const responseData = response.data;
      
      // Check for HTML error pages
      if (contentType.includes('text/html') || 
          (typeof responseData === 'string' && responseData.trim().startsWith('<!DOCTYPE'))) {
        console.error(`[GLEIF-RAW-COMPLETE] API returned HTML error page (status: ${response.status})`);
        throw new Error(`GLEIF API returned HTML error page (status: ${response.status})`);
      }

      // Handle string responses (parse but keep original)
      let finalData = responseData;
      if (typeof responseData === 'string') {
        try {
          finalData = JSON.parse(responseData);
        } catch (e) {
          console.error(`[GLEIF-RAW-COMPLETE] JSON parse failed:`, responseData.substring(0, 200));
          throw new Error('Invalid JSON response from GLEIF API');
        }
      }

      if (response.status === 200) {
        console.log(`[GLEIF-RAW-COMPLETE] API Success: Found ${finalData.data ? finalData.data.length : 0} entities`);
        console.log(`[GLEIF-RAW-COMPLETE] Response includes:`, Object.keys(finalData));
        
        // Log additional data structures found
        if (finalData.meta) {
          console.log(`[GLEIF-RAW-COMPLETE] Meta data available:`, Object.keys(finalData.meta));
        }
        if (finalData.links) {
          console.log(`[GLEIF-RAW-COMPLETE] Links available:`, Object.keys(finalData.links));
        }
        if (finalData.included) {
          console.log(`[GLEIF-RAW-COMPLETE] Included data available:`, finalData.included.length, 'items');
        }
        
        return {
          data: finalData, // Complete unmodified response
          headers: response.headers, // All HTTP headers
          requestDetails
        };
      }

      if (response.status === 404) {
        console.log(`[GLEIF-RAW-COMPLETE] No entities found for search term: ${companyName}`);
        return { 
          data: { data: [] }, 
          headers: response.headers,
          requestDetails
        };
      }

      throw new Error(`GLEIF API returned status ${response.status}`);

    } catch (error: any) {
      console.error(`[GLEIF-RAW-COMPLETE] Error:`, error.message);
      throw error;
    }
  }

  /**
   * Extract company information using GLEIF API with retry logic and enhanced analysis
   */
  async extractCompanyInfo(companyName: string, includeRawData: boolean = false): Promise<GLEIFExtractionResult> {
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[GLEIF] Starting extraction for company: ${companyName} (attempt ${attempt}/${maxRetries})`);

        // Add small delay between retries
        if (attempt > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Try exact search first
        let result = await this.searchGLEIF(companyName, false);
        
        if (!result || result.data.length === 0) {
          console.log(`[GLEIF] No exact matches, trying fuzzy search...`);
          // Try fuzzy search if exact fails
          result = await this.searchGLEIF(companyName, true);
        }

        if (!result || result.data.length === 0) {
          console.log(`[GLEIF] No GLEIF matches found for ${companyName}`);
          return {
            companyName: 'Not found in GLEIF registry',
            legalEntityType: 'Not found',
            country: 'Not found',
            confidence: 'low',
            sources: ['GLEIF API - No matches found']
          };
        }

        // Enhanced processing: analyze all matches if multiple found
        if (result.data.length > 1) {
          console.log(`[GLEIF] Found ${result.data.length} matches, performing enhanced analysis...`);
          return this.performEnhancedEntityAnalysis(result.data, companyName);
        }

        // Process the single match
        const bestMatch = result.data[0];
        console.log(`[GLEIF] Found single match: ${bestMatch.attributes.entity.legalName.name}`);

        return this.formatGLEIFResult(bestMatch, result.data.length);

      } catch (error: any) {
        lastError = error;
        console.error(`[GLEIF] Attempt ${attempt} failed for ${companyName}:`, error.message);
        
        // Don't retry for certain error types
        if (error.message.includes('not found') || 
            error.message.includes('Invalid LEI') ||
            error.message.includes('404')) {
          break;
        }
        
        // Continue to next attempt for API errors
        if (attempt < maxRetries) {
          console.log(`[GLEIF] Retrying in ${attempt}s...`);
        }
      }
    }

    console.error(`[GLEIF] All attempts failed for ${companyName}:`, lastError?.message);
    return {
      companyName: 'GLEIF API Error',
      legalEntityType: 'Error',
      country: 'Error',
      confidence: 'low',
      sources: [`GLEIF API Error (${maxRetries} attempts): ${lastError?.message || 'Unknown error'}`]
    };
  }

  /**
   * Enhanced entity analysis for multiple matches (inspired by tested Python code)
   */
  private performEnhancedEntityAnalysis(entities: GLEIFApiEntity[], searchTerm: string): GLEIFExtractionResult {
    console.log(`[GLEIF] Enhanced Analysis: Evaluating ${entities.length} entities for: ${searchTerm}`);
    
    // Score each entity based on multiple criteria
    const scoredEntities = entities.map((entity, index) => {
      const score = this.calculateEntityScore(entity, searchTerm);
      return { entity, score, index };
    });

    // Sort by score (highest first)
    scoredEntities.sort((a, b) => b.score - a.score);

    const bestMatch = scoredEntities[0];
    const entityData = bestMatch.entity.attributes.entity;
    
    console.log(`[GLEIF] Best match selected: ${entityData.legalName.name} (Score: ${bestMatch.score})`);
    
    // Comprehensive analysis logging (from tested code patterns)
    console.log(`[GLEIF] Comprehensive Entity Analysis Results:`);
    console.log(`  Search Term: "${searchTerm}"`);
    console.log(`  Total Entities Found: ${entities.length}`);
    console.log(`  Active Entities: ${entities.filter(e => e.attributes.entity.status === 'ACTIVE').length}`);
    console.log(`  Issued Registrations: ${entities.filter(e => e.attributes.registration.registrationStatus === 'ISSUED').length}`);
    
    // Detailed candidate analysis
    scoredEntities.slice(0, 5).forEach((scored, i) => {
      const entity = scored.entity.attributes.entity;
      const reg = scored.entity.attributes.registration;
      console.log(`  ${i + 1}. ${entity.legalName.name}`);
      console.log(`     LEI: ${scored.entity.attributes.lei}`);
      console.log(`     Score: ${scored.score}`);
      console.log(`     Status: ${entity.status} | Registration: ${reg.registrationStatus}`);
      console.log(`     Jurisdiction: ${entity.jurisdiction || entity.legalAddress?.country || 'N/A'}`);
      console.log(`     Legal Form: ${entity.legalForm?.id || 'N/A'}`);
      
      if (entity.otherNames && entity.otherNames.length > 0) {
        console.log(`     Alternative Names: ${entity.otherNames.map(n => n.name).join(', ')}`);
      }
    });

    const result = this.formatGLEIFResult(bestMatch.entity, entities.length);
    
    // Enhanced confidence based on score and alternatives
    if (bestMatch.score >= 85) {
      result.confidence = 'high';
    } else if (bestMatch.score >= 65) {
      result.confidence = 'medium';
    } else {
      result.confidence = 'low';
    }

    // Add comprehensive analysis details to sources
    result.sources.push(`Enhanced analysis: Selected from ${entities.length} candidates (Score: ${bestMatch.score})`);
    result.sources.push(`Active entities: ${entities.filter(e => e.attributes.entity.status === 'ACTIVE').length}/${entities.length}`);

    return result;
  }

  /**
   * Calculate comprehensive entity score based on tested criteria
   */
  private calculateEntityScore(entity: GLEIFApiEntity, searchTerm: string): number {
    const entityData = entity.attributes.entity;
    const registrationData = entity.attributes.registration;
    let score = 0;

    // 1. Name similarity (40 points max)
    const nameScore = this.calculateNameSimilarity(entityData.legalName.name, searchTerm);
    score += nameScore * 0.4;

    // 2. Entity status (25 points max)
    if (entityData.status === 'ACTIVE') score += 25;
    else if (entityData.status === 'INACTIVE') score += 10;

    // 3. Registration status (20 points max)
    if (registrationData.registrationStatus === 'ISSUED') score += 20;
    else if (registrationData.registrationStatus === 'PENDING_VALIDATION') score += 15;
    else if (registrationData.registrationStatus === 'LAPSED') score += 10;

    // 4. Data completeness (10 points max)
    let completenessScore = 0;
    if (entityData.legalAddress?.country) completenessScore += 2;
    if (entityData.legalAddress?.city) completenessScore += 2;
    if (entityData.legalForm?.id) completenessScore += 2;
    if (entityData.otherNames && entityData.otherNames.length > 0) completenessScore += 2;
    if (registrationData.initialRegistrationDate) completenessScore += 2;
    score += completenessScore;

    // 5. Entity category preference (5 points max)
    if (entityData.category === 'GENERAL') score += 5;
    else if (entityData.category === 'FUND') score += 3;

    return Math.round(score);
  }

  /**
   * Calculate name similarity score (0-100)
   */
  private calculateNameSimilarity(entityName: string, searchTerm: string): number {
    const entity = entityName.toLowerCase().trim();
    const search = searchTerm.toLowerCase().trim();

    // Exact match
    if (entity === search) return 100;

    // Direct containment
    if (entity.includes(search) || search.includes(entity)) return 90;

    // Word-based similarity
    const entityWords = entity.split(/\s+/).filter(word => word.length > 2);
    const searchWords = search.split(/\s+/).filter(word => word.length > 2);
    
    if (entityWords.length === 0 || searchWords.length === 0) return 20;

    const commonWords = entityWords.filter(word => 
      searchWords.some(searchWord => 
        word.includes(searchWord) || searchWord.includes(word)
      )
    );

    const similarity = (commonWords.length / Math.max(entityWords.length, searchWords.length)) * 80;
    return Math.round(similarity);
  }

  /**
   * Search GLEIF API with exact or fuzzy matching (enhanced with tested patterns)
   */
  private async searchGLEIF(companyName: string, fuzzy: boolean = false): Promise<GLEIFApiResponse | null> {
    try {
      // Clean and prepare search term (from tested code)
      const cleanedName = companyName.trim().replace(/['"]/g, '');
      const encodedTerm = encodeURIComponent(cleanedName);
      
      // Enhanced search pattern based on tested fuzzy logic
      let searchTerm: string;
      if (fuzzy) {
        // Use more comprehensive fuzzy pattern from tested code
        searchTerm = `*${encodedTerm}*`;
      } else {
        searchTerm = encodedTerm;
      }
      
      // Increase page size for better analysis (from tested code insights)
      const searchUrl = `${this.baseUrl}/lei-records?filter[entity.legalName]=${searchTerm}&page[size]=10`;

      console.log(`[GLEIF] API Request (${fuzzy ? 'fuzzy' : 'exact'}): ${searchUrl}`);

      const response: AxiosResponse<any> = await axios.get(searchUrl, {
        headers: this.headers,
        timeout: 15000, // Increased timeout
        validateStatus: (status) => status < 500, // Accept 4xx responses as well
      });

      // Enhanced response validation
      const contentType = response.headers['content-type'] || '';
      const responseData = response.data;
      
      // Check for HTML error pages
      if (contentType.includes('text/html') || 
          (typeof responseData === 'string' && responseData.trim().startsWith('<!DOCTYPE'))) {
        console.error(`[GLEIF] API returned HTML error page (status: ${response.status})`);
        throw new Error(`GLEIF API returned HTML error page (status: ${response.status})`);
      }

      // Validate JSON response
      if (typeof responseData === 'string') {
        try {
          const parsedData = JSON.parse(responseData);
          response.data = parsedData;
        } catch (e) {
          console.error(`[GLEIF] JSON parse failed:`, responseData.substring(0, 200));
          throw new Error('Invalid JSON response from GLEIF API');
        }
      }

      if (response.status === 200) {
        // Validate response structure using Zod
        try {
          const validatedData = GLEIFApiResponseSchema.parse(response.data);
          console.log(`[GLEIF] API Success: Found ${validatedData.data.length} entities`);
          return validatedData;
        } catch (validationError) {
          console.error(`[GLEIF] Response validation failed:`, validationError);
          
          // Fallback: check basic structure manually
          if (response.data && Array.isArray(response.data.data)) {
            console.log(`[GLEIF] API Success (basic validation): Found ${response.data.data.length} entities`);
            return response.data as GLEIFApiResponse;
          } else {
            console.error(`[GLEIF] Invalid response structure:`, response.data);
            throw new Error('Invalid GLEIF API response structure');
          }
        }
      }

      if (response.status === 404) {
        console.log(`[GLEIF] No entities found for search term: ${companyName}`);
        return { data: [] };
      }

      console.log(`[GLEIF] API returned status ${response.status}`);
      return null;

    } catch (error: any) {
      // Enhanced error handling
      if (error.response) {
        const contentType = error.response.headers['content-type'] || '';
        const responseData = error.response.data;
        
        if (contentType.includes('text/html') || 
            (typeof responseData === 'string' && responseData.includes('<!DOCTYPE'))) {
          console.error(`[GLEIF] API Error: Received HTML error page (status: ${error.response.status})`);
          throw new Error(`GLEIF API temporarily unavailable (status: ${error.response.status})`);
        }
        
        console.error(`[GLEIF] API Error: ${error.response.status} ${error.response.statusText}`);
        throw new Error(`GLEIF API Error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.message.includes('JSON') || error.message.includes('HTML')) {
        console.error(`[GLEIF] Response Format Error:`, error.message);
        throw new Error('GLEIF API returned invalid response format');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error(`[GLEIF] Network Error:`, error.message);
        throw new Error('GLEIF API is unreachable - network error');
      } else {
        console.error(`[GLEIF] Request Error:`, error.message);
        throw new Error(`GLEIF API Request Failed: ${error.message}`);
      }
    }
  }

  

  /**
   * Format GLEIF API result into our standard format
   */
  private formatGLEIFResult(
    entity: GLEIFApiEntity, 
    totalMatches: number, 
    fullApiResponse?: GLEIFApiResponse,
    allEntities?: GLEIFApiEntity[]
  ): GLEIFExtractionResult {
    const entityData = entity.attributes.entity;
    const registrationData = entity.attributes.registration;

    // Determine confidence based on data completeness and match quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    
    if (entityData.status === 'ACTIVE' && registrationData.registrationStatus === 'ISSUED') {
      confidence = 'high';
    } else if (entityData.status === 'ACTIVE') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Extract other names
    const otherNames = entityData.otherNames?.map(name => name.name) || [];

    // Determine legal entity type from legal form
    const legalEntityType = this.mapLegalFormToType(entityData.legalForm?.id);

    return {
      companyName: entityData.legalName.name,
      legalEntityType,
      country: entityData.jurisdiction || entityData.legalAddress?.country || 'Not specified',
      confidence,
      sources: [
        'GLEIF Official Registry',
        `LEI: ${entity.attributes.lei}`,
        `Managing LOU: ${registrationData.managingLOU || 'N/A'}`
      ],
      leiCode: entity.attributes.lei,
      entityStatus: entityData.status,
      registrationStatus: registrationData.registrationStatus,
      jurisdiction: entityData.jurisdiction,
      legalForm: entityData.legalForm?.id,
      addresses: {
        legal: entityData.legalAddress,
        headquarters: entityData.headquartersAddress
      },
      otherNames: otherNames.length > 0 ? otherNames : undefined,
      registrationDate: registrationData.initialRegistrationDate,
      lastUpdateDate: registrationData.lastUpdateDate,
      rawData: entity,
      // Raw JSON passthrough like Perplexity
      rawApiResponse: fullApiResponse,
      fullGleifResponse: fullApiResponse,
      unprocessedEntities: allEntities
    };
  }

  /**
   * Map GLEIF legal form codes to readable types
   */
  private mapLegalFormToType(legalFormId?: string): string {
    if (!legalFormId) return 'Unknown Legal Form';

    // Common GLEIF legal form mappings
    const legalFormMap: Record<string, string> = {
      'PJ10': 'Corporation',
      '8888': 'Corporation',
      'C3VN': 'Limited Liability Company',
      'TXGZ': 'Public Limited Company',
      '5WWO': 'Foundation',
      'PRIV': 'Private Foundation',
      'OTHR': 'Other Entity Type',
      '549300': 'Corporation',
      'LTD': 'Limited Company',
      'INC': 'Incorporated Company',
      'LLC': 'Limited Liability Company',
      'PLC': 'Public Limited Company'
    };

    return legalFormMap[legalFormId] || `Legal Form: ${legalFormId}`;
  }

  /**
   * Comprehensive entity analysis method (inspired by tested Python implementation)
   */
  async analyzeEntity(leiOrName: string, isLEI: boolean = false): Promise<any> {
    try {
      console.log(`[GLEIF] Starting comprehensive analysis for: ${leiOrName}`);
      
      let entities: GLEIFApiEntity[] = [];
      
      if (isLEI && leiOrName.length === 20) {
        // Direct LEI lookup
        const result = await this.searchByLEI(leiOrName);
        if (result.leiCode) {
          // Convert result back to API entity format for analysis
          const apiResponse = await this.searchGLEIF(result.companyName, false);
          entities = apiResponse?.data || [];
        }
      } else {
        // Name-based search
        const exactResult = await this.searchGLEIF(leiOrName, false);
        if (exactResult && exactResult.data.length > 0) {
          entities = exactResult.data;
        } else {
          const fuzzyResult = await this.searchGLEIF(leiOrName, true);
          entities = fuzzyResult?.data || [];
        }
      }

      if (entities.length === 0) {
        return {
          searchTerm: leiOrName,
          found: false,
          message: 'No entities found in GLEIF registry'
        };
      }

      // Comprehensive analysis of all found entities
      const analysis = {
        searchTerm: leiOrName,
        found: true,
        totalEntities: entities.length,
        entities: entities.map((entity, index) => {
          const entityData = entity.attributes.entity;
          const registrationData = entity.attributes.registration;
          
          return {
            rank: index + 1,
            lei: entity.attributes.lei,
            legalName: entityData.legalName.name,
            entityStatus: entityData.status,
            registrationStatus: registrationData.registrationStatus,
            jurisdiction: entityData.jurisdiction || entityData.legalAddress?.country,
            legalForm: entityData.legalForm?.id,
            legalAddress: {
              country: entityData.legalAddress?.country,
              city: entityData.legalAddress?.city,
              region: entityData.legalAddress?.region,
              addressLine: entityData.legalAddress?.firstAddressLine
            },
            headquartersAddress: {
              country: entityData.headquartersAddress?.country,
              city: entityData.headquartersAddress?.city,
              region: entityData.headquartersAddress?.region
            },
            otherNames: entityData.otherNames?.map(name => name.name) || [],
            registrationDate: registrationData.initialRegistrationDate,
            lastUpdateDate: registrationData.lastUpdateDate,
            nextRenewalDate: registrationData.nextRenewalDate,
            managingLOU: registrationData.managingLOU,
            category: entityData.category,
            score: this.calculateEntityScore(entity, leiOrName)
          };
        }).sort((a, b) => b.score - a.score), // Sort by score
        
        summary: {
          activeEntities: entities.filter(e => e.attributes.entity.status === 'ACTIVE').length,
          issuedRegistrations: entities.filter(e => e.attributes.registration.registrationStatus === 'ISSUED').length,
          uniqueJurisdictions: [...new Set(entities.map(e => 
            e.attributes.entity.jurisdiction || e.attributes.entity.legalAddress?.country
          ).filter(Boolean))],
          legalForms: [...new Set(entities.map(e => e.attributes.entity.legalForm?.id).filter(Boolean))]
        }
      };

      console.log(`[GLEIF] Analysis complete: Found ${entities.length} entities, ${analysis.summary.activeEntities} active`);
      return analysis;

    } catch (error: any) {
      console.error(`[GLEIF] Analysis failed:`, error.message);
      return {
        searchTerm: leiOrName,
        found: false,
        error: error.message
      };
    }
  }

  /**
   * Test basic GLEIF API connection - useful for debugging
   */
  async testGLEIFConnection(): Promise<boolean> {
    try {
      console.log('[GLEIF] Testing basic API connection...');
      
      const testUrl = `${this.baseUrl}/lei-records?page[size]=1`;
      const response = await axios.get(testUrl, {
        headers: this.headers,
        timeout: 10000
      });
      
      console.log(`[GLEIF] Test response status: ${response.status}`);
      console.log(`[GLEIF] Content-Type: ${response.headers['content-type']}`);
      
      if (response.status === 200 && response.data) {
        console.log('[GLEIF] ✅ API connection successful');
        console.log(`[GLEIF] Sample response structure:`, Object.keys(response.data));
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('[GLEIF] ❌ Connection test failed:', error.message);
      if (error.response) {
        console.error(`[GLEIF] Response status: ${error.response.status}`);
        console.error(`[GLEIF] Response headers:`, error.response.headers);
        console.error(`[GLEIF] Content preview:`, typeof error.response.data === 'string' ? 
          error.response.data.substring(0, 200) : 'Non-string response');
      }
      return false;
    }
  }

  /**
   * Search by LEI code directly
   */
  async searchByLEI(leiCode: string): Promise<GLEIFExtractionResult> {
    try {
      if (leiCode.length !== 20) {
        throw new Error('Invalid LEI code length - must be 20 characters');
      }

      const url = `${this.baseUrl}/lei-records/${leiCode.toUpperCase()}`;
      
      console.log(`[GLEIF] LEI Search: ${url}`);

      const response: AxiosResponse<any> = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        throw new Error(`GLEIF API returned HTML error page (status: ${response.status})`);
      }

      if (response.status === 200) {
        // Validate response structure
        if (!response.data || !response.data.data) {
          throw new Error('Invalid GLEIF API response structure for LEI search');
        }
        
        console.log(`[GLEIF] LEI Search Success for: ${leiCode}`);
        return this.formatGLEIFResult(response.data.data, 1);
      }

      if (response.status === 404) {
        throw new Error(`LEI code not found in GLEIF registry`);
      }

      throw new Error(`LEI search failed with status: ${response.status}`);

    } catch (error: any) {
      console.error(`[GLEIF] LEI Search Error for ${leiCode}:`, error.message);
      return {
        companyName: 'LEI not found',
        legalEntityType: 'Not found',
        country: 'Not found',
        confidence: 'low',
        sources: [`GLEIF LEI Search Error: ${error.message}`]
      };
    }
  }
}

export const gleifExtractor = new GLEIFExtractor();
