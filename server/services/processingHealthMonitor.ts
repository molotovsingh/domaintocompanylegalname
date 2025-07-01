
import { storage } from '../storage';

export class ProcessingHealthMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly checkInterval = 45000; // Check every 45 seconds
  private readonly staleProcessingThreshold = 120000; // 2 minutes without progress

  start(): void {
    if (this.isRunning) {
      console.log('Processing health monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting processing health monitor - checking every 45 seconds');
    
    this.checkProcessingHealth();
    this.intervalId = setInterval(() => {
      this.checkProcessingHealth();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Processing health monitor stopped');
  }

  private async checkProcessingHealth(): Promise<void> {
    try {
      // Get all active batches
      const activeBatches = await storage.getBatchesByStatus('processing');
      
      for (const batch of activeBatches) {
        await this.checkBatchHealth(batch);
      }
    } catch (error: any) {
      console.error('Error in processing health monitor:', error.message);
    }
  }

  private async checkBatchHealth(batch: any): Promise<void> {
    const batchId = batch.id;
    const allDomains = await storage.getDomainsByBatch(batchId, 10000);
    const pendingDomains = allDomains.filter(d => d.status === 'pending');
    const processingDomains = allDomains.filter(d => d.status === 'processing');
    
    // Check if batch has stalled (no progress in last 2 minutes)
    const lastProcessedDomain = allDomains
      .filter(d => d.processedAt)
      .sort((a, b) => new Date(b.processedAt!).getTime() - new Date(a.processedAt!).getTime())[0];
    
    const timeSinceLastProgress = lastProcessedDomain 
      ? Date.now() - new Date(lastProcessedDomain.processedAt!).getTime()
      : Infinity;
    
    // Auto-resume conditions - more aggressive detection
    const shouldAutoResume = (
      pendingDomains.length > 0 && 
      processingDomains.length === 0 && 
      (timeSinceLastProgress > this.staleProcessingThreshold || timeSinceLastProgress === Infinity)
    );

    if (shouldAutoResume) {
      console.log(`HEALTH MONITOR: Auto-resuming stalled batch ${batchId} - ${pendingDomains.length} pending domains (stalled for ${Math.round(timeSinceLastProgress/1000)}s)`);
      
      // Import processor dynamically to avoid circular dependencies
      const { processor } = await import('./processor');
      
      if (!processor.isCurrentlyProcessing()) {
        try {
          // Force resume the batch processing
          await processor.processBatch(batchId);
          console.log(`HEALTH MONITOR: Successfully triggered processing for batch ${batchId}`);
        } catch (error: any) {
          console.error(`HEALTH MONITOR: Failed to resume batch ${batchId}:`, error.message);
        }
      } else {
        console.log(`HEALTH MONITOR: Processor is busy, will retry on next health check`);
      }
    }

    // Health metrics logging
    const processedCount = allDomains.filter(d => d.status !== 'pending').length;
    const progressPercentage = Math.round((processedCount / allDomains.length) * 100);
    
    if (pendingDomains.length > 0 || processingDomains.length > 0) {
      console.log(`HEALTH CHECK: Batch ${batchId} - ${progressPercentage}% complete (${pendingDomains.length} pending, ${processingDomains.length} processing)`);
    }
  }

  getStatus(): { running: boolean; checkInterval: number; staleThreshold: number } {
    return {
      running: this.isRunning,
      checkInterval: this.checkInterval,
      staleThreshold: this.staleProcessingThreshold
    };
  }
}

export const processingHealthMonitor = new ProcessingHealthMonitor();
