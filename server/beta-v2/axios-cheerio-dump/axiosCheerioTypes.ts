// Types for Beta V2 Axios + Cheerio Dump Service

export interface AxiosCheerioConfig {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

export interface CompanyCandidate {
  name: string;
  extractionMethod: string;
  confidence: number;
}

export interface ExtractionResult {
  companyName: string | null;
  extractionMethod: string | null;
  confidence: number;
  alternativeCandidates: CompanyCandidate[];
  attemptedStrategies: string[];
}

export interface PageMetadata {
  title: string;
  description: string;
  charset: string;
  language: string;
  viewport: string;
}

export interface AxiosCheerioData {
  rawHtml: string;
  headers: Record<string, string>;
  metaTags: MetaTag[];
  extractionResults: ExtractionResult;
  pageMetadata: PageMetadata;
  httpStatus: number;
  responseTimeMs: number;
  htmlSizeBytes: number;
  error?: string;
}

export interface DumpStatus {
  id: number;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  companyName?: string;
  confidence?: number;
  extractionMethod?: string;
  processingTimeMs?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AxiosCheerioRow {
  id: number;
  domain: string;
  status: string;
  company_name: string | null;
  extraction_method: string | null;
  confidence_score: number | null;
  http_status: number | null;
  response_time_ms: number | null;
  html_size_bytes: number | null;
  raw_html: string | null;
  headers: any;
  meta_tags: any;
  extraction_strategies: any;
  page_metadata: any;
  error_message: string | null;
  error_details: any;
  created_at: Date;
  completed_at: Date | null;
  processing_time_ms: number | null;
}