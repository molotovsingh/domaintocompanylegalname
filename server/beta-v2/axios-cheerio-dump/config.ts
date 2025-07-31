// Configuration for Axios + Cheerio Dump Service

export const AXIOS_CHEERIO_CONFIG = {
  // Service identification
  serviceName: 'Axios+Cheerio Dump',
  version: '1.0.0',
  
  // HTTP Request settings
  timeout: parseInt(process.env.AXIOS_CHEERIO_TIMEOUT || '30000'), // 30 seconds default
  maxRedirects: parseInt(process.env.AXIOS_CHEERIO_MAX_REDIRECTS || '5'),
  userAgent: process.env.AXIOS_CHEERIO_USER_AGENT || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  
  // Processing settings
  maxRetries: parseInt(process.env.AXIOS_CHEERIO_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.AXIOS_CHEERIO_RETRY_DELAY || '1000'), // 1 second
  
  // Extraction settings
  maxHtmlSize: parseInt(process.env.AXIOS_CHEERIO_MAX_HTML_SIZE || '10485760'), // 10MB
  enableFooterExtraction: process.env.AXIOS_CHEERIO_ENABLE_FOOTER === 'true', // Disabled by default
  minConfidenceScore: parseInt(process.env.AXIOS_CHEERIO_MIN_CONFIDENCE || '50'),
  
  // Feature flags
  features: {
    enableMetrics: process.env.AXIOS_CHEERIO_ENABLE_METRICS === 'true',
    enableDebugLogging: process.env.AXIOS_CHEERIO_DEBUG === 'true',
    enableDetailedErrors: process.env.AXIOS_CHEERIO_DETAILED_ERRORS === 'true',
    saveRawHtml: process.env.AXIOS_CHEERIO_SAVE_RAW_HTML !== 'false', // Enabled by default
  },
  
  // Database settings
  database: {
    queryTimeout: parseInt(process.env.AXIOS_CHEERIO_DB_TIMEOUT || '5000'), // 5 seconds
    maxResults: parseInt(process.env.AXIOS_CHEERIO_MAX_RESULTS || '100'),
  },
  
  // Rate limiting (for future use)
  rateLimiting: {
    enabled: process.env.AXIOS_CHEERIO_RATE_LIMIT === 'true',
    maxConcurrent: parseInt(process.env.AXIOS_CHEERIO_MAX_CONCURRENT || '10'),
    windowMs: parseInt(process.env.AXIOS_CHEERIO_RATE_WINDOW || '60000'), // 1 minute
  }
};

// Validation
export function validateConfig(): void {
  const config = AXIOS_CHEERIO_CONFIG;
  
  if (config.timeout < 1000) {
    console.warn('[Axios+Cheerio] [Config] Timeout too low, using minimum of 1000ms');
    config.timeout = 1000;
  }
  
  if (config.maxRedirects < 0 || config.maxRedirects > 10) {
    console.warn('[Axios+Cheerio] [Config] Invalid maxRedirects, using default of 5');
    config.maxRedirects = 5;
  }
  
  if (config.maxHtmlSize < 1024) {
    console.warn('[Axios+Cheerio] [Config] maxHtmlSize too small, using minimum of 1KB');
    config.maxHtmlSize = 1024;
  }
}

// Initialize validation on import
validateConfig();