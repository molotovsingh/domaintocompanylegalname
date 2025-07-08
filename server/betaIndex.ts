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

// Track initialization status
let extractorsInitialized = false;

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

    console.log('🔧 Initializing extractors sequentially...');

    // Step 1: Initialize Axios/Cheerio (always works, no browser required)
    try {
      console.log('🔄 [1/4] Initializing Axios/Cheerio extractor...');
      axiosCheerioExtractor = new AxiosCheerioExtractor();
      console.log('✅ [1/4] Axios/Cheerio extractor ready');
    } catch (error) {
      console.log('❌ [1/4] Axios/Cheerio extractor failed:', error.message);
    }

    // Step 2: Initialize Perplexity (no browser required)
    try {
      console.log('🔄 [2/4] Initializing Perplexity extractor...');
      perplexityExtractor = new PerplexityExtractor();
      console.log('✅ [2/4] Perplexity extractor ready');
    } catch (error) {
      console.log('❌ [2/4] Perplexity extractor failed:', error.message);
      perplexityExtractor = null;
    }

    // Wait between browser initializations to prevent resource conflicts
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Initialize Puppeteer (may fail, requires browser)
    try {
      console.log('🔄 [3/4] Initializing Puppeteer extractor...');
      puppeteerExtractor = new PuppeteerExtractor();
      await puppeteerExtractor.initialize();
      console.log('✅ [3/4] Puppeteer extractor initialized');

      // Wait after successful browser initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('⚠️ [3/4] Puppeteer extractor failed to initialize:', error.message);
      puppeteerExtractor = null;
    }

    // Step 4: Initialize Playwright (may fail, requires browser)
    try {
      console.log('🔄 [4/4] Initializing Playwright extractor...');
      playwrightExtractor = new PlaywrightExtractor();
      await playwrightExtractor.initialize();
      console.log('✅ [4/4] Playwright extractor initialized');
    } catch (error: any) {
      console.log('⚠️ [4/4] Playwright extractor failed to initialize:', error.message);
      console.log('🔍 Playwright initialization error details:', error.stack?.split('\n')[0] || 'No additional details');
      playwrightExtractor = null;
    }

    const workingExtractors = [
      axiosCheerioExtractor && 'Axios/Cheerio',
      perplexityExtractor && 'Perplexity',
      puppeteerExtractor && 'Puppeteer', 
      playwrightExtractor && 'Playwright'
    ].filter(Boolean);

    console.log(`🚀 ${workingExtractors.length}/4 extractors initialized: ${workingExtractors.join(', ')}`);

    // Mark extractors as initialized (even if some failed)
    extractorsInitialized = true;

    // Ensure we have at least one working extractor
    if (!axiosCheerioExtractor && !perplexityExtractor && !puppeteerExtractor && !playwrightExtractor) {
      throw new Error('No extractors could be initialized - beta server cannot function');
    }

    // Initialize experiments
    await initializeBetaExperiments();
    console.log(`✅ Beta server fully initialized with ${workingExtractors.length} working extractors`);
    console.log(`🎯 Health check available at: http://0.0.0.0:${PORT}/api/beta/health`);

    // Health check endpoint with extractor status
    app.get('/api/beta/health-check', async (req, res) => {
      try {
        const extractorStatus = {
          axios_cheerio: !!axiosCheerioExtractor,
          perplexity: !!perplexityExtractor,
          puppeteer: !!puppeteerExtractor,
          playwright: !!playwrightExtractor
        };

        const workingCount = Object.values(extractorStatus).filter(Boolean).length;

        res.json({
          status: workingCount > 0 ? 'healthy' : 'degraded',
          service: 'Beta Testing Platform',
          port: PORT,
          timestamp: new Date().toISOString(),
          extractorsInitialized,
          extractors: extractorStatus,
          workingExtractors: workingCount,
          totalExtractors: 4,
          message: workingCount === 0 ? 'No extractors available' : 
                   workingCount < 4 ? `${workingCount}/4 extractors working` : 
                   'All extractors operational'
        });
      } catch (error: any) {
        console.error('❌ Health check failed:', error);
        res.status(500).json({ 
          status: 'unhealthy', 
          error: 'Health check failed',
          message: error.message
        });
      }
    });

    // Update the smoke test endpoint to use the initialized extractors
    app.post('/api/beta/smoke-test', async (req, res) => {
      const { domain, method } = req.body;

      if (!domain || !method) {
        return res.status(400).json({ error: 'Domain and method are required' });
      }

      // Check if extractors are initialized
      if (!extractorsInitialized) {
        return res.status(503).json({ 
          success: false, 
          error: 'Extractors are still initializing. Please wait a moment and try again.',
          data: { confidence: 0, companyName: null }
        });
      }

      console.log(`🧪 [Beta] Starting ${method} extraction for ${domain}`);

      try {
        let result: any = null;

        switch (method) {
          case 'axios_cheerio':
            if (!axiosCheerioExtractor) {
              // Fallback to another extractor
              if (perplexityExtractor) {
                console.log(`🔄 [Beta] Falling back to Perplexity for ${domain} (Axios/Cheerio not available)`);
                result = await perplexityExtractor.extractFromDomain(domain);
              } else {
                throw new Error('Axios/Cheerio extractor not available and no fallback extractor');
              }
            } else {
              console.log(`🔧 [Beta] Using Axios/Cheerio extractor for ${domain}`);
              result = await axiosCheerioExtractor.extractFromDomain(domain);
            }
            break;

          case 'puppeteer':
            if (!puppeteerExtractor) {
              // Fallback to Axios/Cheerio
              if (axiosCheerioExtractor) {
                console.log(`🔄 [Beta] Falling back to Axios/Cheerio for ${domain} (Puppeteer not available)`);
                result = await axiosCheerioExtractor.extractFromDomain(domain);
              } else if (perplexityExtractor) {
                console.log(`🔄 [Beta] Falling back to Perplexity for ${domain} (Puppeteer not available)`);
                result = await perplexityExtractor.extractFromDomain(domain);
              } else {
                throw new Error('Puppeteer extractor not available and no fallback extractor');
              }
            } else {
              console.log(`🔧 [Beta] Using Puppeteer extractor for ${domain}`);
              result = await puppeteerExtractor.extractFromDomain(domain);
            }
            break;

          case 'playwright':
            if (!playwrightExtractor) {
              // Fallback to Axios/Cheerio
              if (axiosCheerioExtractor) {
                console.log(`🔄 [Beta] Falling back to Axios/Cheerio for ${domain} (Playwright not available)`);
                result = await axiosCheerioExtractor.extractFromDomain(domain);
              } else if (perplexityExtractor) {
                console.log(`🔄 [Beta] Falling back to Perplexity for ${domain} (Playwright not available)`);
                result = await perplexityExtractor.extractFromDomain(domain);
              } else {
                throw new Error('Playwright extractor not available and no fallback extractor');
              }
            } else {
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
            }
            break;

          case 'perplexity_llm':
            if (!perplexityExtractor) {
              // Fallback to Axios/Cheerio
              if (axiosCheerioExtractor) {
                console.log(`🔄 [Beta] Falling back to Axios/Cheerio for ${domain} (Perplexity not available)`);
                result = await axiosCheerioExtractor.extractFromDomain(domain);
              } else {
                throw new Error('Perplexity extractor not available and no fallback extractor');
              }
            } else {
              console.log(`🔧 [Beta] Using Perplexity extractor for ${domain}`);
              result = await perplexityExtractor.extractFromDomain(domain);
            }
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