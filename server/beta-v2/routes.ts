import express from 'express';
import { executeBetaV2Query, initBetaV2Database } from './database';

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

export default router;