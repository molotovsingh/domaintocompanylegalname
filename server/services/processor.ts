import { storage } from '../storage';
import { DomainExtractor } from './domainExtractor';
import type { Domain } from '@shared/schema';

export class BatchProcessor {
  private extractor: DomainExtractor;
  private isProcessing: boolean = false;
  private processedCount: number = 0;

  constructor() {
    this.extractor = new DomainExtractor();
  }

  async processBatch(batchId: string): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Processor is already running');
    }

    this.isProcessing = true;
    this.processedCount = 0;

    try {
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        throw new Error('Batch not found');
      }

      await storage.updateBatch(batchId, { status: 'processing' });
      await storage.createActivity({
        type: 'batch_processing',
        message: `Started processing batch: ${batch.fileName}`,
        details: JSON.stringify({ batchId, totalDomains: batch.totalDomains })
      });

      // Get pending domains for this batch
      const pendingDomains = await storage.getDomainsByStatus('pending');
      const batchDomains = pendingDomains.filter(d => d.batchId === batchId);

      // Process domains with concurrency control
      const batchSize = 10;
      for (let i = 0; i < batchDomains.length; i += batchSize) {
        const batch = batchDomains.slice(i, i + batchSize);
        await Promise.all(batch.map(domain => this.processDomain(domain)));
        
        // Update batch progress
        this.processedCount += batch.length;
        const processed = Math.min(this.processedCount, batchDomains.length);
        const successful = await this.getSuccessfulCount(batchId);
        
        await storage.updateBatch(batchId, {
          processedDomains: processed,
          successfulDomains: successful,
          failedDomains: processed - successful
        });

        // Small delay to prevent overwhelming and show processing status
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Mark batch as completed
      await storage.updateBatch(batchId, { status: 'completed' });
      await storage.createActivity({
        type: 'batch_complete',
        message: `Batch completed: ${batch.fileName}`,
        details: JSON.stringify({ 
          batchId, 
          processed: this.processedCount,
          successful: await this.getSuccessfulCount(batchId)
        })
      });

    } catch (error: any) {
      await storage.updateBatch(batchId, { status: 'failed' });
      await storage.createActivity({
        type: 'error',
        message: `Batch processing failed: ${error.message}`,
        details: JSON.stringify({ batchId, error: error.message })
      });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processDomain(domain: Domain): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Skip if already processed successfully (from cache)
      if (domain.status === 'success') {
        this.processedCount++;
        return;
      }

      // Mark as processing and record start time
      await storage.updateDomain(domain.id, { 
        status: 'processing',
        processingStartedAt: new Date()
      });

      // Check if we already have a high-confidence result for this domain
      // BUT only use cache if it has proper legal suffix (quality validation)
      const existingHighConfidence = await storage.getHighConfidenceResult(domain.domain);
      
      if (existingHighConfidence && existingHighConfidence.id !== domain.id && this.hasLegalSuffix(existingHighConfidence.companyName || '')) {
        const processingTime = Date.now() - startTime;
        
        // Use existing high-confidence result ONLY if it has proper legal suffix
        await storage.updateDomain(domain.id, {
          status: 'success',
          companyName: existingHighConfidence.companyName,
          extractionMethod: existingHighConfidence.extractionMethod + '_cached',
          confidenceScore: existingHighConfidence.confidenceScore,
          processedAt: new Date(),
          processingTimeMs: processingTime,
        });
        
        this.processedCount++;
        return;
      }

      // Extract company name with enhanced classification
      const result = await this.extractor.extractCompanyName(domain.domain);

      const processingTime = Date.now() - startTime;
      
      // Determine status based on extraction result and confidence
      const isSuccessful = result.companyName && 
                          result.confidence >= 65 && 
                          result.connectivity !== 'unreachable' &&
                          result.failureCategory === 'success';

      await storage.updateDomain(domain.id, {
        status: isSuccessful ? 'success' : 'failed',
        companyName: result.companyName,
        extractionMethod: result.method,
        confidenceScore: result.confidence,
        errorMessage: result.error,
        failureCategory: result.failureCategory || (isSuccessful ? 'success' : 'incomplete_low_priority'),
        technicalDetails: result.technicalDetails,
        extractionAttempts: result.extractionAttempts ? JSON.stringify(result.extractionAttempts) : null,
        recommendation: result.recommendation,
        processedAt: new Date(),
        processingTimeMs: processingTime
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      await storage.updateDomain(domain.id, {
        status: 'failed',
        failureCategory: 'incomplete_low_priority',
        technicalDetails: 'Processing exception occurred',
        recommendation: 'Retry with different extraction methods',
        errorMessage: `Processing error: ${error.message}`,
        retryCount: domain.retryCount + 1,
        processedAt: new Date(),
        processingTimeMs: processingTime,
      });
    }
  }

  private async getSuccessfulCount(batchId: string): Promise<number> {
    const domains = await storage.getDomainsByBatch(batchId, 10000);
    return domains.filter(d => d.status === 'success').length;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const processor = new BatchProcessor();
