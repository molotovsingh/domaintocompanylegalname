import { pgTable, serial, text, timestamp, integer, boolean, real, jsonb, varchar } from 'drizzle-orm/pg-core';

// Axios Cheerio V2 Dumps Table
export const axiosCheerioV2Dumps = pgTable('axios_cheerio_dumps', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  companyName: text('company_name'),
  extractionMethod: varchar('extraction_method', { length: 100 }),
  confidenceScore: integer('confidence_score'),
  httpStatus: integer('http_status'),
  responseTimeMs: integer('response_time_ms'),
  htmlSizeBytes: integer('html_size_bytes'),
  rawHtml: text('raw_html'),
  headers: jsonb('headers'),
  metaTags: jsonb('meta_tags'),
  extractionStrategies: jsonb('extraction_strategies'),
  pageMetadata: jsonb('page_metadata'),
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  processingTimeMs: integer('processing_time_ms')
});

// Crawlee Dumps Table
export const crawleeDumps = pgTable('crawlee_dumps', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull(),
  status: text('status').notNull().default('pending'),
  maxPages: integer('max_pages').default(10),
  maxDepth: integer('max_depth').default(2),
  waitTime: integer('wait_time').default(1000),
  includePaths: jsonb('include_paths'),
  excludePaths: jsonb('exclude_paths'),
  dumpData: jsonb('dump_data'),
  pagesCrawled: integer('pages_crawled').default(0),
  totalSizeBytes: integer('total_size_bytes').default(0),
  processingTimeMs: integer('processing_time_ms'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  captureNetworkRequests: boolean('capture_network_requests')
});

// Scrapy Crawls Table
export const scrapyCrawls = pgTable('scrapy_crawls', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull(),
  rawData: jsonb('raw_data'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  errorMessage: text('error_message'),
  processingTimeMs: integer('processing_time_ms'),
  createdAt: timestamp('created_at').defaultNow()
});

export const betaExperiments = pgTable('beta_experiments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('alpha'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at').defaultNow(),
  usageCount: integer('usage_count').default(0),
  successRate: real('success_rate'),
  averageResponseTimeMs: integer('average_response_time_ms'),
  createdBy: text('created_by').default('system')
});

export const betaSmokeTests = pgTable('beta_smoke_tests', {
  id: serial('id').primaryKey(),

  // Test Metadata
  domain: text('domain').notNull(),
  method: text('method').notNull(),
  experimentId: integer('experiment_id').references(() => betaExperiments.id),
  createdAt: timestamp('created_at').defaultNow(),

  // Performance Metrics
  processingTimeMs: integer('processing_time_ms'),
  success: boolean('success').default(false),
  error: text('error'),

  // Company Extraction Results - matching database column names exactly
  companyName: text('company_name'),
  companyConfidence: integer('company_confidence'),
  companyExtractionMethod: text('company_extraction_method'),

  // Geographic Intelligence
  detectedCountry: text('detected_country'),
  countryConfidence: integer('country_confidence'),
  geoMarkers: jsonb('geo_markers'),

  // Legal Document Discovery
  termsUrl: text('terms_url'),
  privacyUrl: text('privacy_url'),
  legalUrls: jsonb('legal_urls'),
  legalContentExtracted: boolean('legal_content_extracted').default(false),

  // About Us Extraction
  aboutUrl: text('about_url'),
  aboutContent: text('about_content'),
  aboutExtractionSuccess: boolean('about_extraction_success').default(false),

  // Social Media Discovery
  socialMediaLinks: jsonb('social_media_links'),
  socialMediaCount: integer('social_media_count').default(0),

  // Contact Information
  contactEmails: jsonb('contact_emails'),
  contactPhones: jsonb('contact_phones'),
  contactAddresses: jsonb('contact_addresses'),
  hasContactPage: boolean('has_contact_page').default(false),

  // Raw Data Storage
  rawHtmlSize: integer('raw_html_size'),
  rawExtractionData: jsonb('raw_extraction_data'),
  pageMetadata: jsonb('page_metadata'),

  // Technical Details
  httpStatus: integer('http_status'),
  renderRequired: boolean('render_required'),
  javascriptErrors: jsonb('javascript_errors'),
  extractionSteps: jsonb('extraction_steps')
});

export const betaPerformanceMetrics = pgTable('beta_performance_metrics', {
  id: serial('id').primaryKey(),
  experimentId: integer('experiment_id').references(() => betaExperiments.id),
  metricName: text('metric_name').notNull(),
  metricValue: real('metric_value').notNull(),
  metricUnit: text('metric_unit'),
  recordedAt: timestamp('recorded_at').defaultNow()
});

export type BetaExperiment = typeof betaExperiments.$inferSelect;
export type BetaSmokeTest = typeof betaSmokeTests.$inferSelect;
export type NewBetaExperiment = typeof betaExperiments.$inferInsert;
export type NewBetaSmokeTest = typeof betaSmokeTests.$inferInsert;

// New table types
export type AxiosCheerioV2Dump = typeof axiosCheerioV2Dumps.$inferSelect;
export type NewAxiosCheerioV2Dump = typeof axiosCheerioV2Dumps.$inferInsert;
export type CrawleeDump = typeof crawleeDumps.$inferSelect;
export type NewCrawleeDump = typeof crawleeDumps.$inferInsert;
export type ScrapyCrawl = typeof scrapyCrawls.$inferSelect;
export type NewScrapyCrawl = typeof scrapyCrawls.$inferInsert;