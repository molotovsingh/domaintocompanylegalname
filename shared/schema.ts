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
  failureCategory: text("failure_category"), // Business classification for failures
  technicalDetails: text("technical_details"), // Technical diagnostic information
  extractionAttempts: text("extraction_attempts"), // JSON string of attempted methods
  recommendation: text("recommendation"), // Next action guidance
  batchId: text("batch_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  processingStartedAt: timestamp("processing_started_at"),
  processingTimeMs: integer("processing_time_ms"), // Time taken to process this domain in milliseconds
  
  // Level 2 GLEIF Enhancement Fields (V2 - Backward Compatible)
  level2Attempted: boolean("level2_attempted").default(false),
  level2Status: text("level2_status"), // 'success', 'multiple_candidates', 'failed', 'not_applicable'
  level2CandidatesCount: integer("level2_candidates_count").default(0),
  level2ProcessingTimeMs: integer("level2_processing_time_ms"),
  
  // Primary GLEIF Selection Results
  primaryLeiCode: text("primary_lei_code"),
  primaryGleifName: text("primary_gleif_name"),
  primarySelectionConfidence: integer("primary_selection_confidence"),
  selectionAlgorithm: text("selection_algorithm"), // 'weighted_score', 'manual_override', 'single_match'
  
  // Enhanced Business Intelligence
  finalLegalName: text("final_legal_name"), // Best result from Level 1 + Level 2
  finalConfidence: integer("final_confidence"), // Combined confidence score
  finalExtractionMethod: text("final_extraction_method"), // 'level1_only', 'level2_enhanced', 'gleif_verified'
  
  // Manual Review Workflow
  manualReviewRequired: boolean("manual_review_required").default(false),
  selectionNotes: text("selection_notes"),
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

// Level 2 GLEIF Candidates Table (V2 Enhancement)
export const gleifCandidates = pgTable("gleif_candidates", {
  id: serial("id").primaryKey(),
  domainId: integer("domain_id").notNull().references(() => domains.id),
  
  // GLEIF Entity Data
  leiCode: text("lei_code").notNull(),
  legalName: text("legal_name").notNull(),
  entityStatus: text("entity_status"), // 'ACTIVE', 'INACTIVE', 'NULL'
  jurisdiction: text("jurisdiction"), // ISO country code
  legalForm: text("legal_form"), // Legal form code
  entityCategory: text("entity_category"),
  registrationStatus: text("registration_status"), // 'ISSUED', 'LAPSED', 'RETIRED'
  
  // Match Scoring
  gleifMatchScore: integer("gleif_match_score"), // Raw GLEIF API confidence
  weightedScore: integer("weighted_score"), // Our algorithm score
  rankPosition: integer("rank_position"), // 1=primary, 2=alternative, etc.
  
  // Selection Criteria Scoring
  domainTldScore: integer("domain_tld_score"),
  fortune500Score: integer("fortune500_score"),
  nameMatchScore: integer("name_match_score"),
  entityComplexityScore: integer("entity_complexity_score"),
  
  // Additional Context
  matchMethod: text("match_method"), // 'exact', 'fuzzy', 'geographic'
  selectionReason: text("selection_reason"),
  isPrimarySelection: boolean("is_primary_selection").default(false),
  
  // Full GLEIF Data (JSON)
  gleifFullData: text("gleif_full_data"), // JSON string of complete GLEIF response
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDomainSchema = createInsertSchema(domains).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  processingStartedAt: true,
  processingTimeMs: true,
});

export const insertBatchSchema = createInsertSchema(batches).omit({
  uploadedAt: true,
  completedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

// GLEIF Candidates Schema (V2)
export const insertGleifCandidateSchema = createInsertSchema(gleifCandidates).omit({
  id: true,
  createdAt: true,
});

export type Domain = typeof domains.$inferSelect;
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// GLEIF Candidates Types (V2)
export type GleifCandidate = typeof gleifCandidates.$inferSelect;
export type InsertGleifCandidate = z.infer<typeof insertGleifCandidateSchema>;

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
  
  // Level 2 GLEIF Enhancement Metrics (V2)
  level2AttemptedCount: z.number().optional().default(0),
  level2SuccessCount: z.number().optional().default(0),
  gleifVerifiedCount: z.number().optional().default(0),
  leiCodesFound: z.number().optional().default(0),
  averageLevel2Confidence: z.number().optional(),
  corporateEntitiesIdentified: z.number().optional().default(0),
  manualReviewRequired: z.number().optional().default(0),
  multipleCandidatesFound: z.number().optional().default(0),
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
  totalProcessingTimeMs: z.number(),
  totalProcessingTimeFormatted: z.string(),
});

export type ProcessingStats = z.infer<typeof processingStatsSchema>;
export type SessionResults = z.infer<typeof sessionResultsSchema>;
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;
