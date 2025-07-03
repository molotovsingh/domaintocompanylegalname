import { storage } from '../storage';

/**
 * Stuck Domain Monitor Service
 * Automatically detects and clears domains that get stuck in processing status
 * Runs as a background service to prevent batch processing stalls
 */
export class StuckDomainMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly maxProcessingTime = 8000; // 8 seconds - aligned with extraction timeout
  private readonly monitorInterval = 3000; // Check every 3 seconds for fastest Cloudflare recovery

  start(): void {
    if (this.isRunning) {
      console.log('Stuck domain monitor already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting stuck domain monitor - checking every 3 seconds for ultra-fast bot detection');

    // Run immediately, then on interval
    this.checkStuckDomains();
    this.intervalId = setInterval(() => {
      this.checkStuckDomains();
    }, this.monitorInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Stuck domain monitor stopped');
  }

  private async checkStuckDomains(): Promise<void> {
    try {
      // Find domains stuck in processing status
      const allDomains = await storage.getDomainsByStatus('processing');
      const stuckDomains = allDomains.filter((domain: any) => {
        if (domain.status !== 'processing' || !domain.processingStartedAt) {
          return false;
        }

        const processingTime = Date.now() - new Date(domain.processingStartedAt).getTime();
        return processingTime > this.maxProcessingTime;
      });

      if (stuckDomains.length > 0) {
        console.log(`STUCK DOMAIN DETECTION: Found ${stuckDomains.length} stuck domains`);

        for (const domain of stuckDomains) {
          const processingTime = Date.now() - new Date(domain.processingStartedAt!).getTime();
          console.log(`CLEARING STUCK DOMAIN: ${domain.domain} (stuck for ${Math.round(processingTime/1000)}s)`);

          await storage.updateDomain(domain.id, {
            status: 'failed',
            errorMessage: 'Domain processing timeout - automatically cleared by monitor',
            failureCategory: 'technical_timeout',
            technicalDetails: `Processing exceeded ${this.maxProcessingTime}ms limit, cleared by monitor`,
            processedAt: new Date(),
            processingTimeMs: processingTime
          });
        }

        console.log(`STUCK DOMAIN CLEANUP: Cleared ${stuckDomains.length} stuck domains`);
      }
    } catch (error: any) {
      console.error('Error in stuck domain monitor:', error.message);
    }
  }

  getStatus(): { running: boolean; maxProcessingTime: number; monitorInterval: number } {
    return {
      running: this.isRunning,
      maxProcessingTime: this.maxProcessingTime,
      monitorInterval: this.monitorInterval
    };
  }
}

// Export singleton instance
export const stuckDomainMonitor = new StuckDomainMonitor();