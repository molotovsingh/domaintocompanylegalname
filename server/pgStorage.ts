import { eq, desc, asc, ilike, and, sql, count } from 'drizzle-orm';
import { db } from './db';
import { domains, batches, activities, gleifCandidates, gleifEntities, domainEntityMappings, entityRelationships } from '../shared/schema';
import type { 
  InsertDomain, Domain, InsertBatch, Batch, InsertActivity, Activity, 
  ProcessingStats, SessionResults, AnalyticsData, GleifCandidate, InsertGleifCandidate,
  GleifEntity, InsertGleifEntity, DomainEntityMapping, InsertDomainEntityMapping,
  EntityRelationship, InsertEntityRelationship
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
    // Get the most recent active or processing batch
    const activeBatchResult = await db.select()
      .from(batches)
      .where(sql`${batches.status} IN ('processing', 'active')`)
      .orderBy(desc(batches.createdAt))
      .limit(1);

    let batchId = null;
    if (activeBatchResult.length > 0) {
      batchId = activeBatchResult[0].id;
    } else {
      // If no active batch, get the most recent batch
      const recentBatchResult = await db.select()
        .from(batches)
        .orderBy(desc(batches.createdAt))
        .limit(1);
      if (recentBatchResult.length > 0) {
        batchId = recentBatchResult[0].id;
      }
    }

    let totalDomains = 0;
    let processedDomains = 0;
    let successfulDomains = 0;

    if (batchId) {
      // Get stats for the specific batch
      const totalDomainsResult = await db.select({ count: count() })
        .from(domains)
        .where(eq(domains.batchId, batchId));
      totalDomains = totalDomainsResult[0]?.count || 0;

      const processedDomainsResult = await db.select({ count: count() })
        .from(domains)
        .where(sql`${domains.batchId} = ${batchId} AND ${domains.status} IN ('success', 'failed')`);
      processedDomains = processedDomainsResult[0]?.count || 0;

      const successfulDomainsResult = await db.select({ count: count() })
        .from(domains)
        .where(sql`${domains.batchId} = ${batchId} AND ${domains.status} = 'success'`);
      successfulDomains = successfulDomainsResult[0]?.count || 0;
    }

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

    // Duplicate detection stats
    let duplicatesDetected = 0;
    let duplicatesSkipped = 0;
    let newDomainsProcessed = 0;

    // Check for duplicates and reused results
    for (const domain of batchDomains) {
      // Check if this domain existed before this batch
      const existingDomain = await db.select()
        .from(domains)
        .where(
          and(
            eq(domains.domain, domain.domain),
            sql`${domains.createdAt} < ${domain.createdAt}`
          )
        )
        .limit(1);

      if (existingDomain.length > 0) {
        duplicatesDetected++;
        // Check if result was reused (high confidence from previous processing)
        if (domain.confidenceScore && domain.confidenceScore >= 85) {
          duplicatesSkipped++;
        }
      } else {
        newDomainsProcessed++;
      }
    }

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
      duplicatesDetected,
      duplicatesSkipped,
      newDomainsProcessed,
      duplicatesSavingsPercentage: duplicatesDetected > 0 
        ? Math.round((duplicatesSkipped / duplicatesDetected) * 100)
        : 0,
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

  // Analytics
  async getAnalyticsData(limit = 50, offset = 0): Promise<AnalyticsData[]> {
    const completedBatches = await db.select()
      .from(batches)
      .where(eq(batches.status, 'completed'))
      .orderBy(desc(batches.completedAt))
      .limit(limit)
      .offset(offset);

    const analyticsData: AnalyticsData[] = [];

    for (const batch of completedBatches) {
      const batchDomains = await this.getDomainsByBatch(batch.id, 1000);
      const successful = batchDomains.filter(d => d.status === 'success');
      
      if (batchDomains.length === 0) continue;

      // Calculate median confidence
      const confidenceScores = successful
        .map(d => d.confidenceScore || 0)
        .filter(score => score > 0)
        .sort((a, b) => a - b);
      
      const medianConfidence = confidenceScores.length > 0 
        ? confidenceScores[Math.floor(confidenceScores.length / 2)]
        : 0;

      // Calculate average confidence
      const avgConfidence = confidenceScores.length > 0
        ? Math.round(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length)
        : 0;

      // Domain mapping percentage
      const domainMappingCount = successful.filter(d => 
        d.extractionMethod?.includes('domain_parse')).length;
      const domainMappingPercentage = successful.length > 0 
        ? Math.round((domainMappingCount / successful.length) * 100)
        : 0;

      // Processing time per domain (using actual recorded times)
      const domainsWithTiming = batchDomains.filter(d => d.processingTimeMs && d.processingTimeMs > 0);
      const avgProcessingTimePerDomain = domainsWithTiming.length > 0
        ? Math.round(domainsWithTiming.reduce((sum, d) => sum + (d.processingTimeMs || 0), 0) / domainsWithTiming.length)
        : 0;

      // High confidence percentage (90%+)
      const highConfidenceCount = successful.filter(d => 
        d.confidenceScore && d.confidenceScore >= 90).length;
      const highConfidencePercentage = successful.length > 0
        ? Math.round((highConfidenceCount / successful.length) * 100)
        : 0;

      // Calculate total processing time
      const totalProcessingTimeMs = batch.completedAt && batch.uploadedAt 
        ? new Date(batch.completedAt).getTime() - new Date(batch.uploadedAt).getTime()
        : 0;
      
      // Format total processing time
      const formatProcessingTime = (ms: number): string => {
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.round((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
      };

      analyticsData.push({
        batchId: batch.id,
        fileName: batch.fileName,
        completedAt: batch.completedAt || batch.uploadedAt,
        totalDomains: batch.totalDomains,
        successRate: Math.round((successful.length / batchDomains.length) * 100),
        medianConfidence,
        averageConfidence: avgConfidence,
        domainMappingPercentage,
        avgProcessingTimePerDomain,
        highConfidencePercentage,
        totalProcessingTimeMs,
        totalProcessingTimeFormatted: formatProcessingTime(totalProcessingTimeMs),
      });
    }

    return analyticsData;
  }

  // Database Management
  async clearDatabase(): Promise<void> {
    // Clear all tables in the correct order (respecting foreign key constraints)
    await db.delete(gleifCandidates);
    await db.delete(domains);
    await db.delete(batches);
    await db.delete(activities);
  }

  // Level 2 GLEIF Operations (V2 Enhancement)
  async createGleifCandidates(domainId: number, candidates: InsertGleifCandidate[]): Promise<GleifCandidate[]> {
    const candidatesWithDomainId = candidates.map(candidate => ({
      ...candidate,
      domainId
    }));
    
    const result = await db.insert(gleifCandidates)
      .values(candidatesWithDomainId)
      .returning();
    
    return result;
  }

  async getGleifCandidates(domainId: number): Promise<GleifCandidate[]> {
    return await db.select()
      .from(gleifCandidates)
      .where(eq(gleifCandidates.domainId, domainId))
      .orderBy(asc(gleifCandidates.rankPosition));
  }

  async updatePrimarySelection(domainId: number, leiCode: string): Promise<Domain | undefined> {
    // First, update all candidates to mark the selected one as primary
    await db.update(gleifCandidates)
      .set({ isPrimarySelection: false })
      .where(eq(gleifCandidates.domainId, domainId));
    
    const selectedCandidate = await db.update(gleifCandidates)
      .set({ isPrimarySelection: true })
      .where(and(
        eq(gleifCandidates.domainId, domainId),
        eq(gleifCandidates.leiCode, leiCode)
      ))
      .returning();

    if (selectedCandidate.length === 0) {
      return undefined;
    }

    // Update the domain record with primary selection
    const candidate = selectedCandidate[0];
    const result = await db.update(domains)
      .set({
        primaryLeiCode: candidate.leiCode,
        primaryGleifName: candidate.legalName,
        primarySelectionConfidence: candidate.gleifMatchScore,
        finalLegalName: candidate.legalName,
        finalConfidence: candidate.weightedScore,
        finalExtractionMethod: 'level2_enhanced',
        selectionAlgorithm: 'manual_override',
        manualReviewRequired: false
      })
      .where(eq(domains.id, domainId))
      .returning();

    return result[0];
  }

  async getManualReviewQueue(limit = 50, offset = 0): Promise<Domain[]> {
    return await db.select()
      .from(domains)
      .where(eq(domains.manualReviewRequired, true))
      .orderBy(desc(domains.level2CandidatesCount), desc(domains.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getLevel2EligibleDomains(limit = 50, offset = 0): Promise<Domain[]> {
    return await db.select()
      .from(domains)
      .where(and(
        eq(domains.level2Attempted, false),
        sql`(
          (status = 'failed' AND company_name IS NOT NULL) OR
          (status = 'success' AND confidence_score < 70) OR
          (failure_category = 'Protected - Manual Review')
        )`
      ))
      .orderBy(desc(domains.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // Enhanced GLEIF Knowledge Base Operations (V3 - Entity Intelligence)
  async createGleifEntity(entity: InsertGleifEntity): Promise<GleifEntity> {
    const result = await db.insert(gleifEntities).values(entity).returning();
    return result[0];
  }

  async getGleifEntity(leiCode: string): Promise<GleifEntity | undefined> {
    const result = await db.select().from(gleifEntities).where(eq(gleifEntities.leiCode, leiCode)).limit(1);
    return result[0];
  }

  async updateGleifEntity(leiCode: string, updates: Partial<GleifEntity>): Promise<GleifEntity | undefined> {
    const result = await db.update(gleifEntities)
      .set(updates)
      .where(eq(gleifEntities.leiCode, leiCode))
      .returning();
    return result[0];
  }

  async createDomainEntityMapping(mapping: InsertDomainEntityMapping): Promise<DomainEntityMapping> {
    const result = await db.insert(domainEntityMappings).values(mapping).returning();
    return result[0];
  }

  async getDomainEntityMapping(domain: string, leiCode: string): Promise<DomainEntityMapping | undefined> {
    const result = await db.select()
      .from(domainEntityMappings)
      .where(and(
        eq(domainEntityMappings.domain, domain),
        eq(domainEntityMappings.leiCode, leiCode)
      ))
      .limit(1);
    return result[0];
  }

  async getDomainEntityMappings(domain: string): Promise<DomainEntityMapping[]> {
    return await db.select()
      .from(domainEntityMappings)
      .where(eq(domainEntityMappings.domain, domain))
      .orderBy(desc(domainEntityMappings.mappingConfidence));
  }

  async getEntityDomainMappings(leiCode: string): Promise<DomainEntityMapping[]> {
    return await db.select()
      .from(domainEntityMappings)
      .where(eq(domainEntityMappings.leiCode, leiCode))
      .orderBy(desc(domainEntityMappings.lastConfirmedDate));
  }

  async updateDomainEntityMapping(id: number, updates: Partial<DomainEntityMapping>): Promise<DomainEntityMapping | undefined> {
    const result = await db.update(domainEntityMappings)
      .set(updates)
      .where(eq(domainEntityMappings.id, id))
      .returning();
    return result[0];
  }

  async createEntityRelationship(relationship: InsertEntityRelationship): Promise<EntityRelationship> {
    const result = await db.insert(entityRelationships).values(relationship).returning();
    return result[0];
  }

  async getEntityRelationships(leiCode: string): Promise<EntityRelationship[]> {
    return await db.select()
      .from(entityRelationships)
      .where(eq(entityRelationships.parentLei, leiCode))
      .orderBy(desc(entityRelationships.relationshipConfidence));
  }
}

export const storage = new PostgreSQLStorage();