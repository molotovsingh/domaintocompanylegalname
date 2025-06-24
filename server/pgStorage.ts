import { eq, desc, asc, ilike, and, sql, count } from 'drizzle-orm';
import { db } from './db';
import { domains, batches, activities } from '../shared/schema';
import type { 
  InsertDomain, Domain, InsertBatch, Batch, InsertActivity, Activity, 
  ProcessingStats, SessionResults 
} from '../shared/schema';
import type { IStorage } from './storage';

export class PostgreSQLStorage implements IStorage {
  // Domains
  async getDomain(id: number): Promise<Domain | undefined> {
    const result = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
    return result[0];
  }

  async getDomainsByBatch(batchId: string, limit = 50, offset = 0): Promise<Domain[]> {
    return await db.select()
      .from(domains)
      .where(eq(domains.batchId, batchId))
      .orderBy(desc(domains.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createDomain(insertDomain: InsertDomain): Promise<Domain> {
    const result = await db.insert(domains).values(insertDomain).returning();
    return result[0];
  }

  async updateDomain(id: number, updates: Partial<Domain>): Promise<Domain | undefined> {
    const result = await db.update(domains)
      .set(updates)
      .where(eq(domains.id, id))
      .returning();
    return result[0];
  }

  async getDomainsByStatus(status: string): Promise<Domain[]> {
    return await db.select().from(domains).where(eq(domains.status, status));
  }

  async searchDomains(query: string, limit = 50, offset = 0): Promise<Domain[]> {
    return await db.select()
      .from(domains)
      .where(ilike(domains.domain, `%${query}%`))
      .orderBy(desc(domains.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findExistingDomain(domain: string): Promise<Domain | undefined> {
    const result = await db.select()
      .from(domains)
      .where(eq(domains.domain, domain))
      .limit(1);
    return result[0];
  }

  async getHighConfidenceResult(domain: string): Promise<Domain | undefined> {
    const result = await db.select()
      .from(domains)
      .where(
        and(
          eq(domains.domain, domain),
          eq(domains.status, 'success'),
          sql`${domains.confidenceScore} >= 85`
        )
      )
      .orderBy(desc(domains.confidenceScore))
      .limit(1);
    return result[0];
  }

  // Batches
  async getBatch(id: string): Promise<Batch | undefined> {
    const result = await db.select().from(batches).where(eq(batches.id, id)).limit(1);
    return result[0];
  }

  async getBatches(limit = 10, offset = 0): Promise<Batch[]> {
    return await db.select()
      .from(batches)
      .orderBy(desc(batches.uploadedAt))
      .limit(limit)
      .offset(offset);
  }

  async createBatch(insertBatch: InsertBatch): Promise<Batch> {
    const result = await db.insert(batches).values(insertBatch).returning();
    return result[0];
  }

  async updateBatch(id: string, updates: Partial<Batch>): Promise<Batch | undefined> {
    const result = await db.update(batches)
      .set(updates)
      .where(eq(batches.id, id))
      .returning();
    return result[0];
  }

  // Activities
  async getActivities(limit = 20, offset = 0): Promise<Activity[]> {
    return await db.select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const result = await db.insert(activities).values(insertActivity).returning();
    return result[0];
  }

  // Stats
  async getProcessingStats(): Promise<ProcessingStats> {
    const totalDomainsResult = await db.select({ count: count() }).from(domains);
    const totalDomains = totalDomainsResult[0]?.count || 0;

    const processedDomainsResult = await db.select({ count: count() })
      .from(domains)
      .where(sql`${domains.status} IN ('success', 'failed')`);
    const processedDomains = processedDomainsResult[0]?.count || 0;

    const successfulDomainsResult = await db.select({ count: count() })
      .from(domains)
      .where(eq(domains.status, 'success'));
    const successfulDomains = successfulDomainsResult[0]?.count || 0;

    const successRate = processedDomains > 0 
      ? Math.round((successfulDomains / processedDomains) * 1000) / 10 
      : 0;

    // Calculate processing rate and ETA
    const processingRate = 2; // domains per second (estimate)
    const remaining = totalDomains - processedDomains;
    const etaSeconds = remaining > 0 ? Math.ceil(remaining / processingRate) : 0;
    const eta = etaSeconds > 0 ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : "Complete";

    return {
      totalDomains,
      processedDomains,
      successRate,
      processingRate,
      eta
    };
  }

  async getDomainCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(domains);
    return result[0]?.count || 0;
  }

  async getProcessedCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(domains)
      .where(sql`${domains.status} IN ('success', 'failed')`);
    return result[0]?.count || 0;
  }

  async getSuccessRate(): Promise<number> {
    const processed = await this.getProcessedCount();
    if (processed === 0) return 0;

    const successfulResult = await db.select({ count: count() })
      .from(domains)
      .where(eq(domains.status, 'success'));
    const successful = successfulResult[0]?.count || 0;

    return Math.round((successful / processed) * 1000) / 10;
  }

  // Session Results
  async getSessionResults(batchId: string): Promise<SessionResults | undefined> {
    const batch = await this.getBatch(batchId);
    if (!batch) return undefined;

    const batchDomains = await this.getDomainsByBatch(batchId, 1000);
    const successful = batchDomains.filter(d => d.status === 'success');
    const failed = batchDomains.filter(d => d.status === 'failed');

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
    const allBatches = await this.getBatches(limit, offset);
    const results: SessionResults[] = [];

    for (const batch of allBatches) {
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

export const storage = new PostgreSQLStorage();