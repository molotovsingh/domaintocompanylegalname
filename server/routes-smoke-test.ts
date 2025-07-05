
import express from 'express';
import { SmokeTestService } from './services/smokeTestService';

const router = express.Router();
const smokeTestService = new SmokeTestService();

// Single domain test endpoint
router.post('/single', async (req, res) => {
  try {
    const { domain, method } = req.body;
    
    if (!domain || !method) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domain and method are required' 
      });
    }
    
    const result = await smokeTestService.runSingleTest(domain, method);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Smoke test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comparison test endpoint
router.post('/comparison', async (req, res) => {
  try {
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domain is required' 
      });
    }
    
    const result = await smokeTestService.runComparison(domain);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Comparison test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch comparison endpoint
router.post('/batch', async (req, res) => {
  try {
    const { domains } = req.body;
    
    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domains array is required' 
      });
    }
    
    const results = [];
    
    for (const domain of domains) {
      try {
        const result = await smokeTestService.runComparison(domain);
        results.push(result);
      } catch (error) {
        results.push({
          domain,
          axiosResult: null,
          puppeteerResult: null,
          winner: 'Error',
          analysis: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Batch test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Test if Puppeteer can be initialized
    await smokeTestService.initializePuppeteer();
    await smokeTestService.cleanup();
    
    // Test if Playwright can be initialized
    let playwrightWorking = false;
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      playwrightWorking = true;
    } catch (playwrightError) {
      console.warn('Playwright not available:', playwrightError.message);
    }
    
    res.json({
      success: true,
      message: 'Smoke testing service is healthy',
      capabilities: {
        axios_cheerio: true,
        puppeteer: true,
        playwright: playwrightWorking
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      capabilities: {
        axios_cheerio: true,
        puppeteer: false,
        playwright: false
      }
    });
  }
});

export default router;
