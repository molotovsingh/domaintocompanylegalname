import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processor } from "./services/processor";
import multer from 'multer';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getProcessingStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload domain file
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log(`Upload received: ${req.file.originalname}, size: ${req.file.size} bytes`);
      const content = req.file.buffer.toString('utf-8');
      console.log(`File content preview (first 200 chars): ${content.substring(0, 200)}`);
      
      const domains = parseDomainFile(content, req.file.originalname);
      console.log(`Parsed domains count before deduplication: ${domains.length}`);
      
      // Remove duplicates while preserving order
      const uniqueDomains = [...new Set(domains)];
      console.log(`Unique domains count after deduplication: ${uniqueDomains.length}`);
      console.log(`First 10 unique domains: ${uniqueDomains.slice(0, 10).join(', ')}`);
      
      if (uniqueDomains.length === 0) {
        return res.status(400).json({ error: 'No valid domains found in file' });
      }

      // Check for existing successful domains to avoid reprocessing
      const newDomainsOnly: string[] = [];
      const skippedDomains: string[] = [];
      
      console.log('Checking for existing successful records...');
      for (const domain of uniqueDomains) {
        const existingSuccess = await storage.getHighConfidenceResult(domain.trim());
        if (existingSuccess && existingSuccess.confidenceScore && existingSuccess.confidenceScore >= 85) {
          skippedDomains.push(domain);
          console.log(`Skipping ${domain} - already has high confidence result (${existingSuccess.confidenceScore}%)`);
        } else {
          newDomainsOnly.push(domain);
        }
      }

      console.log(`${newDomainsOnly.length} new domains to process, ${skippedDomains.length} skipped (already successful)`);

      if (newDomainsOnly.length === 0) {
        return res.status(200).json({ 
          message: 'All domains already have high-confidence results',
          domainCount: 0,
          duplicatesRemoved: domains.length - uniqueDomains.length,
          existingSuccessful: skippedDomains.length
        });
      }

      const batchId = nanoid();
      
      // Create batch
      const batch = await storage.createBatch({
        id: batchId,
        fileName: req.file.originalname || 'unknown',
        totalDomains: newDomainsOnly.length,
        status: 'pending'
      });

      // Create domain records only for new domains
      console.log(`Creating ${newDomainsOnly.length} domain records...`);
      await Promise.all(newDomainsOnly.map(domain => 
        storage.createDomain({
          domain: domain.trim(),
          batchId,
          status: 'pending',
          retryCount: 0
        })
      ));

      // Log activity
      await storage.createActivity({
        type: 'batch_upload',
        message: `New file uploaded: ${req.file.originalname}`,
        details: JSON.stringify({ 
          batchId, 
          domainCount: newDomainsOnly.length, 
          duplicatesRemoved: domains.length - uniqueDomains.length,
          existingSuccessful: skippedDomains.length,
          totalOriginal: domains.length
        })
      });

      console.log(`Upload complete: ${newDomainsOnly.length} new domains stored in batch ${batchId}, ${skippedDomains.length} skipped (already successful)`);
      res.json({ 
        batchId, 
        fileName: req.file.originalname,
        domainCount: newDomainsOnly.length,
        duplicatesRemoved: domains.length - uniqueDomains.length,
        existingSuccessful: skippedDomains.length,
        message: `File uploaded successfully. ${newDomainsOnly.length} new domains to process, ${skippedDomains.length} already have high-confidence results.` 
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start processing a batch
  app.post("/api/process/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      
      if (processor.isCurrentlyProcessing()) {
        return res.status(400).json({ error: 'Another batch is currently being processed' });
      }

      // Start processing in background
      processor.processBatch(batchId).catch(console.error);

      res.json({ message: 'Processing started', batchId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get batch results
  app.get("/api/results/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { page = "1", limit = "50", status, search } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let domains;
      if (search) {
        domains = await storage.searchDomains(search as string, limitNum, offset);
      } else {
        domains = await storage.getDomainsByBatch(batchId, limitNum, offset);
      }

      // Filter by status if provided
      if (status && status !== 'all') {
        domains = domains.filter(d => d.status === status);
      }

      const batch = await storage.getBatch(batchId);
      
      res.json({
        domains,
        batch,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: batch?.totalDomains || 0
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get session results for QC and feedback
  app.get("/api/session-results/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const sessionResults = await storage.getSessionResults(batchId);
      
      if (!sessionResults) {
        return res.status(404).json({ error: "Session results not found" });
      }

      res.json(sessionResults);
    } catch (error) {
      console.error('Session results error:', error);
      res.status(500).json({ error: "Failed to get session results" });
    }
  });

  // Get all session results for QC dashboard
  app.get("/api/session-results", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const sessionResults = await storage.getAllSessionResults(limit, offset);
      res.json(sessionResults);
    } catch (error) {
      console.error('All session results error:', error);
      res.status(500).json({ error: "Failed to get session results" });
    }
  });

  // Get analytics data for time-based performance tracking
  app.get("/api/analytics", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const analyticsData = await storage.getAnalyticsData(limit, offset);
      res.json(analyticsData);
    } catch (error) {
      console.error('Analytics data error:', error);
      res.status(500).json({ error: "Failed to get analytics data" });
    }
  });

  // Export batch results in CSV or JSON format
  app.get("/api/export/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const format = req.query.format as string || 'csv';
      
      const domains = await storage.getDomainsByBatch(batchId, 10000); // Get all domains
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}_results.json"`);
        res.json(domains);
      } else {
        // CSV format
        const csvContent = domainsToCSV(domains);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="batch_${batchId}_results.csv"`);
        res.send(csvContent);
      }
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: "Failed to export batch results" });
    }
  });

  // Export results
  app.get("/api/export/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { format = 'csv' } = req.query;
      
      const domains = await storage.getDomainsByBatch(batchId, 100000);
      
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="domains_${batchId}.json"`);
        res.json(domains);
      } else {
        // CSV format
        const csvContent = domainsToCSV(domains);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="domains_${batchId}.csv"`);
        res.send(csvContent);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get recent activities
  app.get("/api/activities", async (req, res) => {
    try {
      const { limit = "20" } = req.query;
      const activities = await storage.getActivities(parseInt(limit as string));
      res.json(activities);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test single domain
  app.post("/api/test-domain", async (req, res) => {
    try {
      const { domain } = req.body;
      
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'Domain is required' });
      }

      const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      if (!isValidDomain(cleanDomain)) {
        return res.status(400).json({ error: 'Invalid domain format' });
      }

      console.log(`Testing single domain: ${cleanDomain}`);
      
      // Get or create the shared "Single Domain Tests" batch
      const sharedBatchId = 'single-domain-tests';
      let batch = await storage.getBatch(sharedBatchId);
      
      if (!batch) {
        // Create the shared batch for all single domain tests
        batch = await storage.createBatch({
          id: sharedBatchId,
          fileName: 'Single Domain Tests',
          totalDomains: 0,
          processedDomains: 0,
          status: 'active'
        });
      }

      // Create the domain entry in the shared batch
      const domainEntry = await storage.createDomain({
        domain: cleanDomain,
        batchId: sharedBatchId,
        status: 'pending'
      });

      // Process the domain
      const result = await processor.processSingleDomain(domainEntry);
      
      // Update batch counts
      await storage.updateBatch(sharedBatchId, {
        totalDomains: (batch.totalDomains || 0) + 1,
        processedDomains: (batch.processedDomains || 0) + 1,
        status: 'active'
      });
      
      res.json({
        domain: result.domain,
        status: result.status,
        companyName: result.companyName,
        extractionMethod: result.extractionMethod,
        confidenceScore: result.confidenceScore,
        processingTimeMs: result.processingTimeMs,
        failureCategory: result.failureCategory,
        errorMessage: result.errorMessage,
        recommendation: result.recommendation
      });

    } catch (error: any) {
      console.error('Single domain test error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear database
  app.delete("/api/database/clear", async (req, res) => {
    try {
      // This will be handled by the PostgreSQL storage implementation
      if (typeof storage.clearDatabase === 'function') {
        await storage.clearDatabase();
        res.json({ message: "Database cleared successfully" });
      } else {
        res.status(501).json({ error: "Database clearing not implemented for current storage" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Level 2 GLEIF API Endpoints (V2 Enhancement)
  
  // Get GLEIF candidates for a domain
  app.get("/api/domains/:id/candidates", async (req, res) => {
    try {
      const domainId = parseInt(req.params.id);
      
      if (typeof storage.getGleifCandidates === 'function') {
        const candidates = await storage.getGleifCandidates(domainId);
        res.json(candidates);
      } else {
        res.status(501).json({ error: "GLEIF candidates not supported by current storage" });
      }
    } catch (error: any) {
      console.error('Get GLEIF candidates error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update primary GLEIF selection for a domain
  app.post("/api/domains/:id/select-candidate", async (req, res) => {
    try {
      const domainId = parseInt(req.params.id);
      const { leiCode } = req.body;
      
      if (!leiCode) {
        return res.status(400).json({ error: 'LEI code is required' });
      }
      
      if (typeof storage.updatePrimarySelection === 'function') {
        const updatedDomain = await storage.updatePrimarySelection(domainId, leiCode);
        if (updatedDomain) {
          res.json(updatedDomain);
        } else {
          res.status(404).json({ error: 'Domain or candidate not found' });
        }
      } else {
        res.status(501).json({ error: "Primary selection update not supported by current storage" });
      }
    } catch (error: any) {
      console.error('Update primary selection error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get manual review queue
  app.get("/api/manual-review-queue", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (typeof storage.getManualReviewQueue === 'function') {
        const domains = await storage.getManualReviewQueue(limit, offset);
        res.json(domains);
      } else {
        res.status(501).json({ error: "Manual review queue not supported by current storage" });
      }
    } catch (error: any) {
      console.error('Manual review queue error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get domains eligible for Level 2 processing
  app.get("/api/level2-eligible", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (typeof storage.getLevel2EligibleDomains === 'function') {
        const domains = await storage.getLevel2EligibleDomains(limit, offset);
        res.json(domains);
      } else {
        res.status(501).json({ error: "Level 2 processing not supported by current storage" });
      }
    } catch (error: any) {
      console.error('Level 2 eligible domains error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Level 2 analytics
  app.get("/api/analytics/level2", async (req, res) => {
    try {
      if (storage.getGleifCandidates && storage.getDomainsByStatus) {
        // Calculate Level 2 analytics from available data
        const allDomains = await storage.getDomainsByStatus('success');
        const failedDomains = await storage.getDomainsByStatus('failed');
        
        // Filter domains that had Level 2 processing
        const level2Domains = [...allDomains, ...failedDomains].filter(d => d.level2Attempted);
        const successfulMatches = level2Domains.filter(d => d.level2Status === 'success');
        const failedMatches = level2Domains.filter(d => d.level2Status === 'failed');
        
        // Calculate aggregate statistics
        const totalLevel2Attempts = level2Domains.length;
        const averageWeightedScore = successfulMatches.length > 0 
          ? successfulMatches.reduce((sum, d) => sum + (d.confidenceScore || 0), 0) / successfulMatches.length
          : 0;

        // Get all candidates to calculate totals
        let totalCandidatesFound = 0;
        let jurisdictionCounts: Record<string, number> = {};
        let statusCounts: Record<string, number> = {};

        for (const domain of level2Domains) {
          try {
            const candidates = await storage.getGleifCandidates!(domain.id);
            totalCandidatesFound += candidates.length;
            
            candidates.forEach(candidate => {
              if (candidate.jurisdiction) {
                jurisdictionCounts[candidate.jurisdiction] = (jurisdictionCounts[candidate.jurisdiction] || 0) + 1;
              }
              if (candidate.entityStatus) {
                statusCounts[candidate.entityStatus] = (statusCounts[candidate.entityStatus] || 0) + 1;
              }
            });
          } catch (err) {
            // Skip if candidates can't be retrieved
          }
        }

        const analytics = {
          totalLevel2Attempts,
          successfulMatches: successfulMatches.length,
          failedMatches: failedMatches.length,
          averageWeightedScore,
          totalCandidatesFound,
          averageCandidatesPerDomain: totalLevel2Attempts > 0 ? totalCandidatesFound / totalLevel2Attempts : 0,
          topJurisdictions: Object.entries(jurisdictionCounts)
            .map(([jurisdiction, count]) => ({ jurisdiction, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          entityStatusBreakdown: Object.entries(statusCounts)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
          confidenceImprovements: successfulMatches.filter(d => (d.confidenceScore || 0) > 70).length,
          manualReviewQueue: level2Domains.filter(d => d.level2Status === 'candidates_found' && !d.primaryLeiCode).length
        };

        res.json(analytics);
      } else {
        // Return empty analytics for storage types that don't support Level 2
        res.json({
          totalLevel2Attempts: 0,
          successfulMatches: 0,
          failedMatches: 0,
          averageWeightedScore: 0,
          totalCandidatesFound: 0,
          averageCandidatesPerDomain: 0,
          topJurisdictions: [],
          entityStatusBreakdown: [],
          confidenceImprovements: 0,
          manualReviewQueue: 0
        });
      }
    } catch (error: any) {
      console.error('Level 2 analytics error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get batches
  app.get("/api/batches", async (req, res) => {
    try {
      const { limit = "10" } = req.query;
      const batches = await storage.getBatches(parseInt(limit as string));
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to parse domain file
function parseDomainFile(content: string, filename: string): string[] {
  const isCSV = filename.toLowerCase().endsWith('.csv');
  
  console.log(`Parsing file: ${filename}, isCSV: ${isCSV}, content length: ${content.length}`);
  
  let lines: string[];
  if (isCSV) {
    lines = content
      .split('\n')
      .map(line => line.split(',')[0]?.trim()) // Take first column
      .filter(line => line && line.length > 0);
  } else {
    // Text file - one domain per line
    lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.length > 0);
  }
  
  console.log(`Found ${lines.length} non-empty lines`);
  
  const validDomains = lines.filter(domain => isValidDomain(domain));
  console.log(`${validDomains.length} domains passed validation out of ${lines.length} total lines`);
  
  // Log first few invalid domains for debugging
  const invalidDomains = lines.filter(domain => !isValidDomain(domain)).slice(0, 5);
  if (invalidDomains.length > 0) {
    console.log(`First few invalid domains:`, invalidDomains);
  }
  
  return validDomains;
}

// Helper function to validate domain
function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  
  // Clean the domain first
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')     // Remove protocol
    .replace(/^www\./, '')           // Remove www
    .split('/')[0]                   // Take only domain part
    .trim()                          // Remove whitespace
    .toLowerCase();                  // Normalize case
  
  // More permissive regex - allow single character domains and broader TLDs
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.([a-zA-Z]{2,}|[a-zA-Z]{2,}\.[a-zA-Z]{2,})$/;
  const isValid = domainRegex.test(cleanDomain);
  
  // Debug logging for domain validation issues
  if (!isValid && domain.trim().length > 0) {
    console.log(`Domain validation failed for: "${domain}" -> cleaned: "${cleanDomain}"`);
  }
  
  return isValid;
}

// Helper function to convert domains to CSV
function domainsToCSV(domains: any[]): string {
  const headers = [
    'Domain', 
    'Company Name', 
    'Business Category', 
    'Extraction Method', 
    'Confidence', 
    'GLEIF Status', 
    'LEI Code', 
    'Recommendation', 
    'Processing Time (ms)', 
    'Status', 
    'Processed At'
  ];
  
  const rows = domains.map(d => [
    d.domain,
    d.companyName || '',
    d.businessCategory || '',
    d.extractionMethod || '',
    d.confidenceScore || '',
    d.gleifStatus || '',
    d.leiCode || '',
    d.recommendation || '',
    d.processingTime || '',
    d.status,
    d.processedAt ? new Date(d.processedAt).toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}
