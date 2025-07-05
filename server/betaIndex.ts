
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
    
    // Simple beta smoke test (placeholder - will enhance)
    const startTime = Date.now();
    const success = Math.random() > 0.3; // 70% success rate for demo
    const processingTime = Date.now() - startTime + Math.random() * 2000;
    
    const result = {
      domain,
      method,
      companyName: success ? `${domain.split('.')[0]} Corp` : null,
      confidence: success ? Math.floor(Math.random() * 30) + 70 : 0,
      processingTime: Math.floor(processingTime),
      success,
      error: success ? null : 'Beta test simulation error',
      extractionMethod: success ? 'beta_extraction' : null,
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧪 Beta Testing Platform running on port ${PORT}`);
  console.log(`🔬 Complete database isolation from production`);
  console.log(`🚀 Ready for experimental features`);
});
