import { pgTable, serial, text, timestamp, integer, boolean, real, jsonb } from 'drizzle-orm/pg-core';

export const betaExperiments = pgTable('beta_experiments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('alpha'),
  createdAt: timestamp('created_at').defaultNow(),
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

  // Company Extraction Results
  companyName: text('company_name'),
  confidence: integer('confidence'), // This matches the database column name
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

export type BetaExperiment = typeof betaExperiments.$inferSelect;
export type BetaSmokeTest = typeof betaSmokeTests.$inferSelect;
export type NewBetaExperiment = typeof betaExperiments.$inferInsert;
export type NewBetaSmokeTest = typeof betaSmokeTests.$inferInsert;