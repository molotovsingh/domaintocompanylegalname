
import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Beta Experiments Table
export const betaExperiments = pgTable("beta_experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("alpha"), // alpha, beta, ready_for_production, archived
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  usageCount: integer("usage_count").default(0),
  successRate: real("success_rate"),
  averageResponseTime: integer("average_response_time_ms"),
  createdBy: text("created_by").default("system"),
});

// Enhanced Beta Smoke Test Results
export const betaSmokeTests = pgTable("beta_smoke_tests", {
  id: serial("id").primaryKey(),
  
  // Test Metadata
  domain: text("domain").notNull(),
  method: text("method").notNull(), // puppeteer, playwright, axios_cheerio
  experimentId: integer("experiment_id").references(() => betaExperiments.id),
  createdAt: timestamp("created_at").defaultNow(),
  
  // Performance Metrics
  processingTimeMs: integer("processing_time_ms"),
  success: boolean("success").default(false),
  error: text("error"),
  
  // Company Extraction Results
  companyName: text("company_name"),
  companyConfidence: integer("company_confidence"),
  companyExtractionMethod: text("company_extraction_method"),
  
  // Geographic Intelligence
  detectedCountry: text("detected_country"),
  countryConfidence: integer("country_confidence"),
  geoMarkers: text("geo_markers"), // JSON string
  
  // Legal Document Discovery
  termsUrl: text("terms_url"),
  privacyUrl: text("privacy_url"),
  legalUrls: text("legal_urls"), // JSON array
  legalContentExtracted: boolean("legal_content_extracted").default(false),
  
  // About Us Extraction
  aboutUrl: text("about_url"),
  aboutContent: text("about_content"),
  aboutExtractionSuccess: boolean("about_extraction_success").default(false),
  
  // Social Media Discovery
  socialMediaLinks: text("social_media_links"), // JSON
  socialMediaCount: integer("social_media_count").default(0),
  
  // Contact Information
  contactEmails: text("contact_emails"), // JSON array
  contactPhones: text("contact_phones"), // JSON array
  contactAddresses: text("contact_addresses"), // JSON array
  hasContactPage: boolean("has_contact_page").default(false),
  
  // Raw Data Storage
  rawHtmlSize: integer("raw_html_size"),
  rawExtractionData: text("raw_extraction_data"), // JSON
  pageMetadata: text("page_metadata"), // JSON
  
  // Technical Details
  httpStatus: integer("http_status"),
  renderRequired: boolean("render_required"),
  javascriptErrors: text("javascript_errors"), // JSON
  extractionSteps: text("extraction_steps"), // JSON
});

// Beta Performance Metrics
export const betaPerformanceMetrics = pgTable("beta_performance_metrics", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").references(() => betaExperiments.id),
  metricName: text("metric_name").notNull(),
  metricValue: real("metric_value").notNull(),
  metricUnit: text("metric_unit"), // ms, percentage, count
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Schema exports
export const insertBetaExperimentSchema = createInsertSchema(betaExperiments).omit({
  id: true,
  createdAt: true,
});

export const insertBetaSmokeTestSchema = createInsertSchema(betaSmokeTests).omit({
  id: true,
  createdAt: true,
});

export type BetaExperiment = typeof betaExperiments.$inferSelect;
export type InsertBetaExperiment = z.infer<typeof insertBetaExperimentSchema>;
export type BetaSmokeTest = typeof betaSmokeTests.$inferSelect;
export type InsertBetaSmokeTest = z.infer<typeof insertBetaSmokeTestSchema>;
