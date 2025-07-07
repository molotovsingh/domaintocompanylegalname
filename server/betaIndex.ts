import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests, insertBetaSmokeTestSchema } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { PuppeteerExtractor } from './betaServices/puppeteerExtractor';

const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

// Function to cleanup previous beta server instances
async function cleanupPreviousInstances() {
  try {
    console.log('🧹 Cleaning up previous beta server instances...');
    
    // Kill any existing betaIndex.ts processes
    await execAsync('pkill -f "betaIndex.ts" || true');
    
    // Wait a moment for processes to terminate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if port 3001 is still occupied and kill it
    try {
      const { stdout } = await execAsync('lsof -ti:3001 || true');
      if (stdout.trim()) {
        await execAsync(`kill -9 ${stdout.trim()} || true`);
        console.log('🔄 Freed up port 3001');
      }
    } catch (e) {
      // Port was already free
    }
    
    console.log('✅ Previous instances cleaned up successfully');
  } catch (error) {
    console.log('⚠️  Cleanup completed (some processes may not have existed)');
  }
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
      // TODO: Implement playwright extractor
      res.status(400).json({ error: 'Playwright not implemented yet' });
    } else if (method === 'axios_cheerio') {
      // TODO: Implement axios_cheerio extractor
      res.status(400).json({ error: 'Axios/Cheerio not implemented yet' });
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

// Main startup function
async function startBetaServer() {
  // First, cleanup any previous instances
  await cleanupPreviousInstances();
  
  // Start the server
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🧪 Beta Testing Platform running on port ${PORT}`);
    console.log(`🔬 Complete database isolation from production`);
    console.log(`🚀 Ready for experimental features`);
    console.log(`🌐 Accessible at http://0.0.0.0:${PORT}`);
    
    // Initialize experiments
    await initializeBetaExperiments();
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Beta server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Beta server interrupted, shutting down...');
  process.exit(0);
});

// Start the server
startBetaServer().catch((error) => {
  console.error('❌ Failed to start beta server:', error);
  process.exit(1);
});