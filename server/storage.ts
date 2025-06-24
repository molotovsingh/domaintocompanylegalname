import { domains, batches, activities, type Domain, type InsertDomain, type Batch, type InsertBatch, type Activity, type InsertActivity, type ProcessingStats } from "@shared/schema";

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
}

export const storage = new MemStorage();
