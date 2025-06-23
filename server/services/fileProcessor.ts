import { storage } from '../storage';
import { DomainExtractor } from './domainExtractor';
import type { ProcessingJob } from '@shared/schema';

export class FileProcessor {
  private extractor: DomainExtractor;
  private isProcessing = false;
  private currentJob: ProcessingJob | null = null;

  constructor() {
    this.extractor = new DomainExtractor();
  }

  async processFile(filename: string, content: string): Promise<ProcessingJob> {
    // Parse domains from file content
    const domains = this.parseDomains(content);
    
    // Create processing job
    const job = await storage.createProcessingJob({
      filename,
      status: 'pending',
      totalDomains: domains.length,
      processedDomains: 0,
      successfulDomains: 0,
      failedDomains: 0,
    });

    // Create domain entries
    for (const domain of domains) {
      await storage.createDomain({
        domain: domain.trim(),
        status: 'pending',
        companyName: null,
        extractionMethod: null,
        confidenceScore: null,
        retryCount: 0,
        errorMessage: null,
      });
    }

    // Start processing in background
    this.startProcessing(job);

    return job;
  }

  private parseDomains(content: string): string[] {
    const domains: string[] = [];
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Handle CSV format
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        for (const part of parts) {
          const domain = this.cleanDomain(part.trim());
          if (domain) domains.push(domain);
        }
      } else {
        // Handle plain text format
        const domain = this.cleanDomain(trimmed);
        if (domain) domains.push(domain);
      }
    }
    
    // Remove duplicates
    return [...new Set(domains)];
  }

  private cleanDomain(domain: string): string | null {
    if (!domain) return null;
    
    // Remove quotes and whitespace
    domain = domain.replace(/["']/g, '').trim();
    
    // Basic domain validation
    if (domain.length < 3 || domain.length > 253) return null;
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.replace(/^https?:\/\//, '').replace(/^www\./, ''))) {
      return null;
    }
    
    return domain;
  }

  private async startProcessing(job: ProcessingJob): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.currentJob = job;
    
    try {
      await storage.updateProcessingJob(job.id, { status: 'processing' });
      
      // Get pending domains
      const pendingDomains = await storage.getDomains({ status: 'pending' });
      
      // Process domains in batches
      const batchSize = 10;
      for (let i = 0; i < pendingDomains.length; i += batchSize) {
        const batch = pendingDomains.slice(i, i + batchSize);
        await this.processBatch(batch);
        
        // Update job progress
        const stats = await storage.getStats();
        await storage.updateProcessingJob(job.id, {
          processedDomains: stats.processedDomains,
          successfulDomains: stats.successfulDomains,
          failedDomains: stats.failedDomains,
        });
      }
      
      // Mark job as completed
      await storage.updateProcessingJob(job.id, { 
        status: 'completed',
        completedAt: new Date(),
      });
      
    } catch (error) {
      await storage.updateProcessingJob(job.id, { 
        status: 'failed',
        completedAt: new Date(),
      });
    } finally {
      this.isProcessing = false;
      this.currentJob = null;
    }
  }

  private async processBatch(domains: any[]): Promise<void> {
    const promises = domains.map(async (domain) => {
      try {
        await storage.updateDomain(domain.id, { status: 'processing' });
        
        const result = await this.extractor.extractCompanyName(domain.domain);
        
        if (result.companyName) {
          await storage.updateDomain(domain.id, {
            status: 'completed',
            companyName: result.companyName,
            extractionMethod: result.method,
            confidenceScore: result.confidence,
            processedAt: new Date(),
          });
        } else {
          await storage.updateDomain(domain.id, {
            status: 'failed',
            errorMessage: result.error || 'No company name found',
            processedAt: new Date(),
          });
        }
      } catch (error) {
        await storage.updateDomain(domain.id, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          processedAt: new Date(),
        });
      }
    });
    
    await Promise.all(promises);
  }

  getCurrentJob(): ProcessingJob | null {
    return this.currentJob;
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

export const fileProcessor = new FileProcessor();
