// Index file for Axios + Cheerio Dump service

import { Router } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import axiosCheerioRoutes from './axiosCheerioRoutes';
import { AxiosCheerioService } from './axiosCheerioService';

const router = Router();

// Serve UI
router.get('/', (req, res) => {
  try {
    // Try different path approaches for ES modules
    const htmlPath1 = join(process.cwd(), 'server', 'beta-v2', 'axios-cheerio-dump', 'public', 'index.html');
    const htmlPath2 = join('server', 'beta-v2', 'axios-cheerio-dump', 'public', 'index.html');
    
    let htmlContent;
    try {
      htmlContent = readFileSync(htmlPath1, 'utf-8');
    } catch (e) {
      htmlContent = readFileSync(htmlPath2, 'utf-8');
    }
    
    res.send(htmlContent);
  } catch (error) {
    console.error('[Axios+Cheerio] Failed to serve UI:', error);
    res.status(500).send('Failed to load Axios+Cheerio Dump UI');
  }
});

// Mount routes under /api/beta/axios-cheerio
router.use(axiosCheerioRoutes);

// Initialize storage when module loads
const service = new AxiosCheerioService();
service.initializeStorage().catch(error => {
  console.error('[Axios+Cheerio] Failed to initialize storage:', error);
});

export default router;