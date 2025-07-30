import express from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import { CrawleeDumpService } from './crawleeDumpService';
import type { CrawlConfig } from './crawleeDumpTypes';

const router = express.Router();
const crawleeService = new CrawleeDumpService();

// Start a new dump
router.post('/dump', async (req, res) => {
  try {
    const { domain, config = {} } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    // Validate config
    const crawlConfig: CrawlConfig = {
      maxPages: Math.min(config.maxPages || 10, 100),
      maxDepth: Math.min(config.maxDepth || 2, 5),
      waitTime: Math.max(config.waitTime || 1000, 100),
      includePaths: config.includePaths || [],
      excludePaths: config.excludePaths || [],
      captureNetworkRequests: config.captureNetworkRequests || false
    };
    
    const dumpId = await crawleeService.startDump(domain, crawlConfig);
    
    res.json({ 
      id: dumpId, 
      message: 'Crawlee dump started',
      status: 'processing' 
    });
  } catch (error) {
    console.error('[Crawlee] Start dump error:', error);
    res.status(500).json({ error: 'Failed to start dump' });
  }
});

// List all dumps
router.get('/dumps', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const dumps = await crawleeService.listDumps(limit, offset);
    res.json(dumps);
  } catch (error) {
    console.error('[Crawlee] List dumps error:', error);
    res.status(500).json({ error: 'Failed to list dumps' });
  }
});

// Get dump details
router.get('/dump/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dump = await crawleeService.getDump(id);
    
    if (!dump) {
      return res.status(404).json({ error: 'Dump not found' });
    }
    
    res.json(dump);
  } catch (error) {
    console.error('[Crawlee] Get dump error:', error);
    res.status(500).json({ error: 'Failed to get dump' });
  }
});

// Get raw dump data
router.get('/dump/:id/data', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dump = await crawleeService.getDump(id);
    
    if (!dump) {
      return res.status(404).json({ error: 'Dump not found' });
    }
    
    if (!dump.dumpData) {
      return res.status(404).json({ error: 'Dump data not available yet' });
    }
    
    // Return raw data
    res.json(dump.dumpData);
  } catch (error) {
    console.error('[Crawlee] Get dump data error:', error);
    res.status(500).json({ error: 'Failed to get dump data' });
  }
});

// Delete dump
router.delete('/dump/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await crawleeService.deleteDump(id);
    res.json({ message: 'Dump deleted successfully' });
  } catch (error) {
    console.error('[Crawlee] Delete dump error:', error);
    res.status(500).json({ error: 'Failed to delete dump' });
  }
});

// Serve UI
router.get('/', (req, res) => {
  try {
    const htmlPath = join(__dirname, 'public', 'index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('[Crawlee] Failed to serve UI:', error);
    res.status(500).send('Failed to load Crawlee Dump UI');
  }
});

export default router;