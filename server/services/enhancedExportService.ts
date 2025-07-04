
import { storage } from '../pgStorage';
import type { EnhancedExportRecord, ExportOptions } from '../../shared/enhanced-export-schema';
import { defaultExportFields, comprehensiveExportFields } from '../../shared/enhanced-export-schema';
import * as XLSX from 'xlsx';

export class EnhancedExportService {
  
  async generateEnhancedExport(batchId: string, options: ExportOptions): Promise<EnhancedExportRecord[]> {
    console.log(`Generating enhanced export for batch ${batchId} with options:`, options);
    
    // Get all domains for the batch
    const domains = await storage.getDomainsByBatch(batchId, undefined, 100000);
    const batch = await storage.getBatch(batchId);
    
    const enhancedRecords: EnhancedExportRecord[] = [];
    
    for (const domain of domains) {
      try {
        const enhancedRecord = await this.buildEnhancedRecord(domain, batch?.fileName || 'Unknown', options);
        
        // Apply quality threshold filter if specified
        if (options.qualityThreshold && enhancedRecord.qualityScore < options.qualityThreshold) {
          continue;
        }
        
        enhancedRecords.push(enhancedRecord);
      } catch (error) {
        console.error(`Error building enhanced record for domain ${domain.id}:`, error);
        // Continue processing other domains
      }
    }
    
    console.log(`Generated ${enhancedRecords.length} enhanced export records`);
    return enhancedRecords;
  }
  
  private async buildEnhancedRecord(domain: any, fileName: string, options: ExportOptions): Promise<EnhancedExportRecord> {
    // Get GLEIF candidates if available
    let gleifCandidates: any[] = [];
    if (options.includeGleifCandidates && typeof storage.getGleifCandidates === 'function') {
      try {
        gleifCandidates = await storage.getGleifCandidates(domain.id);
      } catch (error) {
        console.warn(`Could not get GLEIF candidates for domain ${domain.id}`);
      }
    }
    
    // Get entity relationships if available
    let relationships: any[] = [];
    if (options.includeRelationships && domain.primaryLeiCode && typeof storage.getEntityRelationships === 'function') {
      try {
        relationships = await storage.getEntityRelationships(domain.primaryLeiCode);
      } catch (error) {
        console.warn(`Could not get relationships for LEI ${domain.primaryLeiCode}`);
      }
    }
    
    // Get domain-entity mappings if available
    let domainMappings: any[] = [];
    if (options.includeEntityMappings && typeof storage.getDomainEntityMappings === 'function') {
      try {
        domainMappings = await storage.getDomainEntityMappings(domain.domain);
      } catch (error) {
        console.warn(`Could not get domain mappings for ${domain.domain}`);
      }
    }
    
    // Get primary entity data if available
    let gleifEntityData: any = undefined;
    if (domain.primaryLeiCode && typeof storage.getGleifEntity === 'function') {
      try {
        gleifEntityData = await storage.getGleifEntity(domain.primaryLeiCode);
      } catch (error) {
        console.warn(`Could not get GLEIF entity data for LEI ${domain.primaryLeiCode}`);
      }
    }
    
    // Calculate data completeness and quality score
    const completeness = this.calculateDataCompleteness(domain, gleifCandidates, relationships);
    const qualityScore = this.calculateQualityScore(domain, gleifCandidates, completeness);
    
    // Determine business classifications
    const businessPriority = this.classifyBusinessPriority(domain, gleifEntityData);
    const acquisitionReadiness = this.classifyAcquisitionReadiness(domain);
    const technicalAccessibility = this.classifyTechnicalAccessibility(domain);
    
    const enhancedRecord: EnhancedExportRecord = {
      // Core Information
      domainId: domain.id,
      domainHash: domain.domainHash,
      domain: domain.domain,
      batchId: domain.batchId,
      fileName,
      
      // Processing Metadata
      status: domain.status,
      processingStartedAt: domain.processingStartedAt?.toISOString(),
      processedAt: domain.processedAt?.toISOString(),
      processingTimeMs: domain.processingTimeMs,
      retryCount: domain.retryCount || 0,
      
      // Level 1 Results
      level1CompanyName: domain.companyName,
      level1ExtractionMethod: domain.extractionMethod,
      level1Confidence: domain.confidenceScore,
      level1FailureCategory: domain.failureCategory,
      level1ErrorMessage: domain.errorMessage,
      level1TechnicalDetails: domain.technicalDetails,
      level1Recommendation: domain.recommendation,
      extractionAttempts: domain.extractionAttempts,
      
      // Geographic Intelligence
      guessedCountry: domain.guessedCountry,
      geographicMarkers: domain.geographicMarkers,
      
      // Level 2 GLEIF Enhancement
      level2Attempted: domain.level2Attempted || false,
      level2Status: domain.level2Status,
      level2CandidatesCount: domain.level2CandidatesCount,
      level2ProcessingTimeMs: domain.level2ProcessingTimeMs,
      
      // Primary GLEIF Selection
      primaryLeiCode: domain.primaryLeiCode,
      primaryGleifName: domain.primaryGleifName,
      primarySelectionConfidence: domain.primarySelectionConfidence,
      selectionAlgorithm: domain.selectionAlgorithm,
      selectionNotes: domain.selectionNotes,
      manualReviewRequired: domain.manualReviewRequired,
      
      // Final Results
      finalLegalName: domain.finalLegalName,
      finalConfidence: domain.finalConfidence,
      finalExtractionMethod: domain.finalExtractionMethod,
      
      // Enhanced Data
      allGleifCandidates: gleifCandidates.map(candidate => ({
        leiCode: candidate.leiCode,
        legalName: candidate.legalName,
        entityStatus: candidate.entityStatus,
        jurisdiction: candidate.jurisdiction,
        legalForm: candidate.legalForm,
        entityCategory: candidate.entityCategory,
        registrationStatus: candidate.registrationStatus,
        gleifMatchScore: candidate.gleifMatchScore,
        weightedScore: candidate.weightedScore,
        rankPosition: candidate.rankPosition,
        matchMethod: candidate.matchMethod,
        selectionReason: candidate.selectionReason,
        isPrimarySelection: candidate.isPrimarySelection,
        domainTldScore: candidate.domainTldScore,
        fortune500Score: candidate.fortune500Score,
        nameMatchScore: candidate.nameMatchScore,
        entityComplexityScore: candidate.entityComplexityScore,
      })),
      
      // Entity Context
      entityFrequency: gleifEntityData?.discoveryFrequency,
      lastSeenDate: gleifEntityData?.lastSeenDate,
      discoveredRelationships: relationships.map(rel => ({
        parentLei: rel.parentLei,
        childLei: rel.childLei,
        relationshipType: rel.relationshipType,
        ownershipPercentage: rel.ownershipPercentage,
        relationshipConfidence: rel.relationshipConfidence,
      })),
      
      // Domain-Entity Mappings
      domainEntityMappings: domainMappings.map(mapping => ({
        leiCode: mapping.leiCode,
        mappingConfidence: mapping.mappingConfidence,
        discoveryMethod: mapping.discoveryMethod,
        firstMappedDate: mapping.firstMappedDate,
        lastConfirmedDate: mapping.lastConfirmedDate,
        mappingFrequency: mapping.mappingFrequency,
        isPrimarySelection: mapping.isPrimarySelection,
      })),
      
      // AI Classifications
      predictedEntityCategory: domain.predictedEntityCategory,
      entityCategoryConfidence: domain.entityCategoryConfidence,
      entityCategoryIndicators: domain.entityCategoryIndicators ? JSON.parse(domain.entityCategoryIndicators) : undefined,
      
      // Business Intelligence
      businessPriority,
      acquisitionReadiness,
      technicalAccessibility,
      
      // Complete GLEIF Entity Data
      gleifEntityData: gleifEntityData ? {
        legalName: gleifEntityData.legalName,
        entityStatus: gleifEntityData.entityStatus,
        jurisdiction: gleifEntityData.jurisdiction,
        legalForm: gleifEntityData.legalForm,
        entityCategory: gleifEntityData.entityCategory,
        registrationStatus: gleifEntityData.registrationStatus,
        headquartersCountry: gleifEntityData.headquartersCountry,
        headquartersCity: gleifEntityData.headquartersCity,
        legalAddressCountry: gleifEntityData.legalAddressCountry,
        legalAddressCity: gleifEntityData.legalAddressCity,
        otherNames: gleifEntityData.otherNames,
        registrationDate: gleifEntityData.registrationDate,
        lastGleifUpdate: gleifEntityData.lastGleifUpdate,
      } : undefined,
      
      // Export Metadata
      exportGeneratedAt: new Date().toISOString(),
      exportVersion: '1.0',
      dataCompleteness: completeness,
      qualityScore,
    };
    
    return enhancedRecord;
  }
  
  private calculateDataCompleteness(domain: any, gleifCandidates: any[], relationships: any[]): number {
    let totalFields = 20; // Core fields that should be populated
    let populatedFields = 0;
    
    // Core domain data
    if (domain.domain) populatedFields++;
    if (domain.status) populatedFields++;
    if (domain.companyName) populatedFields++;
    if (domain.extractionMethod) populatedFields++;
    if (domain.confidenceScore !== null && domain.confidenceScore !== undefined) populatedFields++;
    
    // Processing metadata
    if (domain.processedAt) populatedFields++;
    if (domain.processingTimeMs) populatedFields++;
    
    // Level 2 enhancement
    if (domain.level2Attempted) populatedFields++;
    if (domain.level2Status) populatedFields++;
    if (domain.primaryLeiCode) populatedFields++;
    if (domain.primaryGleifName) populatedFields++;
    
    // Geographic intelligence
    if (domain.guessedCountry) populatedFields++;
    
    // Enhanced intelligence
    if (domain.finalLegalName) populatedFields++;
    if (domain.finalConfidence !== null && domain.finalConfidence !== undefined) populatedFields++;
    if (domain.predictedEntityCategory) populatedFields++;
    
    // Additional data availability
    if (gleifCandidates.length > 0) populatedFields += 3;
    if (relationships.length > 0) populatedFields += 2;
    
    return Math.round((populatedFields / totalFields) * 100);
  }
  
  private calculateQualityScore(domain: any, gleifCandidates: any[], completeness: number): number {
    let score = 0;
    
    // Base confidence score (40% weight)
    const confidence = domain.finalConfidence || domain.confidenceScore || 0;
    score += (confidence / 100) * 40;
    
    // GLEIF verification (30% weight)
    if (domain.primaryLeiCode && domain.primaryGleifName) {
      score += 30;
    } else if (gleifCandidates.length > 0) {
      score += 15;
    }
    
    // Data completeness (20% weight)
    score += (completeness / 100) * 20;
    
    // Processing success (10% weight)
    if (domain.status === 'success') {
      score += 10;
    } else if (domain.status === 'failed' && domain.companyName) {
      score += 5;
    }
    
    return Math.round(score);
  }
  
  private classifyBusinessPriority(domain: any, gleifEntity: any): string {
    // Fortune 500 indicators
    if (domain.extractionMethod?.includes('domain_mapping') && domain.confidenceScore >= 95) {
      return 'Fortune500';
    }
    
    // Enterprise indicators
    if (gleifEntity?.entityCategory === 'Corporation' && 
        (gleifEntity.jurisdiction === 'US' || gleifEntity.jurisdiction === 'GB' || gleifEntity.jurisdiction === 'DE')) {
      return 'Enterprise';
    }
    
    // High confidence with GLEIF verification
    if (domain.primaryLeiCode && (domain.finalConfidence || domain.confidenceScore) >= 85) {
      return 'Enterprise';
    }
    
    // Medium confidence
    if ((domain.finalConfidence || domain.confidenceScore) >= 70) {
      return 'Mid-Market';
    }
    
    // Lower confidence but valid company name
    if (domain.companyName && (domain.finalConfidence || domain.confidenceScore) >= 50) {
      return 'SMB';
    }
    
    return 'Unknown';
  }
  
  private classifyAcquisitionReadiness(domain: any): string {
    if (domain.failureCategory === 'Protected - Manual Review') {
      return 'Protected';
    }
    
    if (domain.status === 'failed') {
      return 'Skip';
    }
    
    if (domain.primaryLeiCode && (domain.finalConfidence || domain.confidenceScore) >= 85) {
      return 'Ready';
    }
    
    if ((domain.finalConfidence || domain.confidenceScore) >= 70) {
      return 'Good-Target';
    }
    
    return 'Research-Required';
  }
  
  private classifyTechnicalAccessibility(domain: any): string {
    if (domain.failureCategory?.includes('cloudflare') || domain.failureCategory?.includes('protected')) {
      return 'Cloudflare';
    }
    
    if (domain.failureCategory?.includes('bot') || domain.technicalDetails?.includes('bot')) {
      return 'Bot-Detection';
    }
    
    if (domain.connectivity === 'unreachable' || domain.failureCategory?.includes('unreachable')) {
      return 'Unreachable';
    }
    
    if (domain.failureCategory?.includes('Protected')) {
      return 'Protected';
    }
    
    return 'Open';
  }
  
  // Format export data based on requested format
  formatExport(records: EnhancedExportRecord[], format: 'csv' | 'json' | 'xlsx', fields?: string[]) {
    const fieldsToInclude = fields || defaultExportFields;
    
    switch (format) {
      case 'json':
        return JSON.stringify(records, null, 2);
        
      case 'csv':
        return this.convertToCSV(records, fieldsToInclude);
        
      case 'xlsx':
        return this.convertToXLSX(records, fieldsToInclude);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  private convertToCSV(records: EnhancedExportRecord[], fields: string[]): string {
    if (records.length === 0) return '';
    
    const headers = fields.join(',');
    const rows = records.map(record => {
      return fields.map(field => {
        const value = this.getNestedValue(record, field);
        return this.escapeCSVValue(value);
      }).join(',');
    });
    
    return [headers, ...rows].join('\n');
  }
  
  private convertToXLSX(records: EnhancedExportRecord[], fields: string[]): Buffer {
    const worksheetData = records.map(record => {
      const row: any = {};
      fields.forEach(field => {
        row[field] = this.getNestedValue(record, field);
      });
      return row;
    });
    
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Enhanced Export');
    
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }
}

export const enhancedExportService = new EnhancedExportService();
