import { pgTable, text, serial, integer, boolean, timestamp, real, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  domainHash: text("domain_hash").notNull(), // MD5 hash for persistent identification
  domain: text("domain").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, success, failed
  companyName: text("company_name"),
  extractionMethod: text("extraction_method"), // html_title, meta_description, domain_parse
  confidenceScore: real("confidence_score"),
  guessedCountry: text("guessed_country"), // Country detected from TLD and geographic intelligence
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

  // Level 1 Entity Category Prediction
  predictedEntityCategory: text('predicted_entity_category'),
  entityCategoryConfidence: integer('entity_category_confidence'),
  entityCategoryIndicators: text('entity_category_indicators'), // JSON array of indicators

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

// Master GLEIF Entity Intelligence Database
export const gleifEntities = pgTable("gleif_entities", {
  leiCode: text("lei_code").primaryKey(),
  legalName: text("legal_name").notNull(),
  entityStatus: text("entity_status"), // 'ACTIVE', 'INACTIVE', 'NULL'
  jurisdiction: text("jurisdiction"), // ISO country code
  legalForm: text("legal_form"), // Legal form code
  entityCategory: text("entity_category"),
  registrationStatus: text("registration_status"), // 'ISSUED', 'LAPSED', 'RETIRED'

  // Address Intelligence
  headquartersCountry: text("headquarters_country"),
  headquartersCity: text("headquarters_city"),
  headquartersRegion: text("headquarters_region"),
  headquartersPostalCode: text("headquarters_postal_code"),
  legalAddressCountry: text("legal_address_country"),
  legalAddressCity: text("legal_address_city"),
  legalAddressRegion: text("legal_address_region"),
  legalAddressPostalCode: text("legal_address_postal_code"),

  // Entity Intelligence
  otherNames: text("other_names").array(), // Alternative entity names
  registrationDate: text("registration_date"),
  lastGleifUpdate: text("last_gleif_update"),

  // Accumulation Intelligence
  firstDiscoveredDate: timestamp("first_discovered_date", { mode: 'string' }).defaultNow(),
  discoveryFrequency: integer("discovery_frequency").default(1), // How often we encounter this entity
  lastSeenDate: timestamp("last_seen_date", { mode: 'string' }).defaultNow(),

  // Full GLEIF Data Archive
  gleifFullData: text("gleif_full_data"), // JSON string of complete GLEIF response

  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

// Domain-Entity Relationship Mapping
export const domainEntityMappings = pgTable("domain_entity_mappings", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  leiCode: text("lei_code").notNull().references(() => gleifEntities.leiCode),

  // Mapping Intelligence
  mappingConfidence: integer("mapping_confidence"), // Our confidence in this mapping
  discoveryMethod: text("discovery_method"), // 'exact', 'fuzzy', 'geographic', 'corporate_family'
  firstMappedDate: timestamp("first_mapped_date", { mode: 'string' }).defaultNow(),
  lastConfirmedDate: timestamp("last_confirmed_date", { mode: 'string' }).defaultNow(),
  mappingFrequency: integer("mapping_frequency").default(1), // How often we see this mapping

  // Selection Context
  isPrimarySelection: boolean("is_primary_selection").default(false),
  selectionReason: text("selection_reason"),

  createdAt: timestamp("created_at").defaultNow(),
});

// Corporate Relationship Intelligence
export const entityRelationships = pgTable("entity_relationships", {
  id: serial("id").primaryKey(),
  parentLei: text("parent_lei").references(() => gleifEntities.leiCode),
  childLei: text("child_lei").references(() => gleifEntities.leiCode),

  // Relationship Intelligence
  relationshipType: text("relationship_type"), // 'subsidiary', 'branch', 'affiliate', 'parent'
  ownershipPercentage: text("ownership_percentage"),
  discoveredDate: timestamp("discovered_date", { mode: 'string' }).defaultNow(),
  relationshipConfidence: integer("relationship_confidence"),
  discoveryMethod: text("discovery_method"), // 'gleif_search', 'domain_analysis', 'manual'

  createdAt: timestamp("created_at").defaultNow(),
});

// Level 2 GLEIF Candidates Table (V2 Enhancement) - Updated for domain hash architecture
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
  gleifMatchScore: real("gleif_match_score"), // Raw GLEIF API confidence (decimal values)
  weightedScore: real("weighted_score"), // Our algorithm score (decimal values)
  rankPosition: integer("rank_position"), // 1=primary, 2=alternative, etc.

  // Selection Criteria Scoring
  domainTldScore: real("domain_tld_score"), // Decimal scoring
  fortune500Score: real("fortune500_score"), // Decimal scoring
  nameMatchScore: real("name_match_score"), // Decimal scoring
  entityComplexityScore: real("entity_complexity_score"), // Decimal scoring

  // Additional Context
  matchMethod: text("match_method"), // 'exact', 'fuzzy', 'geographic'
  selectionReason: text("selection_reason"),
  isPrimarySelection: boolean("is_primary_selection").default(false),

  // Full GLEIF Data (JSON)
  gleifFullData: text("gleif_full_data"), // JSON string of complete GLEIF response

  createdAt: timestamp("created_at").defaultNow(),
});

// Updated schema exports for domain hash architecture
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

// Enhanced GLEIF Knowledge Base Schemas
export const insertGleifEntitySchema = createInsertSchema(gleifEntities).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertDomainEntityMappingSchema = createInsertSchema(domainEntityMappings).omit({
  id: true,
  createdAt: true,
});

export const insertEntityRelationshipSchema = createInsertSchema(entityRelationships).omit({
  id: true,
  createdAt: true,
});

// GLEIF Candidates Schema (V2) - Backward compatibility
export const insertGleifCandidateSchema = createInsertSchema(gleifCandidates).omit({
  id: true,
  createdAt: true,
});

// Updated type exports for domain hash architecture
export type Domain = typeof domains.$inferSelect;
export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Batch = typeof batches.$inferSelect;
export type InsertBatch = z.infer<typeof insertBatchSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Enhanced GLEIF Knowledge Base Types
export type GleifEntity = typeof gleifEntities.$inferSelect;
export type InsertGleifEntity = z.infer<typeof insertGleifEntitySchema>;

export type DomainEntityMapping = typeof domainEntityMappings.$inferSelect;
export type InsertDomainEntityMapping = z.infer<typeof insertDomainEntityMappingSchema>;

export type EntityRelationship = typeof entityRelationships.$inferSelect;
export type InsertEntityRelationship = z.infer<typeof insertEntityRelationshipSchema>;

// GLEIF Candidates Types (V2) - Backward compatibility
export type GleifCandidate = typeof gleifCandidates.$inferSelect;
export type InsertGleifCandidate = z.infer<typeof insertGleifCandidateSchema>;

export const bottleneckAnalysisSchema = z.object({
  type: z.enum(['network_timeout', 'anti_bot_protection', 'high_concurrency', 'stuck_domains', 'low_success_rate', 'memory_pressure']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  impact: z.string(),
  recommendations: z.array(z.string()),
  metrics: z.record(z.union([z.string(), z.number()])),
});

export const processingStatsSchema = z.object({
  totalDomains: z.number(),
  processedDomains: z.number(),
  successRate: z.number(),
  processingRate: z.number(),
  eta: z.string(),
  elapsedTime: z.string().optional(),
  processingStartedAt: z.string().optional(),
  bottlenecks: z.array(bottleneckAnalysisSchema).optional(),
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

export type BottleneckAnalysis = z.infer<typeof bottleneckAnalysisSchema>;
export type ProcessingStats = z.infer<typeof processingStatsSchema>;
export type SessionResults = z.infer<typeof sessionResultsSchema>;
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;

// API Response Types for improved type safety
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface BatchResponse {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalDomains: number;
  processedDomains: number;
  successfulDomains: number;
  failedDomains: number;
  uploadedAt: string;
  completedAt?: string;
}

export interface StatsResponse {
  totalDomains: number;
  processedDomains: number;
  successRate: number;
  processingRate: number;
  eta: string;
  elapsedTime?: string;
  processingStartedAt?: string;
  bottlenecks?: BottleneckAnalysis[];
}

export interface DomainsResponse {
  domains: Domain[];
  total?: number;
  hasMore?: boolean;
}