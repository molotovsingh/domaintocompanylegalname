// Type definitions for Crawlee dump service

export interface CrawlConfig {
  maxPages?: number;         // Default: 10
  maxDepth?: number;         // Default: 2
  waitTime?: number;         // Milliseconds between requests, Default: 1000
  includePaths?: string[];   // Optional: paths to include
  excludePaths?: string[];   // Optional: paths to exclude
  captureNetworkRequests?: boolean; // Enable network request capture (requires Playwright)
}

export interface PageMetadata {
  // Language metadata
  language: {
    htmlLang?: string;              // From <html lang="...">
    contentLanguage?: string;       // From HTTP Content-Language header
    metaLanguage?: string;          // From <meta http-equiv="content-language">
    detectedLanguages?: string[];   // All languages detected in content
    primaryLanguage?: string;       // Best guess primary language
    confidence: number;             // 0-1 confidence score
  };
  
  // Location metadata
  location: {
    serverCountry?: string;         // From IP geolocation
    serverRegion?: string;          // Server region/state
    businessCountry?: string;       // From address parsing
    businessCity?: string;          // From address parsing
    legalJurisdiction?: string;    // From legal text (Terms, Privacy)
    tldHint?: string;              // Country hint from TLD (.uk, .de, etc)
    schemaOrgLocation?: any;       // Location from schema.org markup
    consolidatedCountry?: string;  // Best guess country
    confidence: number;            // 0-1 confidence score
  };
  
  // Currency metadata
  currency: {
    primaryCurrency?: string;      // Most frequently detected currency
    allCurrencies?: string[];      // All detected currencies
    symbolFrequency?: Record<string, number>; // Count of each currency symbol
    paymentProcessors?: string[];  // Detected payment processors (Stripe, PayPal)
    openGraphPrices?: any[];       // Price data from OpenGraph tags
    confidence: number;            // 0-1 confidence score
    source?: string;               // Where currency was primarily found
  };
  
  // Industry/Content patterns for bias detection
  contentPatterns: {
    formalityLevel?: 'high' | 'medium' | 'low';  // Content formality
    transparencyScore?: number;    // 0-1 score for entity transparency
    privacyFocused?: boolean;     // GDPR/privacy-heavy content detected
    industrySector?: string;      // Detected industry
    regulatoryRegion?: string;    // EU_MiFID, US_SEC, etc.
    disclosureRequirements?: 'high' | 'medium' | 'low';
  };
}

export interface PageData {
  url: string;
  html: string;
  text: string;
  title?: string;  // Page title
  metaTags?: Record<string, string>;  // Meta tag name/property -> content
  links?: Array<{  // Links found on the page
    url: string;
    text: string;
    type: 'internal' | 'external';
  }>;
  structuredData?: any[];  // JSON-LD structured data
  statusCode: number;
  headers: Record<string, string>;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  timestamp: number;
  depth?: number;  // Distance from the starting URL
  metadata?: PageMetadata;  // Enhanced metadata for bias detection
}

export interface NetworkRequest {
  url: string;
  method: string;
  statusCode: number;
  headers: Record<string, string>;
  responseSize: number;
  timestamp: number;
}

export interface SiteMap {
  internalLinks: string[];
  externalLinks: string[];
  sitemapXml?: string;
  robotsTxt?: string;
}

export interface CrawlStats {
  pagesCrawled: number;
  totalSizeBytes: number;
  timeTakenMs: number;
  errors: string[];
}

export interface CleanedPageData {
  url: string;
  companyName?: string;
  addresses: string[];
  phones: string[];
  emails: string[];
  currencies: string[];
  footerLegal?: string;
  keyText?: string;
  links: {
    internal: string[];
    external: string[];
  };
  cleaningTimeMs?: number;
}

export interface CrawleeDumpData {
  pages: PageData[];
  requests: NetworkRequest[];
  siteMap: SiteMap;
  crawlStats: CrawlStats;
  cleanedPages?: CleanedPageData[];  // LLM-cleaned data
  totalCleaningTimeMs?: number;
}

export interface CrawleeDump {
  id?: number;
  domain: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  config: CrawlConfig;
  dumpData?: CrawleeDumpData;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CrawleeDumpSummary {
  id: number;
  domain: string;
  status: string;
  pagesCrawled: number;
  totalSizeBytes: number;
  processingTimeMs: number;
  createdAt: Date;
  error?: string;
}