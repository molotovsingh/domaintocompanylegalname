// TypeScript interfaces for GLEIF Search Service

export interface GLEIFSearchRequest {
  id?: number;
  suspectedName: string;
  domain?: string;
  searchMethod?: 'exact' | 'fuzzy' | 'geographic';
  jurisdiction?: string;
  status?: string;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GLEIFAddress {
  country?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  addressLine?: string;
}

export interface GLEIFCandidate {
  id?: number;
  searchId?: number;
  leiCode: string;
  legalName: string;
  entityStatus?: string;
  legalForm?: string;
  legalFormCode?: string;
  jurisdiction?: string;
  entityCategory?: string;
  entitySubCategory?: string;
  
  // Headquarters
  headquarters: GLEIFAddress;
  
  // Legal address
  legalAddress: GLEIFAddress;
  
  // Registration info
  registrationStatus?: string;
  initialRegistrationDate?: string;
  lastUpdateDate?: string;
  nextRenewalDate?: string;
  managingLou?: string;
  
  // Relationship data (NEW)
  relationships?: {
    ultimateParent?: {
      leiCode: string;
      legalName: string;
      relationship: string;
      status: string;
    };
    directParent?: {
      leiCode: string;
      legalName: string;
      relationship: string;
      status: string;
    };
    children?: Array<{
      leiCode: string;
      legalName: string;
      relationship: string;
      status: string;
    }>;
  };
  
  // Algorithmic scores
  nameMatchScore?: number;
  fortune500Score?: number;
  tldJurisdictionScore?: number;
  entityComplexityScore?: number;
  weightedTotalScore?: number;
  selectionReason?: string;
  
  // Additional metadata
  otherNames?: string[];
  validationSources?: string;
  bicCodes?: string[];
  
  // Raw data
  gleifRawData?: any;
  
  createdAt?: Date;
}

export interface GLEIFSearchResult {
  searchRequest: GLEIFSearchRequest;
  candidates: GLEIFCandidate[];
  totalMatches: number;
  searchDuration?: number;
}

// API Response types following Beta V2 conventions
export interface GLEIFSearchResponse {
  success: boolean;
  data?: GLEIFSearchResult;
  error?: string;
  code?: string;
  details?: any;
}

// GLEIF API response structure
export interface GLEIFApiResponse {
  data: GLEIFApiEntity[];
  meta?: {
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

export interface GLEIFApiEntity {
  id: string;
  type: string;
  attributes: {
    lei: string;
    entity: {
      legalName: {
        name: string;
        language?: string;
      };
      otherNames?: Array<{
        name: string;
        type?: string;
        language?: string;
      }>;
      status: string;
      legalForm?: {
        id: string;
        other?: string;
      };
      category?: string;
      subCategory?: string;
      jurisdiction?: string;
      legalAddress: {
        addressLines?: string[];
        addressNumber?: string;
        addressNumberWithinBuilding?: string;
        mailRouting?: string;
        city?: string;
        region?: string;
        country?: string;
        postalCode?: string;
      };
      headquartersAddress: {
        addressLines?: string[];
        addressNumber?: string;
        addressNumberWithinBuilding?: string;
        mailRouting?: string;
        city?: string;
        region?: string;
        country?: string;
        postalCode?: string;
      };
    };
    registration: {
      initialRegistrationDate?: string;
      lastUpdateDate?: string;
      status: string;
      nextRenewalDate?: string;
      managingLou?: string;
      validationSources?: string;
    };
    bic?: string[];
  };
}

// TLD to country mapping type
export type TLDMapping = Record<string, string>;