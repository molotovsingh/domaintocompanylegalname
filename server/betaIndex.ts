import express from 'express';
import cors from 'cors';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { BetaExtractionService } from './betaServices/betaExtractionService';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize extraction service
const extractionService = new BetaExtractionService();

// Health check endpoint - critical for startup detection
app.get('/api/beta/health', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

// Get all beta experiments
app.get('/api/beta/experiments', async (req, res) => {
  try {
    const experiments = await betaDb.select().from(betaExperiments).orderBy(desc(betaExperiments.createdAt));
    res.json({ success: true, experiments });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch experiments' });
  }
});

// Get smoke test results
app.get('/api/beta/smoke-test/results', async (req, res) => {
  try {
    const results = await betaDb.select().from(betaSmokeTests).orderBy(desc(betaSmokeTests.createdAt)).limit(100);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error fetching smoke test results:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch smoke test results' });
  }
});

// Run smoke test
app.post('/api/beta/smoke-test', async (req, res) => {
  try {
    const { domain, method } = req.body;

    if (!domain || !method) {
      return res.status(400).json({ success: false, error: 'Domain and method are required' });
    }

    console.log(`🧪 Running beta smoke test: ${domain} with ${method}`);

    // Run the extraction test with error handling
    const result = await extractionService.testDomain(domain, method);

    // Store result in beta database with enhanced error handling
    try {
      await betaDb.insert(betaSmokeTests).values({
        domain: result.domain,
        method: result.method,
        companyName: result.companyName,
        confidence: result.confidence,
        processingTimeMs: result.processingTime,
        success: result.success,
        error: result.error,
        companyExtractionMethod: result.extractionMethod,
        rawExtractionData: result.technicalDetails ? JSON.parse(JSON.stringify({ details: result.technicalDetails })) : null,
        httpStatus: 200,
        createdAt: new Date()
      });
    } catch (dbError) {
      console.error('Database insertion error:', dbError);
      // Continue with response even if DB insertion fails
    }

    res.json({
      success: true,
      domain: result.domain,
      method: result.method,
      companyName: result.companyName,
      companyConfidence: result.confidence,
      processingTimeMs: result.processingTime,
      extractionSuccess: result.success,
      error: result.error
    });

  } catch (error) {
    console.error('Smoke test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server with better error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧪 Beta Testing Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://0.0.0.0:${PORT}/api/beta/health`);
});

server.on('error', (error: any) => {
  console.error('❌ Beta server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`💥 Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Beta server shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Beta server shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});