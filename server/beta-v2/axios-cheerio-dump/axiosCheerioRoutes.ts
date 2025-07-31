// API routes for Axios + Cheerio Dump service

import { Router } from 'express';
import { AxiosCheerioService } from './axiosCheerioService';
import { AXIOS_CHEERIO_CONFIG } from './config';

const router = Router();
const service = new AxiosCheerioService();

// Track service start time for uptime
const serviceStartTime = Date.now();

// Start a new extraction
router.post('/start', async (req, res) => {
  try {
    const { domain, config } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    console.log('[Axios+Cheerio Routes] Starting extraction for:', domain);
    const dumpId = await service.startExtraction(domain, config);
    
    res.json({ 
      dumpId, 
      status: 'started',
      message: `Extraction started for ${domain}`
    });
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Start error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to start extraction', details: errorMessage });
  }
});

// Get status of a dump
router.get('/status/:dumpId', async (req, res) => {
  try {
    const dumpId = parseInt(req.params.dumpId, 10);
    
    if (isNaN(dumpId)) {
      return res.status(400).json({ error: 'Invalid dump ID' });
    }
    
    const status = await service.getDumpStatus(dumpId);
    
    if (!status) {
      return res.status(404).json({ error: 'Dump not found' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Status error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to get status', details: errorMessage });
  }
});

// Get full results of a dump
router.get('/results/:dumpId', async (req, res) => {
  try {
    const dumpId = parseInt(req.params.dumpId, 10);
    
    if (isNaN(dumpId)) {
      return res.status(400).json({ error: 'Invalid dump ID' });
    }
    
    const data = await service.getDumpData(dumpId);
    
    if (!data) {
      return res.status(404).json({ error: 'Dump not found' });
    }
    
    // Parse JSON fields
    const results = {
      id: data.id,
      domain: data.domain,
      status: data.status,
      companyName: data.company_name,
      extractionMethod: data.extraction_method,
      confidence: data.confidence_score,
      httpStatus: data.http_status,
      responseTimeMs: data.response_time_ms,
      htmlSizeBytes: data.html_size_bytes,
      headers: data.headers,
      metaTags: data.meta_tags,
      extractionStrategies: data.extraction_strategies,
      pageMetadata: data.page_metadata,
      error: data.error_message,
      processingTimeMs: data.processing_time_ms,
      createdAt: data.created_at,
      completedAt: data.completed_at
    };
    
    res.json(results);
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Results error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to get results', details: errorMessage });
  }
});

// Get recent dumps
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const dumps = await service.getRecentDumps(limit);
    
    res.json({ dumps });
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Recent dumps error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to get recent dumps', details: errorMessage });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    let databaseStatus = 'healthy';
    try {
      await service.getRecentDumps(1);
    } catch (dbError) {
      databaseStatus = 'unhealthy';
    }
    
    const uptime = Math.floor((Date.now() - serviceStartTime) / 1000);
    
    res.json({
      service: AXIOS_CHEERIO_CONFIG.serviceName,
      status: databaseStatus === 'healthy' ? 'healthy' : 'degraded',
      version: AXIOS_CHEERIO_CONFIG.version,
      timestamp: new Date().toISOString(),
      uptime,
      checks: {
        database: databaseStatus
      }
    });
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Health check error:', error);
    res.status(503).json({
      service: AXIOS_CHEERIO_CONFIG.serviceName,
      status: 'unhealthy',
      version: AXIOS_CHEERIO_CONFIG.version,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download raw HTML
router.get('/download/:dumpId', async (req, res) => {
  try {
    const dumpId = parseInt(req.params.dumpId, 10);
    
    if (isNaN(dumpId)) {
      return res.status(400).json({ error: 'Invalid dump ID' });
    }
    
    const data = await service.getDumpData(dumpId);
    
    if (!data || !data.raw_html) {
      return res.status(404).json({ error: 'Dump not found or no HTML available' });
    }
    
    // Set headers for download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${data.domain}_axios_cheerio.html"`);
    res.send(data.raw_html);
  } catch (error) {
    console.error('[Axios+Cheerio Routes] Download error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: 'Failed to download HTML', details: errorMessage });
  }
});

export default router;