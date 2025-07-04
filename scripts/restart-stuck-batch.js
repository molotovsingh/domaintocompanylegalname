#!/usr/bin/env node

/**
 * Emergency Stuck Batch Restart Script
 * Clears stuck domains and restarts batch processing
 */

import { processor } from '../server/services/processor.js';
import { storage } from '../server/pgStorage.js';

async function restartStuckBatch(batchId) {
  console.log(`🔄 Restarting stuck batch: ${batchId}`);
  
  try {
    // 1. Find all stuck domains (pending for >30 minutes or processing for >5 minutes)
    const pendingDomains = await storage.getDomainsByBatch(batchId, 1000);
    const stuckDomains = pendingDomains.filter(domain => {
      const createdAt = new Date(domain.createdAt);
      const minutesAgo = (Date.now() - createdAt.getTime()) / 60000;
      
      return (domain.status === 'pending' && minutesAgo > 30) ||
             (domain.status === 'processing' && minutesAgo > 5);
    });
    
    console.log(`📋 Found ${stuckDomains.length} stuck domains to restart`);
    
    // 2. Clear stuck domains back to pending
    for (const domain of stuckDomains) {
      await storage.updateDomain(domain.id, {
        status: 'pending',
        processingStartedAt: null,
        technicalDetails: 'Restarted by stuck batch script'
      });
      console.log(`✅ Cleared ${domain.domain} back to pending`);
    }
    
    // 3. Restart batch processing
    console.log(`🚀 Starting batch processing for ${batchId}`);
    await processor.processBatch(batchId);
    
    console.log(`✅ Batch processing restarted successfully`);
    
  } catch (error) {
    console.error('❌ Error restarting batch:', error);
    throw error;
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error('Usage: node restart-stuck-batch.js <batch-id>');
    process.exit(1);
  }
  
  restartStuckBatch(batchId)
    .then(() => {
      console.log('✅ Batch restart completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Batch restart failed:', error);
      process.exit(1);
    });
}

export { restartStuckBatch };