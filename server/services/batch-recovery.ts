/**
 * Batch Recovery Service - Automatic Stuck Domain Recovery
 * Detects and clears domains stuck in processing status
 */

import { PostgreSQLStorage } from '../pgStorage';
import { BatchProcessor } from './processor';

export class BatchRecoveryService {
  private storage: PostgreSQLStorage;
  private processor: BatchProcessor;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
  private readonly STALL_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  constructor(storage: PostgreSQLStorage, processor: BatchProcessor) {
    this.storage = storage;
    this.processor = processor;
  }

  /**
   * Start automatic batch recovery monitoring
   */
  start(): void {
    if (this.recoveryInterval) {
      return; // Already running
    }

    console.log('🔄 Starting batch recovery service...');
    this.recoveryInterval = setInterval(async () => {
      try {
        await this.checkAndRecoverStalledBatches();
      } catch (error) {
        console.error('❌ Batch recovery check failed:', error);
      }
    }, this.CHECK_INTERVAL);

    // Run initial check after 5 minutes
    setTimeout(() => {
      this.checkAndRecoverStalledBatches();
    }, this.STALL_THRESHOLD);
  }

  /**
   * Stop the batch recovery monitor
   */
  stop(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
      console.log('⏹️ Batch recovery service stopped');
    }
  }

  /**
   * Check for stalled batches and recover them
   */
  private async checkAndRecoverStalledBatches(): Promise<void> {
    // Find domains stuck in processing status
    const stuckDomains = await this.storage.getDomainsByStatus('processing');
    
    if (stuckDomains.length === 0) {
      return; // No stuck domains
    }

    // Check if any domains have been stuck for more than 5 minutes
    const now = Date.now();
    const reallyStuckDomains = stuckDomains.filter(domain => {
      const processedAt = domain.processingStartedAt || domain.processedAt;
      if (!processedAt) return false;
      
      const timeSinceProcessing = now - new Date(processedAt).getTime();
      return timeSinceProcessing > this.STALL_THRESHOLD;
    });

    if (reallyStuckDomains.length === 0) {
      return; // No domains stuck long enough
    }

    console.log(`🚨 Found ${reallyStuckDomains.length} stuck domains, initiating recovery...`);

    // Group stuck domains by batch
    const batchGroups = new Map<string, typeof reallyStuckDomains>();
    for (const domain of reallyStuckDomains) {
      if (!batchGroups.has(domain.batchId)) {
        batchGroups.set(domain.batchId, []);
      }
      batchGroups.get(domain.batchId)!.push(domain);
    }

    // Recover each stalled batch
    for (const [batchId, domains] of batchGroups.entries()) {
      await this.recoverBatch(batchId, domains);
    }
  }

  /**
   * Recover a specific stalled batch
   */
  private async recoverBatch(batchId: string, stuckDomains: any[]): Promise<void> {
    console.log(`🔧 Recovering batch ${batchId} - clearing ${stuckDomains.length} stuck domains`);

    // Clear stuck domains (mark as failed with recovery note)
    for (const domain of stuckDomains) {
      await this.storage.updateDomain(domain.id, {
        status: 'failed',
        companyName: null,
        confidenceScore: 0,
        recommendation: 'Batch recovery cleared stuck processing',
        failureCategory: 'timeout',
        technicalDetails: `Stuck in processing - auto-recovered by batch recovery service`,
        errorMessage: 'Processing timeout - cleared by recovery system'
      });
    }

    // Log recovery activity (simplified - using console for now)
    console.log(`✅ Auto-recovered batch ${batchId} - cleared ${stuckDomains.length} stuck domains`);

    // Check if batch has pending domains and restart processing
    const pendingDomains = await this.storage.getDomainsByBatch(batchId, 'pending');
    if (pendingDomains.length > 0) {
      console.log(`🔄 Restarting processing for batch ${batchId} - ${pendingDomains.length} pending domains`);
      
      // Restart processing for this batch
      this.processor.processBatch(batchId);
    } else {
      console.log(`✅ Batch ${batchId} recovery complete - no pending domains`);
    }
  }

  /**
   * Manual recovery trigger (for UI button)
   */
  async triggerManualRecovery(batchId: string): Promise<{ cleared: number; restarted: boolean }> {
    const stuckDomains = await this.storage.getDomainsByBatch(batchId, 'processing');
    
    const cleared = stuckDomains.length;
    if (cleared > 0) {
      await this.recoverBatch(batchId, stuckDomains);
    }

    const pendingDomains = await this.storage.getDomainsByBatch(batchId, 'pending');
    const restarted = pendingDomains.length > 0;

    return {
      cleared,
      restarted
    };
  }
}