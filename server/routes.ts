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

      const content = req.file.buffer.toString('utf-8');
      const domains = parseDomainFile(content, req.file.originalname);
      
      if (domains.length === 0) {
        return res.status(400).json({ error: 'No valid domains found in file' });
      }

      const batchId = nanoid();
      
      // Create batch
      const batch = await storage.createBatch({
        id: batchId,
        fileName: req.file.originalname || 'unknown',
        totalDomains: domains.length,
        status: 'pending'
      });

      // Create domain records
      await Promise.all(domains.map(domain => 
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
        details: JSON.stringify({ batchId, domainCount: domains.length })
      });

      res.json({ 
        batchId, 
        fileName: req.file.originalname,
        domainCount: domains.length,
        message: 'File uploaded successfully' 
      });

    } catch (error: any) {
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
  
  if (isCSV) {
    return content
      .split('\n')
      .map(line => line.split(',')[0]?.trim()) // Take first column
      .filter(domain => domain && isValidDomain(domain));
  } else {
    // Text file - one domain per line
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(domain => domain && isValidDomain(domain));
  }
}

// Helper function to validate domain
function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return domainRegex.test(cleanDomain);
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
