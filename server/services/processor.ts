import { storage } from '../storage';
import { DomainExtractor } from './domainExtractor';
import { gleifService } from './gleifService';
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

      // Search GLEIF for candidates
      const searchResult = await gleifService.searchEntity(domain.companyName, domain.domain);
      
      if (searchResult.entities.length === 0) {
        await storage.updateDomain(domain.id, {
          level2Status: 'failed',
          level2ProcessingTimeMs: Date.now() - level2StartTime
        });
        return;
      }

      // Process multiple candidates
      const selectionResult = await gleifService.processMultipleCandidates(
        searchResult.entities,
        domain,
        searchResult.searchMethod
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
      await storage.updateBatch(batchId, { status: 'completed' });
      await storage.createActivity({
        type: 'batch_complete',
        message: `Batch completed: ${batch.fileName} (Level 2 enhanced: ${level2Eligible.length})`,
        details: JSON.stringify({ 
          batchId, 
          processed: this.processedCount,
          successful: await this.getSuccessfulCount(batchId),
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

  private async processDomain(domain: Domain): Promise<void> {
    const startTime = Date.now();
    const maxProcessingTime = 13000; // 13 seconds max (11s extractor + 2s buffer)
    
    try {
      // Skip if already processed successfully (from cache)
      if (domain.status === 'success') {
        this.processedCount++;
        return;
      }

      // Check for stuck processing (processing for more than 13 seconds)
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
        
        this.processedCount++;
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
      
      await storage.updateDomain(domain.id, {
        status: 'failed',
        failureCategory: 'technical_timeout',
        technicalDetails: `Processing error or timeout: ${error.message}`,
        recommendation: 'Retry with different extraction methods',
        errorMessage: `Processing error: ${error.message}`,
        retryCount: (domain.retryCount || 0) + 1,
        processedAt: new Date(),
        processingTimeMs: processingTime,
      });
    }

    this.processedCount++;
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
