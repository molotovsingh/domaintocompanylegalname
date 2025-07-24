import express from 'express';
import { executeBetaV2Query, initBetaV2Database } from './database';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { playwrightDump } from './playwright-dump/playwrightDumpService';

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
    
    // Insert initial record
    const insertResult = await executeBetaV2Query(
      `INSERT INTO playwright_dumps (domain, status) VALUES ($1, 'processing') RETURNING id`,
      [domain]
    );
    
    const dumpId = insertResult.rows[0].id;
    
    // Start the dump process asynchronously
    playwrightDump(domain).then(async (result) => {
      // Update with results
      await executeBetaV2Query(
        `UPDATE playwright_dumps
         SET status = $1,
             raw_data = $2,
             processing_time_ms = $3,
             error_message = $4
         WHERE id = $5`,
        [
          result.success ? 'completed' : 'failed',
          JSON.stringify(result.data),
          result.processingTime,
          result.error || null,
          dumpId
        ]
      );
    }).catch(async (error) => {
      // Update with error
      try {
        await executeBetaV2Query(
          `UPDATE playwright_dumps SET status = 'failed', error_message = $1 WHERE id = $2`,
          [error.message, dumpId]
        );
      } catch (dbError) {
        console.error('[Beta v2] Failed to update error status:', dbError);
      }
    });
    
    // Return immediately with the dump ID
    res.json({
      success: true,
      dumpId,
      message: 'Dump started successfully'
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
    console.log('[Beta v2] __dirname:', __dirname);
    
    // Try different path approaches
    const htmlPath1 = join(__dirname, 'playwright-dump', 'public', 'index.html');
    const htmlPath2 = join(process.cwd(), 'server', 'beta-v2', 'playwright-dump', 'public', 'index.html');
    
    console.log('[Beta v2] Trying path 1:', htmlPath1);
    console.log('[Beta v2] Trying path 2:', htmlPath2);
    
    let htmlContent;
    let usedPath;
    
    try {
      htmlContent = readFileSync(htmlPath1, 'utf-8');
      usedPath = htmlPath1;
    } catch (e1) {
      console.log('[Beta v2] Path 1 failed, trying path 2');
      htmlContent = readFileSync(htmlPath2, 'utf-8');
      usedPath = htmlPath2;
    }
    
    console.log('[Beta v2] Successfully loaded HTML from:', usedPath);
    
    // Update API endpoint to use the beta server path
    const updatedHtml = htmlContent.replace(/http:\/\/localhost:3002/g, '/api/beta/playwright-dump');
    res.send(updatedHtml);
  } catch (error) {
    console.error('[Beta v2] Failed to serve playwright-dump UI:', error);
    res.status(500).send(`Failed to load Playwright Dump UI: ${error}`);
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