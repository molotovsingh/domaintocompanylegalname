// Types for Beta V2 Cleaning Service

export interface CleaningRequest {
  sourceType: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump';
  sourceId: number;
  modelName: string;
  compareModels?: string[]; // For A/B testing multiple models
}

export interface ExtractedData {
  // Primary entity fields for GLEIF search
  primaryEntityName?: string;
  baseEntityName?: string;
  companyName?: string; // Kept for backwards compatibility
  legalEntity?: string; // Deprecated but kept for compatibility
  
  // Entity discovery fields
  entityCandidates?: string[];
  nameVariations?: string[];
  parentOrSubsidiaries?: string[];
  excludeTerms?: string[];
  
  // Confidence indicators
  confidenceIndicators?: {
    hasLegalSuffix?: boolean;
    foundInCopyright?: boolean;
    foundInLegalText?: boolean;
    multipleNamesFound?: boolean;
  };
  
  // Supporting information
  addresses?: string[];
  phones?: string[];
  emails?: string[];
  currencies?: string[];
  countries?: string[];
  socialMedia?: string[];
  businessIdentifiers?: {
    registrationNumbers?: string[];
    taxIds?: string[];
    licenses?: string[];
  };
  rawText?: string; // Original text content for reference
}

export interface CleaningMetadata {
  processingTimeMs: number;
  tokenCount: number;
  costEstimate: number;
  confidenceScore: number;
  model: string;
  provider: string;
  errorMessage?: string;
}

export interface CleaningResult {
  id?: number;
  extractedData: ExtractedData;
  metadata: CleaningMetadata;
}

export interface ModelInfo {
  name: string;
  provider: string;
  displayName: string;
  description?: string;
  costPer1kTokens: number;
  isFree: boolean;
  maxTokens: number;
  temperature: number;
  status: 'available' | 'unavailable' | 'rate_limited';
}

export interface RawDumpData {
  id: number;
  domain: string;
  content: string | any; // Can be HTML string or structured data
  metadata?: any;
  collectedAt: Date;
}

export interface AvailableDump {
  type: 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump';
  id: number;
  domain: string;
  pages?: number;
  size?: string;
  collectedAt: Date;
  hasBeenCleaned: boolean;
  cleanedWith?: string[];
}

export interface CleaningSession {
  id?: number;
  sessionId: string;
  sourceType: string;
  sourceId: number;
  modelsUsed: string[];
  createdAt?: Date;
}

export interface ModelPerformanceRecord {
  id?: number;
  modelName: string;
  domain?: string;
  extractionQuality?: number; // 1-5 rating
  processingTimeMs: number;
  success: boolean;
  createdAt?: Date;
}