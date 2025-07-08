import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { PuppeteerExtractor } from './betaServices/puppeteerExtractor_comprehensive';
import { PlaywrightExtractor } from './betaServices/playwrightExtractor';
import { PerplexityExtractor } from './betaServices/perplexityExtractor';
import { AxiosCheerioExtractor } from './betaServices/axiosCheerioExtractor';

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

// Initialize extractors at module level
let puppeteerExtractor: PuppeteerExtractor | null = null;
let playwrightExtractor: PlaywrightExtractor | null = null;
let perplexityExtractor: PerplexityExtractor | null = null;
let axiosCheerioExtractor: AxiosCheerioExtractor | null = null;

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

    console.log('🔧 Initializing extractors...');

    // Initialize Axios/Cheerio (always works)
    try {
      axiosCheerioExtractor = new AxiosCheerioExtractor();
      console.log('✅ Axios/Cheerio extractor ready');
    } catch (error) {
      console.log('❌ Axios/Cheerio extractor failed:', error.message);
    }

    // Initialize Puppeteer (may fail)
    try {
      puppeteerExtractor = new PuppeteerExtractor();
      await puppeteerExtractor.initialize();
      console.log('✅ Puppeteer extractor initialized');
    } catch (error) {
      console.log('⚠️ Puppeteer extractor failed to initialize:', error.message);
      puppeteerExtractor = null;
    }

    // Initialize Playwright (may fail)
    try {
      playwrightExtractor = new PlaywrightExtractor();
      await playwrightExtractor.initialize();
      console.log('✅ Playwright extractor initialized');
    } catch (error: any) {
      console.log('⚠️ Playwright extractor failed to initialize:', error.message);
      console.log('🔍 Playwright initialization error details:', error.stack?.split('\n')[0] || 'No additional details');
      playwrightExtractor = null;
    }

    // Initialize Perplexity (always works)
    try {
      perplexityExtractor = new PerplexityExtractor();
      console.log('✅ Perplexity extractor ready');
    } catch (error) {
      console.log('❌ Perplexity extractor failed:', error.message);
      perplexityExtractor = null;
    }

    const workingExtractors = [
      axiosCheerioExtractor && 'Axios/Cheerio',
      puppeteerExtractor && 'Puppeteer', 
      playwrightExtractor && 'Playwright',
      perplexityExtractor && 'Perplexity'
    ].filter(Boolean);

    console.log(`🚀 ${workingExtractors.length} extractors initialized: ${workingExtractors.join(', ')}`);

    // Initialize experiments
    await initializeBetaExperiments();
    console.log(`✅ Beta server fully initialized and ready`);
    console.log(`🎯 Health check available at: http://0.0.0.0:${PORT}/api/beta/health`);

    // Health check endpoint
    app.get('/api/beta/health-check', async (req, res) => {
      try {
        const healthChecks = await Promise.allSettled([
          axiosCheerioExtractor?.healthCheck(),
          puppeteerExtractor?.healthCheck(),
          playwrightExtractor?.healthCheck(),
        ].filter(Boolean));
        
        res.json({
          status: 'healthy',
          service: 'Beta Testing Platform',
          port: PORT,
          timestamp: new Date().toISOString(),
          extractors: {
            axios_cheerio: axiosCheerioExtractor ? (healthChecks[0]?.status === 'fulfilled' ? healthChecks[0].value : false) : false,
            puppeteer: puppeteerExtractor ? (healthChecks[1]?.status === 'fulfilled' ? healthChecks[1].value : false) : false,
            playwright: playwrightExtractor ? (healthChecks[2]?.status === 'fulfilled' ? healthChecks[2].value : false) : false,
            perplexity: !!perplexityExtractor,
          },
        });
      } catch (error) {
        console.error('❌ Health check failed:', error);
        res.status(500).json({ status: 'unhealthy', error: 'Health check failed' });
      }
    });

    // Update the smoke test endpoint to use the initialized extractors
    app.post('/api/beta/smoke-test', async (req, res) => {
      const { domain, method } = req.body;

      if (!domain || !method) {
        return res.status(400).json({ error: 'Domain and method are required' });
      }

      console.log(`🧪 [Beta] Starting ${method} extraction for ${domain}`);

      try {
        let result: any = null;

        switch (method) {
          case 'axios_cheerio':
            if (!axiosCheerioExtractor) {
              throw new Error('Axios/Cheerio extractor not available');
            }
            console.log(`🔧 [Beta] Using Axios/Cheerio extractor for ${domain}`);
            result = await axiosCheerioExtractor.extractFromDomain(domain);
            break;

          case 'puppeteer':
            if (!puppeteerExtractor) {
              console.error(`❌ [Beta] Puppeteer extractor not available for ${domain}`);
              throw new Error('Puppeteer extractor not available - failed to initialize');
            }
            console.log(`🔧 [Beta] Using Puppeteer extractor for ${domain}`);
            result = await puppeteerExtractor.extractFromDomain(domain);
            break;

          case 'playwright':
            if (!playwrightExtractor) {
              console.error(`❌ [Beta] Playwright extractor not available for ${domain}`);
              throw new Error('Playwright extractor not available - failed to initialize');
            }
            console.log(`🔧 [Beta] Using Playwright extractor for ${domain}`);
            const playwrightResult = await playwrightExtractor.extractFromDomain(domain);

            // Map Playwright result to expected format
            result = {
              success: playwrightResult.success,
              data: {
                companyName: playwrightResult.companyName,
                confidence: playwrightResult.companyConfidence,
                extractionMethod: playwrightResult.companyExtractionMethod,
                legalEntityType: playwrightResult.legalEntityType,
                country: playwrightResult.detectedCountry,
                sources: playwrightResult.sources,
                technicalDetails: playwrightResult.technicalDetails
              },
              error: playwrightResult.error
            };
            break;

          case 'perplexity_llm':
            if (!perplexityExtractor) {
              console.error(`❌ [Beta] Perplexity extractor not available for ${domain}`);
              throw new Error('Perplexity extractor not available');
            }
            console.log(`🔧 [Beta] Using Perplexity extractor for ${domain}`);
            result = await perplexityExtractor.extractFromDomain(domain);
            break;

          default:
            return res.status(400).json({ error: 'Invalid method' });
        }

        console.log(`✅ [Beta] ${method} extraction completed for ${domain}:`, result?.success ? 'SUCCESS' : 'FAILED');

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
          confidence: result.data?.confidence || result.confidence || 0
        };

        res.json({ success: true, data: responseData });

      } catch (error: any) {
        console.error(`❌ [Beta] Error in ${method} smoke test for ${domain}:`, error.message);
        
        // Store failure in database
        try {
          await betaDb.insert(betaSmokeTests).values({
            domain,
            method,
            experimentId: 1,
            success: false,
            error: error.message,
            confidence: 0
          });
        } catch (dbError) {
          console.error('❌ [Beta] Failed to store error in database:', dbError);
        }

        res.status(500).json({ 
          success: false, 
          error: error.message,
          data: {
            confidence: 0,
            companyName: null
          }
        });
      }
    });

    // Send ready signal to parent process if running from main server
    if (process.send) {
      process.send('ready');
    }
  } catch (error) {
    console.error('❌ Failed to initialize beta server:', error);
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