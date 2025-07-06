
import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const betaExperiments = pgTable('beta_experiments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active, paused, completed
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const betaSmokeTests = pgTable('beta_smoke_tests', {
  id: serial('id').primaryKey(),
  
  // Test Metadata
  domain: text('domain').notNull(),
  method: text('method').notNull(), // puppeteer, playwright, axios_cheerio
  experimentId: integer('experiment_id').references(() => betaExperiments.id),
  createdAt: timestamp('created_at').defaultNow(),
  
  // Performance Metrics
  processingTimeMs: integer('processing_time_ms'),
  success: boolean('success').default(false),
  error: text('error'),
  
  // Company Extraction Results
  companyName: text('company_name'),
  companyConfidence: integer('company_confidence'),
  companyExtractionMethod: text('company_extraction_method'), // meta_property, structured_data, etc
  
  // Geographic Intelligence
  detectedCountry: text('detected_country'),
  countryConfidence: integer('country_confidence'),
  geoMarkers: jsonb('geo_markers'), // {addresses: [], phones: [], currencies: [], languages: []}
  
  // Legal Document Discovery
  termsUrl: text('terms_url'),
  privacyUrl: text('privacy_url'),
  legalUrls: jsonb('legal_urls'), // [{type: 'cookies', url: '...'}, ...]
  legalContentExtracted: boolean('legal_content_extracted').default(false),
  
  // About Us Extraction
  aboutUrl: text('about_url'),
  aboutContent: text('about_content'), // First 1000 chars of about content
  aboutExtractionSuccess: boolean('about_extraction_success').default(false),
  
  // Social Media Discovery
  socialMediaLinks: jsonb('social_media_links'), // {twitter: '...', linkedin: '...', facebook: '...'}
  socialMediaCount: integer('social_media_count').default(0),
  
  // Contact Information
  contactEmails: jsonb('contact_emails'), // ['info@example.com', 'sales@example.com']
  contactPhones: jsonb('contact_phones'), // ['+1-555-0123', '1-800-COMPANY']
  contactAddresses: jsonb('contact_addresses'), // ['123 Main St, City, State']
  hasContactPage: boolean('has_contact_page').default(false),
  
  // Raw Data Storage (for debugging)
  rawHtmlSize: integer('raw_html_size'), // Size in bytes
  rawExtractionData: jsonb('raw_extraction_data'), // All extracted data in structured format
  pageMetadata: jsonb('page_metadata'), // {title, meta_tags, headers, etc}
  
  // Technical Details
  httpStatus: integer('http_status'),
  renderRequired: boolean('render_required'),
  javascriptErrors: jsonb('javascript_errors'),
  extractionSteps: jsonb('extraction_steps') // Step-by-step log of what was tried
});

export type BetaExperiment = typeof betaExperiments.$inferSelect;
export type BetaSmokeTest = typeof betaSmokeTests.$inferSelect;
export type NewBetaExperiment = typeof betaExperiments.$inferInsert;
export type NewBetaSmokeTest = typeof betaSmokeTests.$inferInsert;
