
import express from 'express';
import cors from 'cors';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests, insertBetaSmokeTestSchema } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/beta/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Beta Testing Platform',
    port: PORT,
    database: 'Beta PostgreSQL',
    isolation: 'complete'
  });
});

// Get all beta experiments
app.get('/api/beta/experiments', async (req, res) => {
  try {
    const experiments = await betaDb.select()
      .from(betaExperiments)
      .orderBy(desc(betaExperiments.lastUsedAt));
    
    res.json({ success: true, experiments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Beta smoke test endpoint
app.post('/api/beta/smoke-test', async (req, res) => {
  try {
    const { domain, method } = req.body;
    
    // Enhanced beta smoke test with realistic simulation
    const startTime = Date.now();
    
    // Simulate different success rates and characteristics for each method
    let success, confidence, processingTime, extractionMethod, technicalDetails;
    
    switch (method) {
      case 'axios_cheerio':
        success = Math.random() > 0.4; // 60% success rate
        confidence = success ? Math.floor(Math.random() * 25) + 65 : 0;
        processingTime = Math.floor(Math.random() * 1500) + 500; // 500-2000ms
        extractionMethod = success ? 'cheerio_selector' : null;
        technicalDetails = success ? 'Fast DOM parsing' : 'Anti-bot protection detected';
        break;
        
      case 'puppeteer':
        success = Math.random() > 0.25; // 75% success rate
        confidence = success ? Math.floor(Math.random() * 20) + 70 : 0;
        processingTime = Math.floor(Math.random() * 3000) + 2000; // 2000-5000ms
        extractionMethod = success ? 'puppeteer_headless' : null;
        technicalDetails = success ? 'Browser automation successful' : 'JavaScript rendering failed';
        break;
        
      case 'playwright':
        success = Math.random() > 0.2; // 80% success rate
        confidence = success ? Math.floor(Math.random() * 15) + 80 : 0;
        processingTime = Math.floor(Math.random() * 2500) + 1500; // 1500-4000ms
        extractionMethod = success ? 'playwright_structured' : null;
        technicalDetails = success ? 'Structured data extraction' : 'Network timeout';
        break;
        
      default:
        success = Math.random() > 0.3;
        confidence = success ? Math.floor(Math.random() * 30) + 70 : 0;
        processingTime = Math.floor(Math.random() * 2000) + 1000;
        extractionMethod = success ? 'beta_extraction' : null;
        technicalDetails = 'Beta testing simulation';
    }
    
    const result = {
      domain,
      method,
      companyName: success ? `${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)} Corp` : null,
      confidence,
      processingTime,
      success,
      error: success ? null : `Beta ${method} extraction failed`,
      extractionMethod,
      technicalDetails,
      experimentId: 1, // Smoke testing experiment
    };
    
    // Store in beta database
    await betaDb.insert(betaSmokeTests).values(result);
    
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get beta smoke test results
app.get('/api/beta/smoke-test/results', async (req, res) => {
  try {
    const results = await betaDb.select()
      .from(betaSmokeTests)
      .orderBy(desc(betaSmokeTests.createdAt))
      .limit(50);
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize beta experiments
async function initializeBetaExperiments() {
  try {
    // Check if smoke testing experiment exists
    const existing = await betaDb.select()
      .from(betaExperiments)
      .where(eq(betaExperiments.name, 'Smoke Testing'));
    
    if (existing.length === 0) {
      await betaDb.insert(betaExperiments).values({
        name: 'Smoke Testing',
        description: 'Compare extraction performance across different scraping libraries',
        status: 'beta',
        createdBy: 'system'
      });
      console.log('✅ Initialized Smoke Testing experiment');
    }
  } catch (error) {
    console.error('Failed to initialize beta experiments:', error);
  }
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🧪 Beta Testing Platform running on port ${PORT}`);
  console.log(`🔬 Complete database isolation from production`);
  console.log(`🚀 Ready for experimental features`);
  
  // Initialize experiments
  await initializeBetaExperiments();
});
