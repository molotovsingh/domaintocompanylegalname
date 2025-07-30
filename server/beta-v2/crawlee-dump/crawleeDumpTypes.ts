// Type definitions for Crawlee dump service

export interface CrawlConfig {
  maxPages?: number;         // Default: 10
  maxDepth?: number;         // Default: 2
  waitTime?: number;         // Milliseconds between requests, Default: 1000
  includePaths?: string[];   // Optional: paths to include
  excludePaths?: string[];   // Optional: paths to exclude
  captureNetworkRequests?: boolean; // Enable network request capture (requires Playwright)
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

export interface CrawleeDumpData {
  pages: PageData[];
  requests: NetworkRequest[];
  siteMap: SiteMap;
  crawlStats: CrawlStats;
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