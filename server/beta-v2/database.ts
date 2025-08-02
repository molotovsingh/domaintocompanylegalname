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
export async function executeBetaV2Query(query: string, params: any[]): Promise<any> {
  try {
    // Replace $1, $2, etc. with actual values for Neon compatibility
    let processedQuery = query;
    if (params && params.length > 0) {
      params.forEach((param, index) => {
        const placeholder = `$${index + 1}`;
        const value = param === null || param === undefined ? 'NULL' : 
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
  } catch (error: any) {
    console.error('[Beta v2] Query execution error:', error);

    // Handle specific Neon database errors
    if (error.message?.includes('endpoint has been disabled')) {
      console.error('[Beta v2] Database endpoint is disabled. Please check Neon console.');
      // Return empty result to prevent crashes
      return { rows: [] };
    }

    throw error;
  }
}

// Create crawlee_dumps table
export async function initCrawleeDumpTable() {
  try {
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS crawlee_dumps (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        max_pages INTEGER DEFAULT 10,
        max_depth INTEGER DEFAULT 2,
        wait_time INTEGER DEFAULT 1000,
        include_paths JSONB,
        exclude_paths JSONB,
        dump_data JSONB,
        pages_crawled INTEGER DEFAULT 0,
        total_size_bytes INTEGER DEFAULT 0,
        processing_time_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_domain ON crawlee_dumps(domain)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_status ON crawlee_dumps(status)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_crawlee_dumps_created_at ON crawlee_dumps(created_at DESC)
    `);

    console.log('[Beta v2] Crawlee dumps table initialized');
  } catch (error) {
    console.error('[Beta v2] Crawlee table initialization error:', error);
    // Continue anyway - table might already exist
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

// Create axios_cheerio_dumps table
export async function initGLEIFSearchTables() {
  try {
    // Create search requests table
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS gleif_search_requests (
        id SERIAL PRIMARY KEY,
        suspected_name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        search_method VARCHAR(50),
        jurisdiction VARCHAR(10),
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create candidates table
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS gleif_candidates_v2 (
        id SERIAL PRIMARY KEY,
        search_id INTEGER REFERENCES gleif_search_requests(id) ON DELETE CASCADE,
        lei_code VARCHAR(20) NOT NULL,
        legal_name TEXT NOT NULL,
        entity_status VARCHAR(50),
        legal_form VARCHAR(255),
        legal_form_code VARCHAR(50),
        jurisdiction VARCHAR(10),
        entity_category VARCHAR(50),
        entity_sub_category VARCHAR(50),
        headquarters_country VARCHAR(10),
        headquarters_city VARCHAR(255),
        headquarters_region VARCHAR(255),
        headquarters_postal_code VARCHAR(50),
        headquarters_address_line TEXT,
        legal_address_country VARCHAR(10),
        legal_address_city VARCHAR(255),
        legal_address_region VARCHAR(255),
        legal_address_postal_code VARCHAR(50),
        legal_address_line TEXT,
        registration_status VARCHAR(50),
        initial_registration_date DATE,
        last_update_date DATE,
        next_renewal_date DATE,
        managing_lou VARCHAR(20),
        name_match_score INTEGER,
        fortune500_score INTEGER,
        tld_jurisdiction_score INTEGER,
        entity_complexity_score INTEGER,
        weighted_total_score INTEGER,
        selection_reason TEXT,
        other_names JSONB,
        validation_sources TEXT,
        bic_codes JSONB,
        gleif_raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for search requests
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_gleif_search_status ON gleif_search_requests(status)
    `);

    // Create indexes for candidates
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_gleif_candidates_search_id ON gleif_candidates_v2(search_id)
    `);

    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_gleif_candidates_lei ON gleif_candidates_v2(lei_code)
    `);

    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_gleif_candidates_scores ON gleif_candidates_v2(weighted_total_score DESC)
    `);

    console.log('[Beta v2] GLEIF search tables initialized');
  } catch (error) {
    console.error('[Beta v2] GLEIF tables initialization error:', error);
    // Continue anyway - tables might already exist
  }
}

// Create processing_results table
export async function initProcessingResultsTable() {
  try {
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS beta_v2_processing_results (
        id SERIAL PRIMARY KEY,
        source_type VARCHAR(50) NOT NULL,
        source_id INTEGER NOT NULL,
        domain VARCHAR(255) NOT NULL,

        -- Stage 1: HTML Stripping
        stage1_stripped_text TEXT,
        stage1_processing_time_ms INTEGER,

        -- Stage 2: Data Extraction
        stage2_extracted_data JSONB,
        stage2_model_used VARCHAR(100),
        stage2_processing_time_ms INTEGER,

        -- Stage 3: Entity Name Extraction
        stage3_entity_name VARCHAR(255),
        stage3_entity_confidence DECIMAL(3,2),
        stage3_model_used VARCHAR(100),
        stage3_processing_time_ms INTEGER,
        stage3_reasoning TEXT,
        stage3_alternative_names JSONB,

        -- Stage 4: GLEIF Results
        stage4_gleif_search_id INTEGER,
        stage4_primary_lei VARCHAR(20),
        stage4_primary_legal_name VARCHAR(500),
        stage4_confidence_score DECIMAL(3,2),
        stage4_total_candidates INTEGER,

        -- Overall status
        processing_status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        total_processing_time_ms INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_processing_results_source ON beta_v2_processing_results(source_type, source_id)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_processing_results_domain ON beta_v2_processing_results(domain)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_processing_results_status ON beta_v2_processing_results(processing_status)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_processing_results_created ON beta_v2_processing_results(created_at DESC)
    `);

    console.log('[Beta v2] Processing results table initialized');
  } catch (error) {
    console.error('[Beta v2] Processing results table initialization error:', error);
    // Continue anyway - table might already exist
  }
}

export async function initAxiosCheerioTable() {
  try {
    await betaV2Db.execute(sql`
      CREATE TABLE IF NOT EXISTS axios_cheerio_dumps (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        company_name TEXT,
        extraction_method TEXT,
        confidence_score INTEGER,
        http_status INTEGER,
        response_time_ms INTEGER,
        html_size_bytes INTEGER,
        processing_time_ms INTEGER,
        raw_html TEXT,
        headers JSONB,
        meta_tags JSONB,
        extraction_results JSONB,
        page_metadata JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // Create indexes
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_axios_cheerio_dumps_domain ON axios_cheerio_dumps(domain)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_axios_cheerio_dumps_status ON axios_cheerio_dumps(status)
    `);
    await betaV2Db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_axios_cheerio_dumps_created_at ON axios_cheerio_dumps(created_at DESC)
    `);

    console.log('[Beta v2] Axios+Cheerio dumps table initialized');
  } catch (error) {
    console.error('[Beta v2] Axios+Cheerio table initialization error:', error);
    // Continue anyway - table might already exist
  }
}