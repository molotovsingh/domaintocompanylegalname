import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';

// Use the same database connection approach as the rest of the project
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const neonSql = neon(databaseUrl);
export const betaV2Db = drizzle(neonSql);

// Create tables without schema
export async function initBetaV2Database() {
  try {
    // Create table directly without schema
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS playwright_dumps (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        raw_data JSONB,
        status VARCHAR(50) DEFAULT 'completed',
        error_message TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('[Beta v2] Database schema initialized');
  } catch (error) {
    console.error('[Beta v2] Database initialization error:', error);
    // Continue anyway - table might already exist
  }
}

// Helper to execute raw SQL
export async function executeBetaV2Query(query: string, params?: any[]): Promise<any> {
  try {
    // Replace $1, $2, etc. with actual values for Neon compatibility
    let processedQuery = query;
    if (params && params.length > 0) {
      params.forEach((param, index) => {
        const placeholder = `$${index + 1}`;
        const value = param === null ? 'NULL' : 
                      typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` :
                      typeof param === 'object' ? `'${JSON.stringify(param).replace(/'/g, "''")}'::jsonb` :
                      param.toString();
        processedQuery = processedQuery.replace(placeholder, value);
      });
    }
    
    // Execute the query directly without schema prefix
    const result = await betaV2Db.execute(sql.raw(processedQuery));
    
    // Return normalized result
    return { 
      rows: Array.isArray(result) ? result : (result as any).rows || [],
      rowCount: Array.isArray(result) ? result.length : (result as any).rowCount || 0
    };
  } catch (error) {
    console.error('[Beta v2] Query execution error:', error);
    throw error;
  }
}

// Create scrapy_crawls table
export async function initScrapyCrawlTable() {
  try {
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS scrapy_crawls (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        raw_data JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[Beta v2] Scrapy crawls table initialized');
  } catch (error) {
    console.error('[Beta v2] Scrapy table initialization error:', error);
  }
}

// Insert a new scrapy crawl record
export async function insertScrapyCrawl(domain: string): Promise<number> {
  const result = await executeBetaV2Query(
    `INSERT INTO scrapy_crawls (domain, status) VALUES ($1, 'pending') RETURNING id`,
    [domain]
  );
  return result.rows[0].id;
}

// Update scrapy crawl status
export async function updateScrapyCrawlStatus(
  id: number, 
  status: string, 
  data: any | null,
  processingTime: number,
  errorMessage?: string
): Promise<void> {
  await executeBetaV2Query(
    `UPDATE scrapy_crawls 
     SET status = $1, raw_data = $2::jsonb, processing_time_ms = $3, error_message = $4
     WHERE id = $5`,
    [status, data ? JSON.stringify(data) : null, processingTime, errorMessage || null, id]
  );
}