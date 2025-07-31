// Storage layer for Axios + Cheerio dumps in Beta V2

import { executeBetaV2Query } from '../database';
import type { 
  AxiosCheerioData, 
  DumpStatus, 
  AxiosCheerioRow 
} from './axiosCheerioTypes';

export class AxiosCheerioStorage {
  
  async createDump(domain: string): Promise<number> {
    const result = await executeBetaV2Query(
      `INSERT INTO axios_cheerio_dumps (domain, status) 
       VALUES ($1, 'pending') 
       RETURNING id`,
      [domain]
    );
    
    return result.rows[0].id;
  }
  
  async updateDumpStatus(dumpId: number, status: string, error?: string): Promise<void> {
    await executeBetaV2Query(
      `UPDATE axios_cheerio_dumps 
       SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status, error || null, dumpId]
    );
  }
  
  async updateDumpData(
    dumpId: number, 
    data: AxiosCheerioData, 
    processingTimeMs: number
  ): Promise<void> {
    await executeBetaV2Query(
      `UPDATE axios_cheerio_dumps 
       SET 
         status = 'completed',
         company_name = $1,
         extraction_method = $2,
         confidence_score = $3,
         http_status = $4,
         response_time_ms = $5,
         html_size_bytes = $6,
         raw_html = $7,
         headers = $8,
         meta_tags = $9,
         extraction_strategies = $10,
         page_metadata = $11,
         error_message = $12,
         processing_time_ms = $13,
         completed_at = CURRENT_TIMESTAMP
       WHERE id = $14`,
      [
        data.extractionResults.companyName,
        data.extractionResults.extractionMethod,
        data.extractionResults.confidence,
        data.httpStatus,
        data.responseTimeMs,
        data.htmlSizeBytes,
        data.rawHtml,
        JSON.stringify(data.headers),
        JSON.stringify(data.metaTags),
        JSON.stringify({
          attempted: data.extractionResults.attemptedStrategies,
          candidates: data.extractionResults.alternativeCandidates
        }),
        JSON.stringify(data.pageMetadata),
        data.error || null,
        processingTimeMs,
        dumpId
      ]
    );
  }
  
  async getDumpStatus(dumpId: number): Promise<DumpStatus | null> {
    const result = await executeBetaV2Query(
      `SELECT * FROM axios_cheerio_dumps WHERE id = $1`,
      [dumpId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row: AxiosCheerioRow = result.rows[0];
    
    return {
      id: row.id,
      domain: row.domain,
      status: row.status as any,
      companyName: row.company_name || undefined,
      confidence: row.confidence_score || undefined,
      extractionMethod: row.extraction_method || undefined,
      processingTimeMs: row.processing_time_ms || undefined,
      error: row.error_message || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined
    };
  }
  
  async getRecentDumps(limit: number = 20): Promise<DumpStatus[]> {
    const result = await executeBetaV2Query(
      `SELECT * FROM axios_cheerio_dumps 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows.map((row: AxiosCheerioRow) => ({
      id: row.id,
      domain: row.domain,
      status: row.status as any,
      companyName: row.company_name || undefined,
      confidence: row.confidence_score || undefined,
      extractionMethod: row.extraction_method || undefined,
      processingTimeMs: row.processing_time_ms || undefined,
      error: row.error_message || undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined
    }));
  }
  
  async getDumpData(dumpId: number): Promise<AxiosCheerioRow | null> {
    const result = await executeBetaV2Query(
      `SELECT * FROM axios_cheerio_dumps WHERE id = $1`,
      [dumpId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }
  
  async initializeTable(): Promise<void> {
    console.log('[Beta v2] Creating axios_cheerio_dumps table...');
    
    // Check if table exists
    const tableCheck = await executeBetaV2Query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'axios_cheerio_dumps'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Create the table
      await executeBetaV2Query(`
        CREATE TABLE axios_cheerio_dumps (
          id SERIAL PRIMARY KEY,
          domain VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          
          -- Extraction results
          company_name TEXT,
          extraction_method VARCHAR(100),
          confidence_score INTEGER,
          
          -- Technical data
          http_status INTEGER,
          response_time_ms INTEGER,
          html_size_bytes INTEGER,
          
          -- Raw data
          raw_html TEXT,
          headers JSONB,
          meta_tags JSONB,
          
          -- Extraction details
          extraction_strategies JSONB,
          page_metadata JSONB,
          
          -- Error handling
          error_message TEXT,
          error_details JSONB,
          
          -- Timestamps
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          
          -- Processing stats
          processing_time_ms INTEGER
        );
      `);
      
      // Create indexes
      await executeBetaV2Query(`
        CREATE INDEX idx_axios_cheerio_domain ON axios_cheerio_dumps(domain);
      `);
      
      await executeBetaV2Query(`
        CREATE INDEX idx_axios_cheerio_status ON axios_cheerio_dumps(status);
      `);
      
      console.log('[Beta v2] Axios Cheerio dumps table initialized');
    } else {
      console.log('[Beta v2] Axios Cheerio dumps table already exists');
    }
  }
}