import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { PerplexityExtractor } from './betaServices/perplexityExtractor';
import { AxiosCheerioExtractor } from './betaServices/axiosCheerioExtractor';
import { gleifExtractor } from './betaServices/gleifExtractor';

const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

// Simple cleanup function
async function quickCleanup() {
  console.log('🔄 Starting beta server...');
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/beta/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Beta Testing Platform',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get beta experiments
app.get('/api/beta/experiments', async (req, res) => {
  try {
    const experiments = await betaDb.select().from(betaExperiments);
    res.json({ success: true, experiments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GLEIF smoke test endpoint
app.post('/api/beta/gleif-test', async (req, res) => {
  try {
    const { companyName, leiCode } = req.body;

    if (!companyName && !leiCode) {
      return res.status(400).json({
        success: false,
        error: 'Either companyName or leiCode is required'
      });
    }

    console.log(`[Beta] [GLEIF] Testing ${companyName || `LEI: ${leiCode}`}...`);

    let result;
    if (leiCode) {
      result = await gleifExtractor.searchByLEI(leiCode);
    } else {
      result = await gleifExtractor.extractCompanyInfo(companyName);
    }

    console.log(`[Beta] [GLEIF] Result for ${companyName || leiCode}:`, {
      companyName: result.companyName,
      leiCode: result.leiCode,
      confidence: result.confidence,
      sources: result.sources.length
    });

    res.json({
      success: true,
      data: result,
      method: 'gleif_api',
      processingTime: Date.now() // Simple timestamp
    });

  } catch (error: any) {
    console.error(`[Beta] [GLEIF] Error:`, error.message);
    res.status(500).json({
      success: false,
      error: 'GLEIF extraction failed',
      details: error.message
    });
  }
});

// Enhanced smoke test endpoint with comprehensive error handling
app.post('/api/beta/smoke-test', async (req, res) => {
  const { domain, method } = req.body;

  if (!domain || !method) {
    return res.status(400).json({ error: 'Domain and method are required' });
  }

  try {
    let result: any = null;

    if (method === 'perplexity_llm') {
      const extractor = new PerplexityExtractor();
      console.log(`[Beta] Testing ${domain} with Perplexity LLM...`);
      result = await extractor.extractFromDomain(domain);
    } else if (method === 'axios_cheerio') {
      const extractor = new AxiosCheerioExtractor();
      console.log(`[Beta] Testing ${domain} with Axios/Cheerio...`);
      result = await extractor.extractFromDomain(domain);
    } else {
      return res.status(400).json({ error: 'Invalid method. Supported methods: perplexity_llm, axios_cheerio' });
    }

    // Store in beta database with experiment ID
    const dbResult = await betaDb.insert(betaSmokeTests).values({
      domain,
      method,
      experimentId: 1, // Smoke testing experiment
      ...result
    }).returning();

    // Ensure confidence is included in the response
    const responseData = {
      ...result,
      confidence: result.confidence || 0
    };

    res.json({ success: true, data: responseData });

  } catch (error: any) {
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
  } catch (error: any) {
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

// Start the server directly
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🧪 Beta Testing Platform running on port ${PORT}`);
  console.log(`🔬 Complete database isolation from production`);
  console.log(`🚀 Ready for experimental features`);
  console.log(`🌐 Accessible at http://0.0.0.0:${PORT}`);

  try {
    // Test database connection first
    console.log('🔍 Testing beta database connection...');
    await betaDb.execute('SELECT 1 as test');
    console.log('✅ Beta database connection successful');

    // Initialize experiments
    await initializeBetaExperiments();
    console.log(`✅ Beta server fully initialized and ready`);
    console.log(`🎯 Health check available at: http://0.0.0.0:${PORT}/api/beta/health`);

    // Send ready signal to parent process if running from main server
    if (process.send) {
      process.send('ready');
    }
  } catch (error) {
    console.error('❌ Failed to initialize beta experiments:', error);
    console.error('💥 Error details:', error);
    process.exit(1);
  }
});

// Handle server startup errors
server.on('error', (error: any) => {
  console.error('❌ Beta server startup error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`💥 Port ${PORT} is already in use`);
    console.log('🔧 Try killing any existing beta processes first');
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Beta server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Beta server interrupted, shutting down...');
  process.exit(0);
});