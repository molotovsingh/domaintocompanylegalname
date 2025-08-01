// Types for Data Processing Stage 2

export type ProcessingStatus = 'pending' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'completed' | 'failed';

export type SourceType = 'crawlee_dump' | 'scrapy_crawl' | 'playwright_dump' | 'axios_cheerio_dump';

export interface AvailableDump {
  id: number;
  domain: string;
  sourceType: SourceType;
  createdAt: string;
  status: string;
  hasData: boolean;
}

export interface ProcessingResult {
  id: number;
  sourceType: string;
  sourceId: number;
  domain: string;
  
  // Stage 1 results
  stage1StrippedText?: string;
  stage1ProcessingTimeMs?: number;
  
  // Stage 2 results
  stage2ExtractedData?: any;
  stage2ModelUsed?: string;
  stage2ProcessingTimeMs?: number;
  
  // Stage 3 results
  stage3EntityName?: string;
  stage3EntityConfidence?: number;
  stage3ModelUsed?: string;
  stage3ProcessingTimeMs?: number;
  stage3Reasoning?: string;
  stage3AlternativeNames?: string[];
  
  // Stage 4 results
  stage4GleifSearchId?: number;
  stage4PrimaryLei?: string;
  stage4PrimaryLegalName?: string;
  stage4ConfidenceScore?: number;
  stage4TotalCandidates?: number;
  
  // Overall status
  processingStatus: ProcessingStatus;
  errorMessage?: string;
  totalProcessingTimeMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessingInput {
  sourceType: string;
  sourceId: number;
  domain: string;
  processingStatus: ProcessingStatus;
}

export interface StageResult {
  success: boolean;
  data?: any;
  error?: string;
}

// API Response types
export interface ProcessingListResponse {
  success: boolean;
  data?: ProcessingResult[];
  error?: string;
}

export interface ProcessingDetailResponse {
  success: boolean;
  data?: ProcessingResult;
  error?: string;
}

export interface AvailableDumpsResponse {
  success: boolean;
  data?: AvailableDump[];
  error?: string;
}

export interface StartProcessingRequest {
  sourceType: SourceType;
  sourceId: number;
}

export interface StartProcessingResponse {
  success: boolean;
  processingId?: number;
  error?: string;
}