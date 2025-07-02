import { storage } from '../storage';
import { DomainExtractor } from './domainExtractor';
import { gleifService } from './gleifService';
import type { Domain } from '@shared/schema';
import { BatchLoggerFactory } from './batchLogger';

export class BatchProcessor {
  private extractor: DomainExtractor;
  private isProcessing: boolean = false;

  constructor() {
    this.extractor = new DomainExtractor();
  }

  private hasLegalSuffix(companyName: string): boolean {
    return /\b(Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|Ltée|plc|PLC|DAC|CLG|UC|ULC|Society|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|Ltda\.?|Limitada|SLU|EIRELI|MEI|Coop|Cooperativa|SCA|OSC|Fundação|Associação|S\.p\.A\.|S\.r\.l\.|S\.r\.l\.s\.|S\.n\.c\.|S\.a\.s\.|S\.a\.p\.a\.|Soc\.\s*Coop\.|Società\s*Cooperativa|Fondazione|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.|OOO|ООО|AO|АО|PAO|ПАО|IP|ИП|ANO|АНО|TNV|PT|PK|Kooperativ|Fond|Pvt\s*Ltd|Private\s*Limited|Public\s*Limited\s*Company)\b/i.test(companyName);
  }

  // Level 2 GLEIF Processing Logic (V2 Enhancement)
  private shouldTriggerLevel2(domain: Domain): boolean {
    // Skip if Level 2 already attempted
    if (domain.level2Attempted === true) return false;

    // Trigger Level 2 for these scenarios:
    return (
      // Failed extraction but partial company name detected
      (domain.status === 'failed' && domain.companyName && domain.companyName.length > 2) ||
      // Low confidence successful extraction (increased threshold for testing)
      (domain.status === 'success' && (domain.confidenceScore || 0) < 95) ||
      // Protected sites requiring manual review
      (domain.failureCategory === 'Protected - Manual Review') ||
      // Incomplete extractions with potential
      (domain.failureCategory === 'incomplete_low_priority' && domain.companyName) ||
      // All successful extractions with company names (for comprehensive GLEIF verification)
      (domain.status === 'success' && domain.companyName && domain.companyName.length > 3)
    );
  }

  private async processLevel2Enhancement(domain: Domain): Promise<void> {
    const level2StartTime = Date.now();

    try {
      // Mark Level 2 as attempted
      await storage.updateDomain(domain.id, {
        level2Attempted: true,
        level2Status: 'processing'
      });

      if (!domain.companyName) {
        await storage.updateDomain(domain.id, {
          level2Status: 'not_applicable',
          level2ProcessingTimeMs: Date.now() - level2StartTime
        });
        return;
      }

      // Extract focus jurisdiction from Level 1 results for targeted GLEIF search
      const focusJurisdiction = domain.geographicMarkers?.focusJurisdiction?.jurisdiction;
      const focusConfidence = domain.geographicMarkers?.focusJurisdiction?.confidence;
      const alternatives = domain.geographicMarkers?.focusJurisdiction?.alternatives;

      console.log(`Level 2 GLEIF search for ${domain.domain} - Focus: ${focusJurisdiction} (${focusConfidence}%)`);

      // Use focus jurisdiction targeted search
      const gleifSearchResult = await gleifService.searchWithFocusJurisdiction(
        domain.companyName || '', 
        domain.domain,
        focusJurisdiction,
        focusConfidence,
        alternatives
      );

      if (gleifSearchResult.entities.length === 0) {
        await storage.updateDomain(domain.id, {
          level2Status: 'failed',
          level2ProcessingTimeMs: Date.now() - level2StartTime
        });
        return;
      }

      // Process multiple candidates
      const selectionResult = await gleifService.processMultipleCandidates(
        gleifSearchResult.entities,
        domain,
        gleifSearchResult.searchMethod
      );

      // Store all candidates in database
      if (typeof storage.createGleifCandidates === 'function') {
        const candidatesData = [selectionResult.primarySelection, ...selectionResult.alternativeCandidates]
          .map(candidate => ({
            domainId: domain.id,
            leiCode: candidate.lei,
            legalName: candidate.legalName,
            entityStatus: candidate.entityStatus,
            jurisdiction: candidate.jurisdiction,
            legalForm: candidate.legalForm,
            entityCategory: candidate.entityCategory,
            registrationStatus: candidate.registrationStatus,
            gleifMatchScore: candidate.gleifMatchScore,
            weightedScore: candidate.weightedScore,
            rankPosition: candidate.rankPosition,
            domainTldScore: candidate.domainTldScore,
            fortune500Score: candidate.fortune500Score,
            nameMatchScore: candidate.nameMatchScore,
            entityComplexityScore: candidate.entityComplexityScore,
            matchMethod: candidate.matchMethod,
            selectionReason: candidate.selectionReason,
            isPrimarySelection: candidate.isPrimarySelection,
            gleifFullData: JSON.stringify(candidate)
          }));

        await storage.createGleifCandidates(domain.id, candidatesData);
      }

      // Update domain with Level 2 results
      const primaryCandidate = selectionResult.primarySelection;
      const enhancedBusinessCategory = this.determineEnhancedBusinessCategory(domain, selectionResult);

      await storage.updateDomain(domain.id, {
        level2Status: 'success',
        level2CandidatesCount: selectionResult.totalCandidates,
        level2ProcessingTimeMs: Date.now() - level2StartTime,
        primaryLeiCode: primaryCandidate.lei,
        primaryGleifName: primaryCandidate.legalName,
        primarySelectionConfidence: primaryCandidate.gleifMatchScore,
        selectionAlgorithm: selectionResult.selectionMethod,
        finalLegalName: primaryCandidate.legalName,
        finalConfidence: primaryCandidate.weightedScore,
        finalExtractionMethod: 'level2_enhanced',
        manualReviewRequired: selectionResult.manualReviewRequired,
        selectionNotes: primaryCandidate.selectionReason,
        failureCategory: enhancedBusinessCategory,
        status: (primaryCandidate.lei && primaryCandidate.legalName) ? 'success' : domain.status
      });

      console.log(`Level 2 GLEIF enhancement completed for ${domain.domain}: ${primaryCandidate.legalName} (${primaryCandidate.lei})`);

    } catch (error: any) {
      console.error(`Level 2 processing failed for ${domain.domain}:`, error);

      await storage.updateDomain(domain.id, {
        level2Status: 'failed',
        level2ProcessingTimeMs: Date.now() - level2StartTime,
        selectionNotes: `Level 2 processing error: ${error.message}`
      });
    }
  }

  private determineEnhancedBusinessCategory(domain: Domain, selectionResult: any): string {
    const primaryCandidate = selectionResult.primarySelection;

    if (primaryCandidate.entityStatus === 'ACTIVE' && primaryCandidate.weightedScore >= 85) {
      return 'GLEIF Verified - High Priority';
    }

    if (primaryCandidate.entityStatus === 'ACTIVE' && primaryCandidate.weightedScore >= 70) {
      return 'GLEIF Matched - Good Target';
    }

    if (primaryCandidate.entityStatus === 'INACTIVE') {
      return 'GLEIF Historical - Research Required';
    }

    if (selectionResult.manualReviewRequired) {
      return 'GLEIF Multiple - Manual Review';
    }

    // Fall back to original Level 1 category
    return domain.failureCategory || 'Level 1 Only - Manual Review';
  }

  // Central Level 2 processing trigger
  private async attemptLevel2Processing(domainId: number): Promise<void> {
    const domain = await storage.getDomain(domainId);
    if (domain && this.shouldTriggerLevel2(domain)) {
      console.log(`Triggering Level 2 GLEIF enhancement for ${domain.domain}`);
      await this.processLevel2Enhancement(domain);
    }
  }

  async processBatch(batchId: string): Promise<void> {
    if (this.isProcessing) {
      throw new Error('Processor is already running');
    }

    this.isProcessing = true;
    const batchLogger = BatchLoggerFactory.getLogger(batchId);
    const batchStartTime = Date.now();

    try {
      const batch = await storage.getBatch(batchId);
      if (!batch) {
        throw new Error('Batch not found');
      }

      // Auto-resume logic: Check if batch has pending domains that need processing
      const pendingDomains = await storage.getDomainsByStatus('pending');
      const batchPendingDomains = pendingDomains.filter(d => d.batchId === batchId);

      if (batchPendingDomains.length === 0) {
        console.log(`No pending domains for batch ${batchId}. Checking if processing truly complete...`);

        // Verify batch completion
        const allBatchDomains = await storage.getDomainsByBatch(batchId, 10000);
        const totalProcessed = allBatchDomains.filter(d => d.status !== 'pending').length;

        if (totalProcessed < batch.totalDomains) {
          console.log(`RESUMING: Found ${batch.totalDomains - totalProcessed} unprocessed domains in completed batch`);
          // Force requeue stuck domains that aren't actually processing
          const stuckDomains = allBatchDomains.filter(d => 
            d.status === 'processing' && 
            (!d.processingStartedAt || (Date.now() - new Date(d.processingStartedAt).getTime()) > 30000)
          );

          for (const stuckDomain of stuckDomains) {
            await storage.updateDomain(stuckDomain.id, {
              status: 'pending',
              processingStartedAt: null
            });
          }

          // Retry getting pending domains
          const retryPendingDomains = await storage.getDomainsByStatus('pending');
          const retryBatchPendingDomains = retryPendingDomains.filter(d => d.batchId === batchId);

          if (retryBatchPendingDomains.length > 0) {
            console.log(`REQUEUED: ${retryBatchPendingDomains.length} stuck domains back to pending`);
          }
        } else {
          console.log(`Batch ${batchId} processing complete`);
          this.isProcessing = false;
          return;
        }
      }

      // Log batch start with comprehensive context
      batchLogger.logBatchStart({
        fileName: batch.fileName,
        totalDomains: batch.totalDomains || 0,
        uploadedAt: batch.uploadedAt ? batch.uploadedAt.toISOString() : new Date().toISOString()
      });

      await storage.updateBatch(batchId, { status: 'processing' });
      await storage.createActivity({
        type: 'batch_processing',
        message: `Started processing batch: ${batch.fileName}`,
        details: JSON.stringify({ batchId, totalDomains: batch.totalDomains })
      });

      // Get pending domains for this batch
      const currentPendingDomains = await storage.getDomainsByStatus('pending');
      let batchDomains = currentPendingDomains.filter(d => d.batchId === batchId);

      // Recovery system: Check for orphaned domains in inconsistent states
      if (batchDomains.length === 0) {
        console.log(`No pending domains found for batch ${batchId}. Running status recovery...`);

        const allBatchDomains = await storage.getDomainsByBatch(batchId, 10000);
        const totalProcessed = allBatchDomains.filter(d => d.status !== 'pending').length;

        if (totalProcessed < batch.totalDomains) {
          // Find domains that might be in inconsistent states
          const orphanedDomains = allBatchDomains.filter(d => {
            // Domain shows as processing but no recent processing timestamp
            if (d.status === 'processing' && (!d.processingStartedAt || 
                (Date.now() - new Date(d.processingStartedAt).getTime()) > 60000)) {
              return true;
            }

            // Domain failed but has low retry count and could be retried
            if (d.status === 'failed' && (d.retryCount || 0) < 2 && 
                d.failureCategory !== 'circuit_breaker_skip') {
              return true;
            }

            return false;
          });

          if (orphanedDomains.length > 0) {
            console.log(`STATUS RECOVERY: Found ${orphanedDomains.length} domains in inconsistent states, resetting to pending`);

            for (const orphanedDomain of orphanedDomains) {
              await storage.updateDomain(orphanedDomain.id, {
                status: 'pending',
                processingStartedAt: null,
                retryCount: (orphanedDomain.retryCount || 0) + 1
              });
            }

            // Refresh pending domains list
            const refreshedPendingDomains = await storage.getDomainsByStatus('pending');
            batchDomains = refreshedPendingDomains.filter(d => d.batchId === batchId);
            console.log(`STATUS RECOVERY: ${batchDomains.length} domains now available for processing`);
          }
        }

        if (batchDomains.length === 0) {
          console.log(`Batch ${batchId} processing complete after status recovery`);
        }
      }

      if (batchDomains.length > 0) {
        console.log(`Processing ${batchDomains.length} pending domains for batch ${batchId}`);

        // Reduced concurrency for Fortune 500 enterprise domains
        const batchSize = 3;
        let processedCount = 0;

        for (let i = 0; i < batchDomains.length; i += batchSize) {
          const batch = batchDomains.slice(i, i + batchSize);

          // Log start for each domain in batch
          batch.forEach((domain, index) => {
            batchLogger.logDomainStart(domain.domain, i + index + 1);
          });

          await Promise.all(batch.map(domain => this.processDomain(domain, batchLogger)));
          processedCount += batch.length;

          // Update batch progress - use actual database state instead of counter
          const allBatchDomains = await storage.getDomainsByBatch(batchId, 10000);
          const actualProcessed = allBatchDomains.filter(d => d.status !== 'pending').length;
          const successful = await this.getSuccessfulCount(batchId);
          const failed = actualProcessed - successful;

          // Calculate processing rates
          const elapsedMs = Date.now() - batchStartTime;
          const currentRate = (actualProcessed / (elapsedMs / 1000)) * 60; // domains per minute
          const averageRate = (actualProcessed / (elapsedMs / 60000)); // domains per minute
          const estimatedRemainingMs = batchDomains.length > actualProcessed ? 
            ((batchDomains.length - actualProcessed) / currentRate) * 60000 : 0;

          // Log batch progress
          batchLogger.logBatchProgress({
            processed: actualProcessed,
            total: batchDomains.length,
            successCount: successful,
            failureCount: failed,
            currentRate: Math.round(currentRate * 10) / 10,
            averageRate: Math.round(averageRate * 10) / 10,
            elapsedTimeMs: elapsedMs,
            estimatedRemainingMs: estimatedRemainingMs
          });

          await storage.updateBatch(batchId, {
            processedDomains: actualProcessed,
            successfulDomains: successful,
            failedDomains: failed
          });

          // Small delay to prevent overwhelming and show processing status
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Post-process Level 2 GLEIF enhancements for eligible domains
      console.log('Starting Level 2 GLEIF enhancement phase...');
      const allDomains = await storage.getDomainsByBatch(batchId, 10000);
      const level2Eligible = allDomains.filter(domain => this.shouldTriggerLevel2(domain));

      if (level2Eligible.length > 0) {
        console.log(`Processing ${level2Eligible.length} domains for Level 2 GLEIF enhancement`);
        for (const domain of level2Eligible) {
          try {
            await this.processLevel2Enhancement(domain);
          } catch (error: any) {
            console.error(`Level 2 processing failed for ${domain.domain}:`, error.message);
          }
        }
      }

      // Mark batch as completed
      const finalBatchDomains = await storage.getDomainsByBatch(batchId, 10000);
      const finalProcessed = finalBatchDomains.filter(d => d.status !== 'pending').length;
      const finalSuccessful = await this.getSuccessfulCount(batchId);
      const totalTimeMs = Date.now() - batchStartTime;

      // Log batch completion with comprehensive metrics
      batchLogger.logBatchComplete({
        processed: finalProcessed,
        successful: finalSuccessful,
        failed: finalProcessed - finalSuccessful,
        totalTimeMs: totalTimeMs,
        averageTimePerDomain: finalProcessed > 0 ? totalTimeMs / finalProcessed : 0,
        successRate: finalProcessed > 0 ? (finalSuccessful / finalProcessed) * 100 : 0
      });

      // Generate AI analysis summary
      batchLogger.generateAIAnalysisSummary();

      await storage.updateBatch(batchId, { status: 'completed' });
      await storage.createActivity({
        type: 'batch_complete',
        message: `Batch completed: ${batch.fileName} (Level 2 enhanced: ${level2Eligible.length})`,
        details: JSON.stringify({ 
          batchId, 
          processed: finalProcessed,
          successful: finalSuccessful,
          level2Enhanced: level2Eligible.length
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

  private async processDomain(domain: Domain, batchLogger?: any): Promise<void> {
    const startTime = Date.now();
    const maxProcessingTime = 11000; // 11 seconds max (matches extractor timeout)

    try {
      // Skip if already processed successfully (from cache)
      if (domain.status === 'success') {
        return;
      }

      // Circuit breaker: Skip domains that have failed too many times
      const retryCount = domain.retryCount || 0;
      if (retryCount >= 3) {
        console.log(`CIRCUIT BREAKER: Skipping ${domain.domain} - exceeded retry limit (${retryCount} attempts)`);
        await storage.updateDomain(domain.id, {
          status: 'failed',
          failureCategory: 'circuit_breaker_skip',
          errorMessage: 'Domain skipped due to repeated failures - circuit breaker activated',
          technicalDetails: `Exceeded maximum retry attempts (${retryCount}/3)`,
          recommendation: 'Manual review required - automated processing unsuccessful',
          processedAt: new Date(),
          processingTimeMs: Date.now() - startTime
        });
        return;
      }

      // Check for stuck processing (processing for more than 13 seconds)
      if (domain.status === 'processing' && domain.processingStartedAt) {
        const processingTime = Date.now() - new Date(domain.processingStartedAt).getTime();
        if (processingTime > 11000) {
          console.log(`TIMEOUT: Domain ${domain.domain} stuck processing for ${processingTime}ms, forcing completion`);
          await storage.updateDomain(domain.id, {
            status: 'failed',
            errorMessage: 'Processing timeout - domain stuck in processing loop',
            failureCategory: 'technical_timeout',
            processedAt: new Date(),
            processingTimeMs: processingTime
          });

          return;
        }
      }

      // Mark as processing and record start time - with timeout protection
      await Promise.race([
        storage.updateDomain(domain.id, { 
          status: 'processing',
          processingStartedAt: new Date()
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database update timeout')), 5000))
      ]);

      // Check if we already have a high-confidence result for this domain
      const existingHighConfidence = await storage.getHighConfidenceResult(domain.domain);

      if (existingHighConfidence && existingHighConfidence.id !== domain.id && this.hasLegalSuffix(existingHighConfidence.companyName || '')) {
        const processingTime = Date.now() - startTime;

        await storage.updateDomain(domain.id, {
          status: 'success',
          companyName: existingHighConfidence.companyName,
          extractionMethod: existingHighConfidence.extractionMethod + '_cached',
          confidenceScore: existingHighConfidence.confidenceScore,
          processedAt: new Date(),
          processingTimeMs: processingTime,
        });


        return;
      }

      // Extract company name with timeout protection
      const result = await Promise.race([
        this.extractor.extractCompanyName(domain.domain),
        new Promise<any>((_, reject) => 
          setTimeout(() => reject(new Error('Extraction timeout')), maxProcessingTime)
        )
      ]);

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
      const retryCount = (domain.retryCount || 0) + 1;

      // Intelligent retry strategy based on error type
      const shouldRetry = this.shouldRetryDomain(error.message, retryCount);
      const finalStatus = shouldRetry ? 'pending' : 'failed';

      if (shouldRetry) {
        console.log(`INTELLIGENT RETRY: Queuing ${domain.domain} for retry ${retryCount}/3 - ${error.message}`);
      }

      await storage.updateDomain(domain.id, {
        status: finalStatus,
        failureCategory: shouldRetry ? 'retry_queued' : 'technical_timeout',
        technicalDetails: `Processing error or timeout: ${error.message}`,
        recommendation: shouldRetry ? 'Automatic retry scheduled' : 'Manual intervention required',
        errorMessage: `Processing error: ${error.message}`,
        retryCount: retryCount,
        processedAt: finalStatus === 'failed' ? new Date() : null,
        processingTimeMs: processingTime,
        processingStartedAt: null // Reset for retry
      });
    }


  }

  private shouldRetryDomain(errorMessage: string, retryCount: number): boolean {
    if (retryCount >= 3) return false;

    // Retry network/timeout errors
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND')) {
      return true;
    }

    // Retry rate limiting errors
    if (errorMessage.includes('429') || 
        errorMessage.includes('rate limit')) {
      return true;
    }

    // Don't retry permanent errors
    if (errorMessage.includes('404') ||
        errorMessage.includes('403') ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('SSL')) {
      return false;
    }

    // Retry general processing errors on first attempt
    return retryCount <= 1;
  }

  private async getSuccessfulCount(batchId: string): Promise<number> {
    const domains = await storage.getDomainsByBatch(batchId, 10000);
    return domains.filter(d => d.status === 'success').length;
  }

  private async getTotalProcessedCount(batchId: string): Promise<number> {
    const domains = await storage.getDomainsByBatch(batchId, 10000);
    return domains.filter(d => d.status === 'success' || d.status === 'failed').length;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  stopProcessing(): boolean {
    if (this.isProcessing) {
      console.log('STOP REQUESTED: Gracefully stopping batch processing...');
      this.isProcessing = false;
      return true;
    }
    return false;
  }

  async processSingleDomain(domain: Domain): Promise<Domain> {
    // For single domain tests, always do fresh processing (skip cache)
    await this.processDomainFresh(domain);

    // Check if Level 2 GLEIF enhancement should be triggered for single domain
    await this.attemptLevel2Processing(domain.id);

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