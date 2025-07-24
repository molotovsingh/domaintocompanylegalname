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

// Create beta_v2 schema if it doesn't exist
export async function initBetaV2Database() {
  try {
    // Create schema
    await betaV2Db.execute(sql`CREATE SCHEMA IF NOT EXISTS beta_v2`);
    
    // Create tables
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS beta_v2.playwright_dumps (
        id SERIAL PRIMARY KEY,
        domain VARCHAR(255) NOT NULL,
        raw_data JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'completed',
        error_message TEXT,
        processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('[Beta v2] Database schema initialized');
  } catch (error) {
    console.error('[Beta v2] Database initialization error:', error);
    throw error;
  }
}

// Helper to execute raw SQL with beta_v2 schema
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
    
    // Add schema prefix to the query
    const fullQuery = `SET search_path TO beta_v2; ${processedQuery}`;
    
    // Execute the query
    const result = await betaV2Db.execute(sql.raw(fullQuery));
    
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