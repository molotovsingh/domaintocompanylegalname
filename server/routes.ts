import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./pgStorage";
import { processor } from "./services/processor";
import multer from 'multer';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { db } from "./db";
import { gleifCandidates, type Domain } from "../shared/schema";
import { sql, inArray, eq, asc } from "drizzle-orm";
import { generateDomainHash } from "../shared/domain-hash";
import { addNormalizedExportRoute } from "./routes-normalized";
import { addWideExportRoute } from "./routes-wide";
import { enhancedExportService } from "./services/enhancedExportService";
import { defaultExportFields, comprehensiveExportFields } from "../shared/enhanced-export-schema";
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { Request, Response } from 'express';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Register both database architecture approaches for comparison
  addNormalizedExportRoute(app);
  addWideExportRoute(app);

  // Basic processing statistics
  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getProcessingStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get stats' });
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
      await Promise.all(newDomainsOnly.map(domain => {
        const cleanDomain = domain.trim();
        return storage.createDomain({
          domainHash: generateDomainHash(cleanDomain),
          domain: cleanDomain,
          batchId,
          status: 'pending',
          retryCount: 0
        });
      }));

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

  // Process batch
  app.post("/api/process/:batchId", async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;

      if (processor.isCurrentlyProcessing()) {
        return res.status(400).json({ error: 'Another batch is currently being processed' });
      }

      processor.processBatch(batchId).catch(console.error);

      res.json({ message: "Processing started", batchId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stop processing
  app.post("/api/stop-processing", async (req: Request, res: Response) => {
    try {
      const stopped = processor.stopProcessing();

      if (stopped) {
        res.json({ 
          message: "Processing stopped successfully",
          stopped: true 
        });
      } else {
        res.json({ 
          message: "No active processing to stop",
          stopped: false 
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reset Level 2 status for a batch
  app.post("/api/batches/:batchId/reset-level2", async (req, res) => {
    try {
      const { batchId } = req.params;

      // Get all domains in the batch
      const domains = await storage.getDomainsByBatch(batchId, undefined, 10000);

      let resetCount = 0;
      for (const domain of domains) {
        if (domain.level2Attempted) {
          await storage.updateDomain(domain.id, {
            level2Attempted: false,
            level2Status: null,
            level2CandidatesCount: null,
            level2ProcessingTimeMs: null,
            primaryLeiCode: null,
            primaryGleifName: null,
            primarySelectionConfidence: null,
            selectionAlgorithm: null,
            manualReviewRequired: null,
            selectionNotes: null
          });
          resetCount++;
        }
      }

      // Clear GLEIF candidates if the storage supports it
      if (typeof storage.clearGleifCandidatesForBatch === 'function') {
        await storage.clearGleifCandidatesForBatch(batchId);
      }

      await storage.createActivity({
        type: 'level2_reset',
        message: `Level 2 processing reset for batch: ${batchId}`,
        details: JSON.stringify({ batchId, resetCount })
      });

      res.json({ 
        message: `Level 2 processing reset for ${resetCount} domains in batch ${batchId}`,
        resetCount,
        batchId
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger Level 2 processing for a batch
  app.post("/api/batches/:batchId/trigger-level2", async (req, res) => {
    try {
      const { batchId } = req.params;

      if (processor.isCurrentlyProcessing()) {
        return res.status(400).json({ 
          message: "Cannot start Level 2 processing while batch processing is active"
        });
      }

      // Get all domains in the batch that are eligible for Level 2
      const domains = await storage.getDomainsByBatch(batchId, 10000, 0);

      console.log(`🔍 Level 2 Debug: Found ${domains.length} total domains in batch`);
      console.log(`🔍 Level 2 Debug: Domains with company names:`, 
        domains.filter(d => d.companyName).map(d => `${d.domain}: "${d.companyName}" (${d.status}, ${d.confidenceScore}%, attempted: ${d.level2Attempted})`));

      const level2Eligible = domains.filter(domain => {
        const eligible = !domain.level2Attempted && (
          (domain.status === 'failed' && domain.companyName && domain.companyName.length > 2) ||
          (domain.status === 'success' && (domain.confidenceScore || 0) < 95) ||
          (domain.failureCategory === 'Protected - Manual Review') ||
          (domain.failureCategory === 'incomplete_low_priority' && domain.companyName) ||
          (domain.status === 'success' && domain.companyName && domain.companyName.length > 3)
        );

        if (domain.companyName) {
          console.log(`🔍 Level 2 Debug: ${domain.domain} (${domain.companyName}) - Eligible: ${eligible}`);
          console.log(`   Status: ${domain.status}, Confidence: ${domain.confidenceScore}, Attempted: ${domain.level2Attempted}`);
        }

        return eligible;
      });

      // Check for domains already marked as pending for Level 2
      const pendingLevel2Domains = domains.filter(d => d.level2Status === 'pending');

      if (level2Eligible.length === 0 && pendingLevel2Domains.length === 0) {
        return res.json({ 
          message: "No domains eligible for Level 2 processing in this batch",
          eligibleCount: 0,
          batchId
        });
      }

      // Use pending domains if available, otherwise use eligible domains
      const domainsToProcess = pendingLevel2Domains.length > 0 ? pendingLevel2Domains : level2Eligible;

      // Start Level 2 processing in background
      processor.processLevel2ForBatch(batchId, domainsToProcess);

      await storage.createActivity({
        type: 'level2_triggered',
        message: `Level 2 processing manually triggered for batch: ${batchId}`,
        details: JSON.stringify({ batchId, eligibleCount: domainsToProcess.length })
      });

      res.json({ 
        message: `Level 2 processing started for ${domainsToProcess.length} domains`,
        eligibleCount: domainsToProcess.length,
        batchId
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get batch results
  app.get("/api/results/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { page = "1", limit = "50", status, search } = req.query;

      console.log(`🔍 Getting results for batch: ${batchId}, status: ${status}, search: ${search}`);

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let domains: Domain[];
      if (search) {
        domains = await storage.searchDomains(search as string, limitNum, offset);
      } else {
        // Use separate method for status filtering to match interface
        const statusFilter = status && status !== 'all' ? status as string : undefined;
        console.log(`🔍 Calling getDomainsByBatch with: batchId=${batchId}, status=${statusFilter}, limit=${limitNum}, offset=${offset}`);

        if (statusFilter && storage.getDomainsByBatchWithStatus) {
          domains = await storage.getDomainsByBatchWithStatus(batchId, statusFilter, limitNum, offset);
        } else {
          domains = await storage.getDomainsByBatch(batchId, limitNum, offset);
        }
      }

      console.log(`✅ Found ${domains.length} domains for batch ${batchId}`);

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
      console.error(`❌ Error in /api/results/:batchId:`, error);
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

  // Session Results - Simplified for fast loading
  app.get('/api/session-results', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      // Get recent batches with basic metrics only
      const batches = await storage.getRecentBatches(limit);

      const sessionResults = batches.map(batch => ({
        batchId: batch.id,
        fileName: batch.fileName,
        uploadedAt: batch.uploadedAt,
        totalDomains: batch.totalDomains,
        processedDomains: batch.processedDomains || 0,
        successfulDomains: batch.successfulDomains || 0,
        successRate: (batch.processedDomains || 0) > 0 ? 
          Math.round((batch.successfulDomains || 0) / (batch.processedDomains || 1) * 100 * 10) / 10 : 0,
        status: batch.status
      }));

      res.json(sessionResults);
    } catch (error: any) {
      console.error('Error getting session results:', error);
      res.status(500).json({ error: 'Failed to get session results' });
    }
  });

  // Analytics - Essential batch history only
  app.get('/api/analytics', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

      // Get basic batch data for analytics
      const batches = await storage.getRecentBatches(limit);

      const analytics = batches.map(batch => ({
        batchId: batch.id,
        fileName: batch.fileName,
        uploadedAt: batch.uploadedAt?.toISOString(),
        totalDomains: batch.totalDomains,
        processedDomains: batch.processedDomains || 0,
        successfulDomains: batch.successfulDomains || 0,
        failedDomains: (batch.processedDomains || 0) - (batch.successfulDomains || 0),
        successRate: (batch.processedDomains || 0) > 0 ? 
          Math.round((batch.successfulDomains || 0) / (batch.processedDomains || 1) * 100 * 10) / 10 : 0,
        status: batch.status
      }));

    res.json(analytics);
  } catch (error: any) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

  // Standard export - original implementation for UI compatibility
  app.get("/api/export/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { format = 'csv' } = req.query;

      // Get all domains first
      const domains = await storage.getDomainsByBatch(batchId, undefined, 100000);

      // Process each domain to add GLEIF data if the method exists
      const enhancedDomains = [];
      for (const domain of domains) {
        let candidates: any[] = [];

        // Safely try to get GLEIF candidates
        if (typeof storage.getGleifCandidates === 'function') {
          try {
            candidates = await storage.getGleifCandidates(domain.id);
          } catch (err) {
            console.warn(`Could not get GLEIF candidates for domain ${domain.id}:`, err);
            candidates = [];
          }
        }

        enhancedDomains.push({
          id: domain.id,
          domain: domain.domain,
          companyName: domain.companyName,
          extractionMethod: domain.extractionMethod,
          confidenceScore: domain.confidenceScore,
          primaryLeiCode: domain.primaryLeiCode,
          primaryGleifName: domain.primaryGleifName,
          guessedCountry: domain.guessedCountry,
          gleifCandidateCount: candidates.length,
          allLeiCodes: candidates.map(c => c.leiCode).join('; '),
          allLegalNames: candidates.map(c => c.legalName).join('; '),
          allJurisdictions: candidates.map(c => c.jurisdiction).join('; '),
          allEntityStatuses: candidates.map(c => c.entityStatus).join('; '),
          level2Status: domain.level2Status,
          level2CandidatesCount: domain.level2CandidatesCount,
          finalLegalName: domain.finalLegalName,
          finalConfidence: domain.finalConfidence,
          recommendation: domain.recommendation,
          processingTimeMs: domain.processingTimeMs,
          status: domain.status,
          errorMessage: domain.errorMessage,
          failureCategory: domain.failureCategory,
          technicalDetails: domain.technicalDetails,
          retryCount: domain.retryCount,
          createdAt: domain.createdAt,
          processedAt: domain.processedAt
        });
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="domains_${batchId}.json"`);
        res.json(enhancedDomains);
      } else {
        // CSV format
        const csvContent = domainsToCSV(enhancedDomains);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="domains_${batchId}.csv"`);
        res.send(csvContent);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Enhanced export - comprehensive business intelligence export
  app.get("/api/export-enhanced/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { 
        format = 'csv',
        includeGleifCandidates = 'true',
        includeRelationships = 'true', 
        includeEntityMappings = 'true',
        qualityThreshold,
        fields = 'default'
      } = req.query;

      const options = {
        format: format as 'csv' | 'json' | 'xlsx',
        includeGleifCandidates: includeGleifCandidates === 'true',
        includeRelationships: includeRelationships === 'true',
        includeEntityMappings: includeEntityMappings === 'true',
        qualityThreshold: qualityThreshold ? parseInt(qualityThreshold as string) : undefined,
        fields: fields === 'comprehensive' ? comprehensiveExportFields : 
                fields === 'default' ? defaultExportFields :
                (fields as string).split(',')
      };

      const enhancedRecords = await enhancedExportService.generateEnhancedExport(batchId, options);
      const exportContent = enhancedExportService.formatExport(enhancedRecords, options.format, options.fields);

      // Set appropriate headers based on format
      const fileExtension = options.format === 'xlsx' ? 'xlsx' : options.format;
      const contentType = {
        'csv': 'text/csv',
        'json': 'application/json',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }[options.format];

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="enhanced_export_${batchId}.${fileExtension}"`);

      if (options.format === 'xlsx') {
        res.send(exportContent);
      } else {
        res.send(exportContent);
      }

    } catch (error: any) {
      console.error('Enhanced export error:', error);
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
        domainHash: generateDomainHash(cleanDomain),
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
        recommendation: result.recommendation,
        // GLEIF Assessment Results
        level2Status: result.level2Status,
        level2CandidatesCount: result.level2CandidatesCount,
        primaryLeiCode: result.primaryLeiCode,
        primaryGleifName: result.primaryGleifName,
        finalLegalName: result.finalLegalName,
        primarySelectionConfidence: result.primarySelectionConfidence,
        selectionAlgorithm: result.selectionAlgorithm,
        // Geographic Intelligence
        guessedCountry: result.guessedCountry,
        geographicPresence: result.geographicPresence
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

  // Get processing stats
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getProcessingStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get batches
  app.get("/api/batches", async (req, res) => {
    try {
      const { limit = "10" } = req.query;
      const batches = await storage.getBatches(parseInt(limit as string));
      res.json(batches);
    } catch (error: any){
      res.status(500).json({ error: error.message });
    }
  });
// ===== BATCH LOGGING API ENDPOINTS =====

  // Get batch log files
  app.get('/api/logs/batches', async (req, res) => {
    try {
      const logsDir = join(process.cwd(), 'logs');

      if (!existsSync(logsDir)) {
        return res.json({ 
          batches: [], 
          message: 'No logs directory found - start processing a batch to generate logs' 
        });
      }

      const files = readdirSync(logsDir);
      const batchLogs = files
        .filter(file => file.startsWith('batch-') && file.endsWith('.jsonl'))
        .map(file => {
          const batchId = file.replace('batch-', '').replace('.jsonl', '');
          const filePath = join(logsDir, file);

          try {
            const content = readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            const firstEntry = lines.length > 0 ? JSON.parse(lines[0]) : null;
            const lastEntry = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;

            return {
              batchId,
              fileName: file,
              totalEvents: lines.length,
              startTime: firstEntry?.timestamp,
              lastEvent: lastEntry?.timestamp,
              lastEventType: lastEntry?.event,
              size: readFileSync(filePath).length
            };
          } catch (error) {
            return {
              batchId,
              fileName: file,
              error: 'Failed to parse log file',
              size: readFileSync(filePath).length
            };
          }
        })
        .sort((a, b) => (b.lastEvent || '').localeCompare(a.lastEvent || ''));

      res.json({ batches: batchLogs });
    } catch (error) {
      console.error('Error reading batch logs:', error);
      res.status(500).json({ error: 'Failed to read batch logs' });
    }
  });

  // Get specific batch log
  app.get('/api/logs/batch/:batchId', async (req, res) => {
    try {
      const { batchId } = req.params;
      const logsDir = join(process.cwd(), 'logs');
      const logFile = join(logsDir, `batch-${batchId}.jsonl`);

      if (!existsSync(logFile)) {
        return res.status(404).json({ error: 'Batch log not found' });
      }

      const content = readFileSync(logFile, 'utf8');
      const entries = content.trim().split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      res.json({
        batchId,
        totalEntries: entries.length,
        entries: entries
      });
    } catch (error) {
      console.error('Error reading batch log:', error);
      res.status(500).json({ error: 'Failed to read batch log' });
    }
  });

  // Get AI analysis summary for a batch
  app.get('/api/logs/analysis/:batchId', async (req, res) => {
    try {
      const { batchId } = req.params;
      const logsDir = join(process.cwd(), 'logs');
      const analysisFile = join(logsDir, `analysis-${batchId}.json`);

      if (!existsSync(analysisFile)) {
        return res.status(404).json({ 
          error: 'Analysis not found',
          message: 'AI analysis summary will be generated when batch completes'
        });
      }

      const analysis = JSON.parse(readFileSync(analysisFile, 'utf8'));
      res.json(analysis);
    } catch (error) {
      console.error('Error reading analysis:', error);
      res.status(500).json({ error: 'Failed to read analysis' });    }
  });

  // Batch Recovery API Endpoints
  app.post("/api/batches/:batchId/recover", async (req, res) => {
    try {
      const { batchId } = req.params;

      // Find domains stuck in processing status
      const stuckDomains = await storage.getDomainsByBatchWithStatus?.(batchId, 'processing') || [];

      if (stuckDomains.length === 0) {
        return res.json({ 
          success: true, 
          cleared: 0, 
          restarted: false,
          message: 'No stuck domains found' 
        });
      }

      // Clear stuck domains (mark as failed)
      let clearedCount = 0;
      for (const domain of stuckDomains) {
        await storage.updateDomain(domain.id, {
          status: 'failed',
          companyName: null,
          confidenceScore: 0,
          recommendation: 'Manual recovery cleared stuck processing',
          failureCategory: 'timeout',
          technicalDetails: 'Stuck in processing - cleared by manual recovery',
          errorMessage: 'Processing timeout - cleared by recovery system'
        });
        clearedCount++;
      }

      // Check if batch has pending domains
      const pendingDomains = await storage.getDomainsByBatchWithStatus?.(batchId, 'pending') || [];
      const hasRestarted = pendingDomains.length > 0;

      console.log(`✅ Manual recovery: cleared ${clearedCount} stuck domains from batch ${batchId}`);

      res.json({
        success: true,
        cleared: clearedCount,
        restarted: hasRestarted,
        message: `Cleared ${clearedCount} stuck domains. ${hasRestarted ? 'Processing can be restarted.' : 'No pending domains to process.'}`
      });

    } catch (error: any) {
      console.error('Batch recovery error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get stuck domains for a batch (diagnostic endpoint)
  app.get("/api/batches/:batchId/stuck", async (req, res) => {
    try {
      const { batchId } = req.params;
      const stuckDomains = await storage.getDomainsByBatchWithStatus?.(batchId, 'processing') || [];

      res.json({
        batchId,
        stuckCount: stuckDomains.length,
        stuckDomains: stuckDomains.map(d => ({
          id: d.id,
          domain: d.domain,
          processingStartedAt: d.processingStartedAt,
          processedAt: d.processedAt
        }))
      });
    } catch (error: any) {
      console.error('Get stuck domains error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Direct Level 2 processing for pending domains
  app.post("/api/batches/:batchId/process-pending-level2", async (req, res) => {
    try {
      const { batchId } = req.params;

      // Get domains already marked as pending for Level 2
      const domains = await storage.getDomainsByBatch(batchId, 1000);
      const pendingLevel2 = domains.filter(d => d.level2Status === 'pending');

      if (pendingLevel2.length === 0) {
        return res.json({ 
          message: "No domains pending Level 2 processing",
          count: 0
        });
      }

      console.log(`🚀 Starting Level 2 processing for ${pendingLevel2.length} pending domains`);

      // Process each domain individually for Level 2 GLEIF enhancement
      for (const domain of pendingLevel2) {
        console.log(`🔍 Processing Level 2 for ${domain.domain}: "${domain.companyName}"`);
        // Start processing in background
        processor.processLevel2ForBatch(batchId, [domain]).catch(error => {
          console.error(`Level 2 processing error for ${domain.domain}:`, error);
        });
      }

      res.json({
        message: `Level 2 processing started for ${pendingLevel2.length} domains`,
        domains: pendingLevel2.map(d => ({ domain: d.domain, companyName: d.companyName })),
        count: pendingLevel2.length
      });

    } catch (error: any) {
      console.error('Direct Level 2 processing error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Emergency batch restart endpoint
  app.post("/api/batches/:batchId/restart", async (req, res) => {
    try {
      const { batchId } = req.params;

      if (processor.isCurrentlyProcessing()) {
        return res.status(400).json({ 
          message: "Cannot restart batch while processing is active"
        });
      }

      // Check for pending domains
      const pendingDomains = await storage.getDomainsByBatchWithStatus?.(batchId, 'pending') || [];

      if (pendingDomains.length === 0) {
        return res.json({ 
          success: false, 
          message: 'No pending domains found to restart' 
        });
      }

      console.log(`🚀 Restarting batch processing for ${batchId} with ${pendingDomains.length} pending domains`);

      // Start processing asynchronously
      processor.processBatch(batchId).catch(error => {
        console.error('Batch processing error:', error);
      });

      res.json({
        success: true,
        message: `Batch processing restarted for ${pendingDomains.length} pending domains`,
        pendingDomains: pendingDomains.length
      });

    } catch (error: any) {
      console.error('Batch restart error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Simplified Beta Testing API Routes - assumes beta server runs independently
  // Simple beta server status check
  async function checkBetaServerStatus(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:3001/api/beta/health', { timeout: 3000 });
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  // Beta server status endpoint (simplified since auto-started)
  app.get('/api/beta/status', async (req, res) => {
    const isRunning = await checkBetaServerStatus();
    res.json({ status: isRunning ? 'ready' : 'starting' });
  });

  // Beta server proxy endpoints (no auto-start)
  app.get('/api/beta/experiments', async (req, res) => {
    try {
      const response = await axios.get('http://localhost:3001/api/beta/experiments');
      res.json(response.data);
    } catch (error) {
      res.status(503).json({ 
        success: false, 
        error: 'Beta server is still starting up. Please wait a moment and try again.',
        status: 'starting'
      });
    }
  });

  app.get('/api/beta/smoke-test/results', async (req, res) => {
    try {
      const response = await axios.get('http://localhost:3001/api/beta/smoke-test/results');
      res.json(response.data);
    } catch (error) {
      res.status(503).json({ 
        success: false, 
        error: 'Beta server is still starting up. Please wait a moment and try again.',
        status: 'starting'
      });
    }
  });

  app.post('/api/beta/smoke-test', async (req, res) => {
    const isRunning = await checkBetaServerStatus();
    if (!isRunning) {
      return res.status(503).json({ 
        success: false, 
        error: 'Beta server is not running. Please start it using the workflow dropdown.',
        status: 'stopped'
      });
    }

    try {
      const response = await axios.post('http://localhost:3001/api/beta/smoke-test', req.body, {
        headers: { 'Content-Type': 'application/json' }
      });
      res.json(response.data);
    } catch (error) {
      res.status(503).json({ 
        success: false, 
        error: 'Beta server is still starting up. Please wait a moment and try again.',
        status: 'starting'
      });
    }
  });

  // GLEIF connection test endpoint (for debugging)
  app.get('/api/test/gleif-connection', async (req, res) => {
    try {
      const { gleifExtractor } = await import('./services/gleifExtractor');
      console.log('[Main] Testing GLEIF API connection...');

      const isConnected = await gleifExtractor.testGLEIFConnection();

      res.json({
        success: isConnected,
        message: isConnected ? 'GLEIF API connection successful' : 'GLEIF API connection failed',
        timestamp: new Date().toISOString(),
        server: 'main'
      });
    } catch (error: any) {
      console.error('[Main] GLEIF connection test error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        server: 'main'
      });
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
    'Extraction Method', 
    'Confidence Score', 
    'Primary LEI Code', 
    'Primary GLEIF Name',
    'Country',
    'Total GLEIF Candidates',
    'All LEI Codes',
    'All Legal Names',
    'All Jurisdictions',
    'All Entity Statuses',
    'Level 2 Status',
    'Level 2 Candidates Count',
    'Final Legal Name',
    'Final Confidence',
    'Recommendation', 
    'Processing Time (ms)', 
    'Status', 
    'Error Message',
    'Failure Category',
    'Technical Details',
    'Retry Count',
    'Created At',
    'Processed At'
  ];

  const rows = domains.map(d => [
    d.domain,
    d.companyName || '',
    d.extractionMethod || '',
    d.confidenceScore || '',
    d.primaryLeiCode || '',
    d.primaryGleifName || '',
    d.guessedCountry || '',
    d.gleifCandidateCount || 0,
    d.allLeiCodes || '',
    d.allLegalNames || '',
    d.allJurisdictions || '',
    d.allEntityStatuses || '',
    d.level2Status || '',
    d.level2CandidatesCount || 0,
    d.finalLegalName || '',
    d.finalConfidence || '',
    d.recommendation || '',
    d.processingTimeMs || '',
    d.status,
    d.errorMessage || '',
    d.failureCategory || '',
    d.technicalDetails || '',
    d.retryCount || 0,
    d.createdAt ? new Date(d.createdAt).toISOString() : '',
    d.processedAt ? new Date(d.processedAt).toISOString() : ''
  ]);

  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}