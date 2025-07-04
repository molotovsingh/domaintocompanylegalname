import { domains, batches, activities, gleifCandidates, type Domain, type InsertDomain, type Batch, type InsertBatch, type Activity, type InsertActivity, type GleifCandidate, type InsertGleifCandidate, type GleifEntity, type InsertGleifEntity, type DomainEntityMapping, type InsertDomainEntityMapping, type EntityRelationship, type InsertEntityRelationship, type ProcessingStats, type SessionResults, type AnalyticsData } from "@shared/schema";

export interface IStorage {
  // Domains
  getDomain(id: number): Promise<Domain | undefined>;
  getDomainsByBatch(batchId: string, limit?: number, offset?: number): Promise<Domain[]>;
  getDomainsByBatchWithStatus?(batchId: string, status?: string, limit?: number, offset?: number): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: number, updates: Partial<Domain>): Promise<Domain | undefined>;
  getDomainsByStatus(status: string): Promise<Domain[]>;
  searchDomains(query: string, limit?: number, offset?: number): Promise<Domain[]>;
  findExistingDomain(domain: string): Promise<Domain | undefined>;
  getHighConfidenceResult(domain: string): Promise<Domain | undefined>;

  // Batches
  getBatch(id: string): Promise<Batch | undefined>;
  getBatches(limit?: number, offset?: number): Promise<Batch[]>;
  getRecentBatches?(limit?: number, offset?: number): Promise<Batch[]>;
  createBatch(batch: InsertBatch): Promise<Batch>;
  updateBatch(id: string, updates: Partial<Batch>): Promise<Batch | undefined>;

  // Activities
  getActivities(limit?: number, offset?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // Stats
  getProcessingStats(): Promise<ProcessingStats>;
  getDomainCount(): Promise<number>;
  getProcessedCount(): Promise<number>;
  getSuccessRate(): Promise<number>;

  // Session Results
  getSessionResults(batchId: string): Promise<SessionResults | undefined>;
  getAllSessionResults(limit?: number, offset?: number): Promise<SessionResults[]>;

  // Analytics
  getAnalyticsData(limit?: number, offset?: number): Promise<AnalyticsData[]>;

  // Database Management
  clearDatabase?(): Promise<void>;

  // Level 2 GLEIF Operations (V2 - Backward Compatible)
  createGleifCandidates?(domainId: number, candidates: InsertGleifCandidate[]): Promise<GleifCandidate[]>;
  getGleifCandidates?(domainId: number): Promise<GleifCandidate[]>;
  updatePrimarySelection?(domainId: number, leiCode: string): Promise<Domain | undefined>;
  getManualReviewQueue?(limit?: number, offset?: number): Promise<Domain[]>;
  getLevel2EligibleDomains?(limit?: number, offset?: number): Promise<Domain[]>;
  clearGleifCandidatesForBatch?(batchId: string): Promise<void>;

  // Enhanced GLEIF Knowledge Base Operations (V3 - Entity Intelligence)
  createGleifEntity?(entity: InsertGleifEntity): Promise<GleifEntity>;
  getGleifEntity?(leiCode: string): Promise<GleifEntity | undefined>;
  updateGleifEntity?(leiCode: string, updates: Partial<GleifEntity>): Promise<GleifEntity | undefined>;

  createDomainEntityMapping?(mapping: InsertDomainEntityMapping): Promise<DomainEntityMapping>;
  getDomainEntityMapping?(domain: string, leiCode: string): Promise<DomainEntityMapping | undefined>;
  getDomainEntityMappings?(domain: string): Promise<DomainEntityMapping[]>;
  getEntityDomainMappings?(leiCode: string): Promise<DomainEntityMapping[]>;
  updateDomainEntityMapping?(id: number, updates: Partial<DomainEntityMapping>): Promise<DomainEntityMapping | undefined>;

  createEntityRelationship?(relationship: InsertEntityRelationship): Promise<EntityRelationship>;
  getEntityRelationships?(leiCode: string): Promise<EntityRelationship[]>;

  // Raw query method for Knowledge Graph functionality
  query?(sqlQuery: string, params?: any[]): Promise<{ rows: any[] }>;
}

export class MemStorage implements IStorage {
  private domains: Map<number, Domain>;
  private batches: Map<string, Batch>;
  private activities: Map<number, Activity>;
  private currentDomainId: number;
  private currentActivityId: number;

  constructor() {
    this.domains = new Map();
    this.batches = new Map();
    this.activities = new Map();
    this.currentDomainId = 1;
    this.currentActivityId = 1;
  }

  async getDomain(id: number): Promise<Domain | undefined> {
    return this.domains.get(id);
  }

  async getDomainsByBatch(batchId: string, limit = 50, offset = 0): Promise<Domain[]> {
    let allDomains = Array.from(this.domains.values())
      .filter(domain => domain.batchId === batchId);

    allDomains = allDomains.sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));

    return allDomains.slice(offset, offset + limit);
  }

  async getDomainsByBatchWithStatus(batchId: string, status?: string, limit = 50, offset = 0): Promise<Domain[]> {
    let allDomains = Array.from(this.domains.values())
      .filter(domain => domain.batchId === batchId);

    if (status) {
      allDomains = allDomains.filter(domain => domain.status === status);
    }

    allDomains = allDomains.sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));

    return allDomains.slice(offset, offset + limit);
  }

  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    const id = this.currentDomainId++;
    const domain: Domain = {
      ...insertDomain,
      id,
      status: insertDomain.status || "pending",
      companyName: insertDomain.companyName || null,
      extractionMethod: insertDomain.extractionMethod || null,
      confidenceScore: insertDomain.confidenceScore || null,
      guessedCountry: insertDomain.guessedCountry || null,
      retryCount: insertDomain.retryCount || 0,
      errorMessage: insertDomain.errorMessage || null,
      failureCategory: insertDomain.failureCategory || null,
      technicalDetails: insertDomain.technicalDetails || null,
      extractionAttempts: insertDomain.extractionAttempts || null,
      recommendation: insertDomain.recommendation || null,
      predictedEntityCategory: insertDomain.predictedEntityCategory || null,
      entityCategoryConfidence: insertDomain.entityCategoryConfidence || null,
      entityCategoryIndicators: insertDomain.entityCategoryIndicators || null,
      level2Attempted: insertDomain.level2Attempted || false,
      level2Status: insertDomain.level2Status || null,
      level2CandidatesCount: insertDomain.level2CandidatesCount || 0,
      level2ProcessingTimeMs: insertDomain.level2ProcessingTimeMs || null,
      primaryLeiCode: insertDomain.primaryLeiCode || null,
      primaryGleifName: insertDomain.primaryGleifName || null,
      primarySelectionConfidence: insertDomain.primarySelectionConfidence || null,
      selectionAlgorithm: insertDomain.selectionAlgorithm || null,
      finalLegalName: insertDomain.finalLegalName || null,
      finalConfidence: insertDomain.finalConfidence || null,
      finalExtractionMethod: insertDomain.finalExtractionMethod || null,
      manualReviewRequired: insertDomain.manualReviewRequired || false,
      selectionNotes: insertDomain.selectionNotes || null,
      createdAt: new Date(),
      processedAt: null,
      processingStartedAt: null,
      processingTimeMs: null,
    };
    this.domains.set(id, domain);
    return domain;
  }

  async updateDomain(id: number, updates: Partial<Domain>): Promise<Domain | undefined> {
    const domain = this.domains.get(id);
    if (!domain) return undefined;

    const updatedDomain = { ...domain, ...updates };
    if (updates.status && updates.status !== "pending" && !domain.processedAt) {
      updatedDomain.processedAt = new Date();
    }

    this.domains.set(id, updatedDomain);
    return updatedDomain;
  }

  async getDomainsByStatus(status: string): Promise<Domain[]> {
    return Array.from(this.domains.values()).filter(domain => domain.status === status);
  }

  async searchDomains(query: string, limit = 50, offset = 0): Promise<Domain[]> {
    const lowerQuery = query.toLowerCase();
    const filtered = Array.from(this.domains.values())
      .filter(domain => 
        domain.domain.toLowerCase().includes(lowerQuery) || 
        domain.companyName?.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));

    return filtered.slice(offset, offset + limit);
  }

  async getBatch(id: string): Promise<Batch | undefined> {
    return this.batches.get(id);
  }

  async getBatches(limit = 10, offset = 0): Promise<Batch[]> {
    const allBatches = Array.from(this.batches.values())
      .sort((a, b) => {
        const dateA = a.uploadedAt?.getTime() || 0;
        const dateB = b.uploadedAt?.getTime() || 0;
        return dateB - dateA;
      });

    return allBatches.slice(offset, offset + limit);
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const batch: Batch = {
      ...insertBatch,
      status: insertBatch.status || "pending",
      processedDomains: insertBatch.processedDomains || 0,
      successfulDomains: insertBatch.successfulDomains || 0,
      failedDomains: insertBatch.failedDomains || 0,
      uploadedAt: new Date(),
      completedAt: null,
    };
    this.batches.set(batch.id, batch);
    return batch;
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch | undefined> {
    const batch = this.batches.get(id);
    if (!batch) return undefined;

    const updatedBatch = { ...batch, ...updates };
    if (updates.status === "completed" && !batch.completedAt) {
      updatedBatch.completedAt = new Date();
    }

    this.batches.set(id, updatedBatch);
    return updatedBatch;
  }

  async getActivities(limit = 20, offset = 0): Promise<Activity[]> {
    const allActivities = Array.from(this.activities.values())
      .sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA;
      });

    return allActivities.slice(offset, offset + limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.currentActivityId++;
    const activity: Activity = {
      ...insertActivity,
      id,
      details: insertActivity.details || null,
      createdAt: new Date(),
    };
    this.activities.set(id, activity);
    return activity;
  }

  async getProcessingStats(): Promise<ProcessingStats> {
    const totalDomains = this.domains.size;
    const processedDomains = Array.from(this.domains.values())
      .filter(domain => domain.status !== "pending").length;
    const successfulDomains = Array.from(this.domains.values())
      .filter(domain => domain.status === "success").length;

    const successRate = processedDomains > 0 ? (successfulDomains / processedDomains) * 100 : 0;

    // Calculate processing rate (domains per minute) - simplified calculation
    const processingRate = 2340; // Mock rate for now
    const remainingDomains = totalDomains - processedDomains;
    const etaMinutes = Math.ceil(remainingDomains / processingRate);
    const eta = `${etaMinutes} min`;

    return {
      totalDomains,
      processedDomains,
      successRate: Math.round(successRate * 10) / 10,
      processingRate,
      eta,
    };
  }

  async getDomainCount(): Promise<number> {
    return this.domains.size;
  }

  async getProcessedCount(): Promise<number> {
    return Array.from(this.domains.values())
      .filter(domain => domain.status !== "pending").length;
  }

  async getSuccessRate(): Promise<number> {
    const processed = await this.getProcessedCount();
    if (processed === 0) return 0;

    const successful = Array.from(this.domains.values())
      .filter(domain => domain.status === "success").length;

    return Math.round((successful / processed) * 1000) / 10;
  }

  async findExistingDomain(domain: string): Promise<Domain | undefined> {
    return Array.from(this.domains.values())
      .find(d => d.domain.toLowerCase() === domain.toLowerCase());
  }

  async getHighConfidenceResult(domain: string): Promise<Domain | undefined> {
    const existing = Array.from(this.domains.values())
      .filter(d => d.domain.toLowerCase() === domain.toLowerCase() && 
                   d.status === 'success' && 
                   d.confidenceScore && d.confidenceScore >= 85)
      .sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));

    return existing[0];
  }

  async getSessionResults(batchId: string): Promise<SessionResults | undefined> {
    const batch = await this.getBatch(batchId);
    if (!batch) return undefined;

    const domains = await this.getDomainsByBatch(batchId, 1000);
    const successful = domains.filter(d => d.status === 'success');
    const failed = domains.filter(d => d.status === 'failed');

    const extractionMethods: Record<string, number> = {};
    const failureReasons: Record<string, number> = {};
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Quality metrics
    let highConfidenceCount = 0;
    let mediumConfidenceCount = 0;
    let lowConfidenceCount = 0;
    let domainParseCount = 0;
    let htmlExtractionCount = 0;

    successful.forEach(domain => {
      const method = domain.extractionMethod || 'unknown';
      extractionMethods[method] = (extractionMethods[method] || 0) + 1;

      if (domain.confidenceScore) {
        totalConfidence += domain.confidenceScore;
        confidenceCount++;

        if (domain.confidenceScore >= 90) highConfidenceCount++;
        else if (domain.confidenceScore >= 70) mediumConfidenceCount++;
        else lowConfidenceCount++;
      }

      if (method.includes('domain_parse')) domainParseCount++;
      else if (method.includes('html')) htmlExtractionCount++;
    });

    failed.forEach(domain => {
      const reason = domain.errorMessage || 'Unknown error';
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    });

    const processingTime = batch.completedAt && batch.uploadedAt 
      ? new Date(batch.completedAt).getTime() - new Date(batch.uploadedAt).getTime()
      : 0;

    return {
      batchId: batch.id,
      fileName: batch.fileName,
      totalDomains: batch.totalDomains,
      successfulDomains: successful.length,
      failedDomains: failed.length,
      successRate: Math.round((successful.length / batch.totalDomains) * 100),
      averageConfidence: confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) : 0,
      extractionMethods,
      processingTime,
      completedAt: batch.completedAt ? batch.completedAt.toISOString() : new Date().toISOString(),
      qualityMetrics: {
        highConfidenceCount,
        mediumConfidenceCount,
        lowConfidenceCount,
        domainParseCount,
        htmlExtractionCount,
      },
      failureReasons,
      manualReviewRequired: domains.filter(d => d.manualReviewRequired).length,
      level2AttemptedCount: domains.filter(d => d.level2Attempted).length,
      level2SuccessCount: domains.filter(d => d.level2Status === 'success').length,
      gleifVerifiedCount: domains.filter(d => d.primaryLeiCode).length
    };
  }

  async getAllSessionResults(limit = 10, offset = 0): Promise<SessionResults[]> {
    const batches = await this.getBatches(limit, offset);
    const results: SessionResults[] = [];

    for (const batch of batches) {
      if (batch.status === 'completed') {
        const sessionResult = await this.getSessionResults(batch.id);
        if (sessionResult) {
          results.push(sessionResult);
        }
      }
    }

    return results;
  }

  async getAnalyticsData(limit = 50, offset = 0): Promise<AnalyticsData[]> {
    const batches = await this.getBatches(limit, offset);
    const analyticsData: AnalyticsData[] = [];

    for (const batch of batches) {
      const batchDomains = await this.getDomainsByBatch(batch.id);
      const successful = batchDomains.filter(d => d.status === 'success');
      const totalProcessingTime = batchDomains.reduce((sum, d) => sum + (d.processingTimeMs || 0), 0);
      const confidences = successful.map(d => d.confidenceScore || 0).filter(c => c > 0);
      
      analyticsData.push({
        batchId: batch.id,
        fileName: batch.fileName,
        completedAt: batch.completedAt ? batch.completedAt.toISOString() : new Date().toISOString(),
        totalDomains: batch.totalDomains,
        successRate: Math.round((successful.length / batch.totalDomains) * 100),
        averageConfidence: confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
        medianConfidence: confidences.length ? confidences.sort((a, b) => a - b)[Math.floor(confidences.length / 2)] : 0,
        domainMappingPercentage: Math.round((successful.filter(d => d.extractionMethod === 'domain_mapping').length / batch.totalDomains) * 100),
        avgProcessingTimePerDomain: Math.round(totalProcessingTime / batch.totalDomains),
        highConfidencePercentage: Math.round((successful.filter(d => (d.confidenceScore || 0) >= 85).length / batch.totalDomains) * 100),
        totalProcessingTimeMs: totalProcessingTime,
        totalProcessingTimeFormatted: `${Math.round(totalProcessingTime / 1000)}s`
      });
    }

    return analyticsData;
  }
}

// Import PostgreSQL storage instead of in-memory
export { storage } from './pgStorage';