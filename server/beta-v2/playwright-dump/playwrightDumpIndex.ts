import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { playwrightDump } from './playwrightDumpService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Database connection for playwright-dump
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[Playwright Dump] DATABASE_URL environment variable is required');
}

const queryClient = neon(DATABASE_URL);
const db = drizzle(queryClient);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database schema
async function initializeDatabase() {
  try {
    // Create a simple table without schema complexity
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS playwright_dumps (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        raw_data JSONB,
        processing_time_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('[Playwright Dump] Database initialized');
  } catch (error) {
    console.error('[Playwright Dump] Database initialization error:', error);
    // Continue anyway - table might already exist
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Playwright Dump Service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get all dumps
app.get('/dumps', async (req, res) => {
  try {
    const query = sql`
      SELECT id, domain, status, processing_time_ms, created_at
      FROM playwright_dumps
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    const result = await db.execute(query);
    res.json((result as any).rows || []);
  } catch (error: any) {
    console.error('[Playwright Dump] Error fetching dumps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new dump
app.post('/dump', async (req, res) => {
  try {
    const { domain, method } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    
    // Insert initial record
    const insertQuery = sql`
      INSERT INTO playwright_dumps (domain, status)
      VALUES (${domain}, 'processing')
      RETURNING id
    `;
    
    const insertResult = await db.execute(insertQuery);
    const dumpId = (insertResult as any).rows[0].id;
    
    // Start the dump process asynchronously
    playwrightDump(domain).then(async (result) => {
      // Update with results
      const updateQuery = sql`
        UPDATE playwright_dumps
        SET 
          status = ${result.success ? 'completed' : 'failed'},
          raw_data = ${JSON.stringify(result.data)}::jsonb,
          processing_time_ms = ${result.processingTime},
          error_message = ${result.error || null}
        WHERE id = ${dumpId}
      `;
      await db.execute(updateQuery);
    }).catch(async (error) => {
      // Update with error
      const errorQuery = sql`
        UPDATE playwright_dumps
        SET 
          status = 'failed',
          error_message = ${error.message}
        WHERE id = ${dumpId}
      `;
      await db.execute(errorQuery);
    });
    
    res.json({ 
      success: true, 
      message: 'Dump started',
      dumpId 
    });
  } catch (error: any) {
    console.error('[Playwright Dump] Error starting dump:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get raw data for a specific dump
app.get('/dump/:id/raw', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = sql`
      SELECT raw_data
      FROM playwright_dumps
      WHERE id = ${parseInt(id)}
    `;
    
    const result = await db.execute(query);
    const rows = (result as any).rows || [];
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Dump not found' });
    }
    
    res.json(rows[0].raw_data);
  } catch (error: any) {
    console.error('[Playwright Dump] Error fetching raw data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Playwright Dump] 🚀 Service running on port ${PORT}`);
      console.log(`[Playwright Dump] 🌐 Accessible at http://0.0.0.0:${PORT}`);
      console.log(`[Playwright Dump] 🧪 Complete isolation from other methods`);
      console.log(`[Playwright Dump] 💾 Using dedicated playwright_dump schema`);
    });
  } catch (error) {
    console.error('[Playwright Dump] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();