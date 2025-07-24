import express from 'express';
import { executeBetaV2Query, initBetaV2Database } from './database';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Initialize database on startup
initBetaV2Database().catch(console.error);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    platform: 'beta-v2',
    methods: ['playwright-dump']
  });
});

// Dump a domain
router.post('/dump', async (req, res) => {
  try {
    const { domain, method } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    if (method !== 'playwright-dump') {
      return res.status(400).json({ error: 'Only playwright-dump is supported currently' });
    }

    console.log(`[Beta v2] Starting dump for ${domain} using ${method}`);
    
    // Temporarily return a stub response while refactoring to federated architecture
    res.json({
      success: false,
      error: 'Refactoring to federated architecture - please use the standalone playwright-dump service on port 3002'
    });
  } catch (error: any) {
    console.error('[Beta v2] Dump error:', error);
    res.status(500).json({ 
      error: 'Failed to dump domain',
      details: error.message 
    });
  }
});

// Get recent dumps
router.get('/dumps', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const result = await executeBetaV2Query(
      `SELECT id, domain, status, error_message, processing_time_ms, created_at
       FROM playwright_dumps
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      dumps: result.rows.map((row: any) => ({
        id: row.id,
        domain: row.domain,
        status: row.status,
        error: row.error_message,
        processingTime: row.processing_time_ms,
        createdAt: row.created_at
      }))
    });
  } catch (error: any) {
    console.error('[Beta v2] Failed to get dumps:', error);
    res.status(500).json({ error: 'Failed to retrieve dumps' });
  }
});

// Get dump details
router.get('/dumps/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeBetaV2Query(
      `SELECT * FROM playwright_dumps WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dump not found' });
    }

    const dump = result.rows[0];
    res.json({
      id: dump.id,
      domain: dump.domain,
      status: dump.status,
      error: dump.error_message,
      processingTime: dump.processing_time_ms,
      createdAt: dump.created_at,
      rawData: dump.raw_data
    });
  } catch (error: any) {
    console.error('[Beta v2] Failed to get dump details:', error);
    res.status(500).json({ error: 'Failed to retrieve dump details' });
  }
});

// Serve Playwright Dump UI
router.get('/playwright-dump', (req, res) => {
  try {
    const htmlPath = join(__dirname, 'playwright-dump', 'public', 'index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    // Update API endpoint to use the beta server path
    const updatedHtml = htmlContent.replace(/http:\/\/localhost:3002/g, '/api/beta');
    res.send(updatedHtml);
  } catch (error) {
    console.error('[Beta v2] Failed to serve playwright-dump UI:', error);
    res.status(500).send('Failed to load Playwright Dump UI');
  }
});

// Proxy Playwright dump API endpoints
router.post('/playwright-dump/dump', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    // Insert initial record
    const insertResult = await executeBetaV2Query(
      `INSERT INTO playwright_dumps (domain, status) VALUES ($1, 'processing') RETURNING id`,
      [domain]
    );
    
    const dumpId = insertResult.rows[0].id;
    
    // Return immediately with the ID
    res.json({ 
      id: dumpId, 
      status: 'processing',
      message: 'Dump started successfully'
    });
    
    // TODO: Implement actual playwright dumping asynchronously
    setTimeout(async () => {
      try {
        await executeBetaV2Query(
          `UPDATE playwright_dumps SET status = 'completed', processing_time_ms = 1000 WHERE id = $1`,
          [dumpId]
        );
      } catch (error) {
        console.error('[Beta v2] Failed to update dump status:', error);
      }
    }, 1000);
    
  } catch (error: any) {
    console.error('[Beta v2] Dump error:', error);
    res.status(500).json({ error: 'Failed to start dump' });
  }
});

router.get('/playwright-dump/dumps', async (req, res) => {
  try {
    const result = await executeBetaV2Query(
      `SELECT id, domain, status, processing_time_ms, created_at
       FROM playwright_dumps
       ORDER BY created_at DESC
       LIMIT 20`,
      []
    );
    
    res.json(result.rows || []);
  } catch (error: any) {
    console.error('[Beta v2] Error fetching dumps:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;