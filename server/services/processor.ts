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

  private hasLegalSuffix(companyName: string): boolean {
    return /\b(Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|Ltée|plc|PLC|DAC|CLG|UC|ULC|Society|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|Ltda\.?|Limitada|SLU|EIRELI|MEI|Coop|Cooperativa|SCA|OSC|Fundação|Associação|S\.p\.A\.|S\.r\.l\.|S\.r\.l\.s\.|S\.n\.c\.|S\.a\.s\.|S\.a\.p\.a\.|Soc\.\s*Coop\.|Società\s*Cooperativa|Fondazione|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.|OOO|ООО|AO|АО|PAO|ПАО|IP|ИП|ANO|АНО|TNV|PT|PK|Kooperativ|Fond|Pvt\s*Ltd|Private\s*Limited|Public\s*Limited\s*Company)\b/i.test(companyName);
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
    const maxProcessingTime = 30000; // 30 seconds max per domain
    
    try {
      // Skip if already processed successfully (from cache)
      if (domain.status === 'success') {
        this.processedCount++;
        return;
      }

      // Check for stuck processing (processing for more than 30 seconds)
      if (domain.status === 'processing' && domain.processingStartedAt) {
        const processingTime = Date.now() - new Date(domain.processingStartedAt).getTime();
        if (processingTime > maxProcessingTime) {
          console.log(`TIMEOUT: Domain ${domain.domain} stuck processing for ${processingTime}ms, forcing completion`);
          await storage.updateDomain(domain.id, {
            status: 'failed',
            errorMessage: 'Processing timeout - domain stuck in processing loop',
            failureCategory: 'technical_timeout',
            processedAt: new Date(),
            processingTimeMs: processingTime
          });
          this.processedCount++;
          return;
        }
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
        retryCount: (domain.retryCount || 0) + 1,
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

  async processSingleDomain(domain: Domain): Promise<Domain> {
    // For single domain tests, always do fresh processing (skip cache)
    await this.processDomainFresh(domain);
    // Return the updated domain from storage
    const updatedDomain = await storage.getDomain(domain.id);
    return updatedDomain!;
  }

  private async processDomainFresh(domain: Domain): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Mark as processing and record start time
      await storage.updateDomain(domain.id, { 
        status: 'processing',
        processingStartedAt: new Date()
      });

      // Always extract fresh (no caching for single domain tests)
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
        retryCount: (domain.retryCount || 0) + 1,
        processedAt: new Date(),
        processingTimeMs: processingTime,
      });
    }
  }
}

export const processor = new BatchProcessor();
