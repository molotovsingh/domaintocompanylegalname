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

      const batchId = nanoid();
      
      // Create batch
      const batch = await storage.createBatch({
        id: batchId,
        fileName: req.file.originalname || 'unknown',
        totalDomains: uniqueDomains.length,
        status: 'pending'
      });

      // Create domain records
      console.log(`Creating ${uniqueDomains.length} domain records...`);
      await Promise.all(uniqueDomains.map(domain => 
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
        details: JSON.stringify({ batchId, domainCount: uniqueDomains.length, duplicatesRemoved: domains.length - uniqueDomains.length })
      });

      console.log(`Upload complete: ${uniqueDomains.length} unique domains stored in batch ${batchId}`);
      res.json({ 
        batchId, 
        fileName: req.file.originalname,
        domainCount: uniqueDomains.length,
        duplicatesRemoved: domains.length - uniqueDomains.length,
        message: 'File uploaded successfully' 
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
  const headers = ['Domain', 'Company Name', 'Method', 'Confidence', 'Status', 'Processed At'];
  const rows = domains.map(d => [
    d.domain,
    d.companyName || '',
    d.extractionMethod || '',
    d.confidenceScore || '',
    d.status,
    d.processedAt ? new Date(d.processedAt).toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}
