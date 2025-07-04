
import { z } from "zod";

// Enhanced Export Record Schema - Comprehensive business intelligence export
export const enhancedExportRecordSchema = z.object({
  // Core Domain Information
  domainId: z.number(),
  domainHash: z.string(),
  domain: z.string(),
  batchId: z.string(),
  fileName: z.string(),
  
  // Processing Metadata
  status: z.string(),
  processingStartedAt: z.string().optional(),
  processedAt: z.string().optional(),
  processingTimeMs: z.number().optional(),
  retryCount: z.number().default(0),
  
  // Level 1 Extraction Results
  level1CompanyName: z.string().optional(),
  level1ExtractionMethod: z.string().optional(),
  level1Confidence: z.number().optional(),
  level1FailureCategory: z.string().optional(),
  level1ErrorMessage: z.string().optional(),
  level1TechnicalDetails: z.string().optional(),
  level1Recommendation: z.string().optional(),
  extractionAttempts: z.string().optional(), // JSON string
  
  // Geographic Intelligence
  guessedCountry: z.string().optional(),
  geographicMarkers: z.string().optional(), // JSON string
  
  // Level 2 GLEIF Enhancement
  level2Attempted: z.boolean().default(false),
  level2Status: z.string().optional(),
  level2CandidatesCount: z.number().optional(),
  level2ProcessingTimeMs: z.number().optional(),
  
  // Primary GLEIF Selection
  primaryLeiCode: z.string().optional(),
  primaryGleifName: z.string().optional(),
  primarySelectionConfidence: z.number().optional(),
  selectionAlgorithm: z.string().optional(),
  selectionNotes: z.string().optional(),
  manualReviewRequired: z.boolean().optional(),
  
  // Final Business Intelligence
  finalLegalName: z.string().optional(),
  finalConfidence: z.number().optional(),
  finalExtractionMethod: z.string().optional(),
  
  // Complete GLEIF Candidate Analysis
  allGleifCandidates: z.array(z.object({
    leiCode: z.string(),
    legalName: z.string(),
    entityStatus: z.string().optional(),
    jurisdiction: z.string().optional(),
    legalForm: z.string().optional(),
    entityCategory: z.string().optional(),
    registrationStatus: z.string().optional(),
    gleifMatchScore: z.number().optional(),
    weightedScore: z.number().optional(),
    rankPosition: z.number().optional(),
    matchMethod: z.string().optional(),
    selectionReason: z.string().optional(),
    isPrimarySelection: z.boolean().default(false),
    // Scoring breakdown
    domainTldScore: z.number().optional(),
    fortune500Score: z.number().optional(),
    nameMatchScore: z.number().optional(),
    entityComplexityScore: z.number().optional(),
  })).optional(),
  
  // Entity Knowledge Base Context
  entityFrequency: z.number().optional(), // How often we've seen this entity
  lastSeenDate: z.string().optional(),
  discoveredRelationships: z.array(z.object({
    parentLei: z.string(),
    childLei: z.string(),
    relationshipType: z.string(),
    ownershipPercentage: z.string().optional(),
    relationshipConfidence: z.number().optional(),
  })).optional(),
  
  // Domain-Entity Mapping Intelligence
  domainEntityMappings: z.array(z.object({
    leiCode: z.string(),
    mappingConfidence: z.number(),
    discoveryMethod: z.string(),
    firstMappedDate: z.string(),
    lastConfirmedDate: z.string(),
    mappingFrequency: z.number(),
    isPrimarySelection: z.boolean(),
  })).optional(),
  
  // Entity Category Prediction (AI Classification)
  predictedEntityCategory: z.string().optional(),
  entityCategoryConfidence: z.number().optional(),
  entityCategoryIndicators: z.array(z.string()).optional(),
  
  // Business Intelligence Classifications
  businessPriority: z.enum(['Fortune500', 'Enterprise', 'Mid-Market', 'SMB', 'Startup', 'Unknown']).optional(),
  acquisitionReadiness: z.enum(['Ready', 'Good-Target', 'Research-Required', 'Protected', 'Skip']).optional(),
  technicalAccessibility: z.enum(['Open', 'Protected', 'Cloudflare', 'Bot-Detection', 'Unreachable']).optional(),
  
  // Complete GLEIF Entity Data (for primary selection)
  gleifEntityData: z.object({
    legalName: z.string(),
    entityStatus: z.string().optional(),
    jurisdiction: z.string().optional(),
    legalForm: z.string().optional(),
    entityCategory: z.string().optional(),
    registrationStatus: z.string().optional(),
    headquartersCountry: z.string().optional(),
    headquartersCity: z.string().optional(),
    legalAddressCountry: z.string().optional(),
    legalAddressCity: z.string().optional(),
    otherNames: z.array(z.string()).optional(),
    registrationDate: z.string().optional(),
    lastGleifUpdate: z.string().optional(),
  }).optional(),
  
  // Export Metadata
  exportGeneratedAt: z.string(),
  exportVersion: z.string().default('1.0'),
  dataCompleteness: z.number(), // Percentage of fields populated
  qualityScore: z.number(), // Overall data quality assessment
  
  // Additional Context
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type EnhancedExportRecord = z.infer<typeof enhancedExportRecordSchema>;

// Export generation utilities
export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeGleifCandidates: boolean;
  includeRelationships: boolean;
  includeEntityMappings: boolean;
  qualityThreshold?: number;
  fields?: string[]; // Specific fields to include
}

export const defaultExportFields = [
  'domain',
  'finalLegalName',
  'primaryLeiCode',
  'finalConfidence',
  'level2Status',
  'businessPriority',
  'acquisitionReadiness',
  'jurisdiction',
  'entityStatus',
  'processingTimeMs',
  'dataCompleteness',
  'qualityScore'
];

export const comprehensiveExportFields = [
  ...defaultExportFields,
  'level1CompanyName',
  'level1ExtractionMethod',
  'level1Confidence',
  'level2CandidatesCount',
  'selectionAlgorithm',
  'predictedEntityCategory',
  'entityCategoryConfidence',
  'technicalAccessibility',
  'allGleifCandidates',
  'discoveredRelationships',
  'domainEntityMappings'
];
