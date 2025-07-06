
import express from 'express';
import cors from 'cors';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests, insertBetaSmokeTestSchema } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { PuppeteerExtractor } from './betaServices/puppeteerExtractor';

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
  const { domain, method } = req.body;
  
  if (!domain || !method) {
    return res.status(400).json({ error: 'Domain and method are required' });
  }
  
  try {
    let extractor: PuppeteerExtractor | null = null;
    let result: any = null;
    
    if (method === 'puppeteer') {
      // Use real puppeteer extraction
      extractor = new PuppeteerExtractor();
      await extractor.initialize();
      
      try {
        console.log(`[Beta] Testing ${domain} with puppeteer...`);
        result = await extractor.extractFromDomain(domain);
        
        // Store in beta database with experiment ID
        const dbResult = await betaDb.insert(betaSmokeTests).values({
          domain,
          method,
          experimentId: 1, // Smoke testing experiment
          ...result
        }).returning();
        
        res.json({ success: true, ...dbResult[0] });
      } finally {
        await extractor.cleanup();
      }
    } else if (method === 'playwright') {
      // Placeholder implementation for playwright
      const mockResult = {
        processingTimeMs: Math.floor(Math.random() * 2000) + 500,
        success: false,
        error: 'Playwright extraction not yet implemented',
        companyName: null,
        companyConfidence: 0,
        companyExtractionMethod: null,
        detectedCountry: null,
        countryConfidence: 0,
        geoMarkers: { addresses: [], phones: [], currencies: [], languages: [], postalCodes: [] },
        termsUrl: null,
        privacyUrl: null,
        legalUrls: [],
        legalContentExtracted: false,
        aboutUrl: null,
        aboutContent: null,
        aboutExtractionSuccess: false,
        socialMediaLinks: {},
        socialMediaCount: 0,
        contactEmails: [],
        contactPhones: [],
        contactAddresses: [],
        hasContactPage: false,
        rawHtmlSize: 0,
        rawExtractionData: null,
        pageMetadata: null,
        httpStatus: 0,
        renderRequired: false,
        javascriptErrors: [],
        extractionSteps: []
      };
      
      const dbResult = await betaDb.insert(betaSmokeTests).values({
        domain,
        method,
        experimentId: 1,
        ...mockResult
      }).returning();
      
      res.json({ success: true, ...dbResult[0] });
    } else if (method === 'axios_cheerio') {
      // Placeholder implementation for axios_cheerio
      const mockResult = {
        processingTimeMs: Math.floor(Math.random() * 1500) + 300,
        success: false,
        error: 'Axios/Cheerio extraction not yet implemented',
        companyName: null,
        companyConfidence: 0,
        companyExtractionMethod: null,
        detectedCountry: null,
        countryConfidence: 0,
        geoMarkers: { addresses: [], phones: [], currencies: [], languages: [], postalCodes: [] },
        termsUrl: null,
        privacyUrl: null,
        legalUrls: [],
        legalContentExtracted: false,
        aboutUrl: null,
        aboutContent: null,
        aboutExtractionSuccess: false,
        socialMediaLinks: {},
        socialMediaCount: 0,
        contactEmails: [],
        contactPhones: [],
        contactAddresses: [],
        hasContactPage: false,
        rawHtmlSize: 0,
        rawExtractionData: null,
        pageMetadata: null,
        httpStatus: 0,
        renderRequired: false,
        javascriptErrors: [],
        extractionSteps: []
      };
      
      const dbResult = await betaDb.insert(betaSmokeTests).values({
        domain,
        method,
        experimentId: 1,
        ...mockResult
      }).returning();
      
      res.json({ success: true, ...dbResult[0] });
    } else {
      res.status(400).json({ error: 'Invalid method' });
    }
  } catch (error) {
    console.error('[Beta] Error in smoke test:', error);
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
  console.log(`🌐 Accessible at http://0.0.0.0:${PORT}`);
  
  // Initialize experiments
  await initializeBetaExperiments();
});
