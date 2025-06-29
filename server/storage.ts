import { domains, batches, activities, gleifCandidates, type Domain, type InsertDomain, type Batch, type InsertBatch, type Activity, type InsertActivity, type GleifCandidate, type InsertGleifCandidate, type ProcessingStats, type SessionResults, type AnalyticsData } from "@shared/schema";

export interface IStorage {
  // Domains
  getDomain(id: number): Promise<Domain | undefined>;
  getDomainsByBatch(batchId: string, limit?: number, offset?: number): Promise<Domain[]>;
  createDomain(domain: InsertDomain): Promise<Domain>;
  updateDomain(id: number, updates: Partial<Domain>): Promise<Domain | undefined>;
  getDomainsByStatus(status: string): Promise<Domain[]>;
  searchDomains(query: string, limit?: number, offset?: number): Promise<Domain[]>;
  findExistingDomain(domain: string): Promise<Domain | undefined>;
  getHighConfidenceResult(domain: string): Promise<Domain | undefined>;
  
  // Batches
  getBatch(id: string): Promise<Batch | undefined>;
  getBatches(limit?: number, offset?: number): Promise<Batch[]>;
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
    const allDomains = Array.from(this.domains.values())
      .filter(domain => domain.batchId === batchId)
      .sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));
    
    return allDomains.slice(offset, offset + limit);
  }

  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    const id = this.currentDomainId++;
    const domain: Domain = {
      ...insertDomain,
      id,
      createdAt: new Date(),
      processedAt: null,
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
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    return allBatches.slice(offset, offset + limit);
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const batch: Batch = {
      ...insertBatch,
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
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return allActivities.slice(offset, offset + limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.currentActivityId++;
    const activity: Activity = {
      ...insertActivity,
      id,
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
      completedAt: batch.completedAt || new Date().toISOString(),
      qualityMetrics: {
        highConfidenceCount,
        mediumConfidenceCount,
        lowConfidenceCount,
        domainParseCount,
        htmlExtractionCount,
      },
      failureReasons,
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
}

// Import PostgreSQL storage instead of in-memory
export { storage } from './pgStorage';
