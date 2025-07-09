
import axios, { AxiosResponse } from 'axios';

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
}

export class GLEIFExtractor {
  private baseUrl = 'https://api.gleif.org/api/v1';
  private headers = {
    'Accept': 'application/vnd.api+json',
    'User-Agent': 'Domain-Intelligence-Platform/1.0'
  };

  /**
   * Extract company information using GLEIF API with retry logic
   */
  async extractCompanyInfo(companyName: string): Promise<GLEIFExtractionResult> {
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

        // Process the best match
        const bestMatch = result.data[0];
        console.log(`[GLEIF] Found match: ${bestMatch.attributes.entity.legalName.name}`);

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
   * Search GLEIF API with exact or fuzzy matching
   */
  private async searchGLEIF(companyName: string, fuzzy: boolean = false): Promise<GLEIFApiResponse | null> {
    try {
      // Use URL encoding approach like main server for better compatibility
      const encodedTerm = encodeURIComponent(companyName);
      const searchTerm = fuzzy ? `*${encodedTerm}*` : encodedTerm;
      const searchUrl = `${this.baseUrl}/lei-records?filter[entity.legalName]=${searchTerm}&page[size]=5`;

      console.log(`[GLEIF] API Request: ${searchUrl}`);

      const response: AxiosResponse<any> = await axios.get(searchUrl, {
        headers: this.headers,
        timeout: 15000, // Increased timeout
        validateStatus: (status) => status < 500, // Accept 4xx responses as well
        transformResponse: [(data) => {
          // Custom response transformer to handle HTML responses
          if (typeof data === 'string' && data.trim().startsWith('<!DOCTYPE')) {
            console.error(`[GLEIF] Received HTML response instead of JSON`);
            throw new Error('GLEIF API returned HTML error page');
          }
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error(`[GLEIF] JSON parse failed:`, data.substring(0, 200));
            throw new Error('Invalid JSON response from GLEIF API');
          }
        }]
      });

      // Additional content type check
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.error(`[GLEIF] API returned HTML content type (status: ${response.status})`);
        throw new Error(`GLEIF API returned HTML error page (status: ${response.status})`);
      }

      if (response.status === 200) {
        // Validate response structure
        if (!response.data || !Array.isArray(response.data.data)) {
          console.error(`[GLEIF] Invalid response structure:`, response.data);
          throw new Error('Invalid GLEIF API response structure');
        }
        
        console.log(`[GLEIF] API Success: Found ${response.data.data.length} entities`);
        return response.data as GLEIFApiResponse;
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
  private formatGLEIFResult(entity: GLEIFApiEntity, totalMatches: number): GLEIFExtractionResult {
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
      rawData: entity
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
