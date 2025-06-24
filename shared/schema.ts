import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, success, failed
  companyName: text("company_name"),
  extractionMethod: text("extraction_method"), // html_title, meta_description, domain_parse
  confidenceScore: real("confidence_score"),
  retryCount: integer("retry_count").default(0),
  errorMessage: text("error_message"),
  batchId: text("batch_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const batches = pgTable("batches", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  totalDomains: integer("total_domains").notNull(),
  processedDomains: integer("processed_domains").default(0),
  successfulDomains: integer("successful_domains").default(0),
  failedDomains: integer("failed_domains").default(0),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // batch_upload, batch_complete, worker_status, error
  message: text("message").notNull(),
  details: text("details"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  uploadedAt: true,
  completedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export const processingStatsSchema = z.object({
  totalDomains: z.number(),
  processedDomains: z.number(),
  successRate: z.number(),
  processingRate: z.number(),
  eta: z.string(),
});

export const sessionResultsSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  totalDomains: z.number(),
  successfulDomains: z.number(),
  failedDomains: z.number(),
  successRate: z.number(),
  averageConfidence: z.number(),
  extractionMethods: z.record(z.number()),
  processingTime: z.number(),
  completedAt: z.string(),
  qualityMetrics: z.object({
    highConfidenceCount: z.number(),
    mediumConfidenceCount: z.number(),
    lowConfidenceCount: z.number(),
    domainParseCount: z.number(),
    htmlExtractionCount: z.number(),
  }),
  failureReasons: z.record(z.number()),
  duplicatesDetected: z.number().optional(),
  duplicatesSkipped: z.number().optional(),
  newDomainsProcessed: z.number().optional(),
  duplicatesSavingsPercentage: z.number().optional(),
});

export const analyticsDataSchema = z.object({
  batchId: z.string(),
  fileName: z.string(),
  completedAt: z.string(),
  totalDomains: z.number(),
  successRate: z.number(),
  medianConfidence: z.number(),
  averageConfidence: z.number(),
  domainMappingPercentage: z.number(),
  avgProcessingTimePerDomain: z.number(),
  highConfidencePercentage: z.number(),
});

export type ProcessingStats = z.infer<typeof processingStatsSchema>;
export type SessionResults = z.infer<typeof sessionResultsSchema>;
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;
