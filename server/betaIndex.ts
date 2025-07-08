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

    console.log('🔧 Initializing extractors in strict serial order...');

    // SERIALIZED INITIALIZATION - One at a time with proper waits
    
    // Step 1: Initialize Axios/Cheerio (no browser, safe)
    try {
      console.log('🔄 [1/4] Initializing Axios/Cheerio extractor...');
      axiosCheerioExtractor = new AxiosCheerioExtractor();
      console.log('✅ [1/4] Axios/Cheerio extractor ready');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small wait
    } catch (error) {
      console.log('❌ [1/4] Axios/Cheerio extractor failed:', error.message);
      axiosCheerioExtractor = null;
    }

    // Step 2: Initialize Perplexity (no browser, safe)
    try {
      console.log('🔄 [2/4] Initializing Perplexity extractor...');
      perplexityExtractor = new PerplexityExtractor();
      console.log('✅ [2/4] Perplexity extractor ready');
      await new Promise(resolve => setTimeout(resolve, 500)); // Small wait
    } catch (error) {
      console.log('❌ [2/4] Perplexity extractor failed:', error.message);
      perplexityExtractor = null;
    }

    // Step 3: Initialize Puppeteer (browser required - WAIT FOR COMPLETE INITIALIZATION)
    console.log('🔄 [3/4] Initializing Puppeteer extractor...');
    try {
      puppeteerExtractor = new PuppeteerExtractor();
      
      // Wait for complete browser initialization
      console.log('🔄 [3/4] Starting Puppeteer browser initialization...');
      await puppeteerExtractor.initialize();
      console.log('✅ [3/4] Puppeteer browser launched successfully');
      
      // Test the browser to ensure it's actually working
      console.log('🔄 [3/4] Testing Puppeteer functionality...');
      const healthCheck = await puppeteerExtractor.healthCheck();
      if (healthCheck) {
        console.log('✅ [3/4] Puppeteer extractor fully operational');
      } else {
        throw new Error('Health check failed');
      }
      
      // Long wait after browser initialization to ensure stability
      console.log('🔄 [3/4] Waiting for Puppeteer stability...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log('⚠️ [3/4] Puppeteer extractor failed to initialize:', error.message);
      console.log('🔍 Puppeteer error details:', error.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace');
      
      // Clean up failed Puppeteer instance
      if (puppeteerExtractor) {
        try {
          await puppeteerExtractor.cleanup();
        } catch (cleanupError) {
          console.log('⚠️ [3/4] Puppeteer cleanup error:', cleanupError.message);
        }
      }
      puppeteerExtractor = null;
      
      // Wait before next initialization even after failure
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 4: Initialize Playwright (browser required - COMPLETE SERIAL WAIT)
    console.log('🔄 [4/4] Initializing Playwright extractor...');
    try {
      playwrightExtractor = new PlaywrightExtractor();
      
      // Wait for complete browser initialization  
      console.log('🔄 [4/4] Starting Playwright browser initialization...');
      await playwrightExtractor.initialize();
      console.log('✅ [4/4] Playwright browser launched successfully');
      
      // Test the browser to ensure it's actually working
      console.log('🔄 [4/4] Testing Playwright functionality...');
      const healthCheck = await playwrightExtractor.healthCheck();
      if (healthCheck) {
        console.log('✅ [4/4] Playwright extractor fully operational');
      } else {
        throw new Error('Health check failed');
      }
      
      console.log('🔄 [4/4] Waiting for Playwright stability...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error: any) {
      console.log('⚠️ [4/4] Playwright extractor failed to initialize:', error.message);
      console.log('🔍 Playwright error details:', error.stack?.split('\n').slice(0, 3).join('\n') || 'No stack trace');
      
      // Clean up failed Playwright instance
      if (playwrightExtractor) {
        try {
          await playwrightExtractor.cleanup();
        } catch (cleanupError) {
          console.log('⚠️ [4/4] Playwright cleanup error:', cleanupError.message);
        }
      }
      playwrightExtractor = null;
    }

    // Final status check and validation
    const workingExtractors = [
      axiosCheerioExtractor && 'Axios/Cheerio',
      perplexityExtractor && 'Perplexity',
      puppeteerExtractor && 'Puppeteer', 
      playwrightExtractor && 'Playwright'
    ].filter(Boolean);

    console.log(`\n📊 FINAL EXTRACTOR STATUS:`);
    console.log(`  ✅ Axios/Cheerio: ${axiosCheerioExtractor ? 'READY' : 'FAILED'}`);
    console.log(`  ✅ Perplexity: ${perplexityExtractor ? 'READY' : 'FAILED'}`);
    console.log(`  ✅ Puppeteer: ${puppeteerExtractor ? 'READY' : 'FAILED'}`);
    console.log(`  ✅ Playwright: ${playwrightExtractor ? 'READY' : 'FAILED'}`);
    console.log(`\n🚀 ${workingExtractors.length}/4 extractors operational: ${workingExtractors.join(', ')}`);

    // Ensure we have at least one working extractor
    if (workingExtractors.length === 0) {
      throw new Error('CRITICAL: No extractors could be initialized - beta server cannot function');
    }

    // Only mark as initialized after all initialization attempts are complete
    extractorsInitialized = true;
    console.log('✅ Extractor initialization process completed');

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

    // Update the smoke test endpoint - independent extractor evaluation (no fallbacks)
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
          data: { confidence: 0, companyName: null },
          extractorsStatus: {
            axios_cheerio: !!axiosCheerioExtractor,
            perplexity: !!perplexityExtractor,
            puppeteer: !!puppeteerExtractor,
            playwright: !!playwrightExtractor
          }
        });
      }

      console.log(`🧪 [Beta] Starting independent ${method} extraction for ${domain}`);

      try {
        let result: any = null;

        switch (method) {
          case 'axios_cheerio':
            if (!axiosCheerioExtractor) {
              throw new Error('Axios/Cheerio extractor not available - independent evaluation failed');
            }
            console.log(`🔧 [Beta] Using Axios/Cheerio extractor for ${domain}`);
            result = await axiosCheerioExtractor.extractFromDomain(domain);
            break;

          case 'puppeteer':
            if (!puppeteerExtractor) {
              throw new Error('Puppeteer extractor not available - independent evaluation failed');
            }
            console.log(`🔧 [Beta] Using Puppeteer extractor for ${domain}`);
            result = await puppeteerExtractor.extractFromDomain(domain);
            break;

          case 'playwright':
            if (!playwrightExtractor) {
              throw new Error('Playwright extractor not available - independent evaluation failed');
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
              throw new Error('Perplexity extractor not available - independent evaluation failed');
            }
            console.log(`🔧 [Beta] Using Perplexity extractor for ${domain}`);
            result = await perplexityExtractor.extractFromDomain(domain);
            break;

          default:
            return res.status(400).json({ error: 'Invalid method' });
        }

        console.log(`✅ [Beta] Independent ${method} extraction completed for ${domain}:`, result?.success ? 'SUCCESS' : 'FAILED');

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
        console.error(`❌ [Beta] Independent ${method} evaluation failed for ${domain}:`, error.message);

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