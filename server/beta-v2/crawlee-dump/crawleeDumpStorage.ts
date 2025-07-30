import { executeBetaV2Query } from '../database';
import type { CrawleeDump, CrawlConfig, CrawleeDumpData, CrawleeDumpSummary } from './crawleeDumpTypes';

export class CrawleeDumpStorage {
  async createDump(domain: string, config: CrawlConfig): Promise<number> {
    const query = `
      INSERT INTO crawlee_dumps (
        domain, status, max_pages, max_depth, wait_time, 
        include_paths, exclude_paths
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const result = await executeBetaV2Query(query, [
      domain,
      'pending',
      config.maxPages || 10,
      config.maxDepth || 2,
      config.waitTime || 1000,
      config.includePaths || null,
      config.excludePaths || null
    ]);
    
    return result.rows[0].id;
  }

  async updateDumpStatus(id: number, status: string, errorMessage?: string): Promise<void> {
    const query = `
      UPDATE crawlee_dumps 
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE id = $3
    `;
    
    await executeBetaV2Query(query, [status, errorMessage || null, id]);
  }

  async updateDumpData(
    id: number, 
    dumpData: CrawleeDumpData, 
    processingTimeMs: number
  ): Promise<void> {
    const query = `
      UPDATE crawlee_dumps 
      SET 
        dump_data = $1,
        pages_crawled = $2,
        total_size_bytes = $3,
        processing_time_ms = $4,
        status = 'completed',
        updated_at = NOW()
      WHERE id = $5
    `;
    
    await executeBetaV2Query(query, [
      dumpData,
      dumpData.pages.length,
      dumpData.crawlStats.totalSizeBytes,
      processingTimeMs,
      id
    ]);
  }

  async getDump(id: number): Promise<CrawleeDump | null> {
    const query = `
      SELECT 
        id, domain, status, 
        max_pages, max_depth, wait_time,
        include_paths, exclude_paths,
        dump_data, error_message,
        created_at, updated_at
      FROM crawlee_dumps 
      WHERE id = $1
    `;
    
    const result = await executeBetaV2Query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      domain: row.domain,
      status: row.status,
      config: {
        maxPages: row.max_pages,
        maxDepth: row.max_depth,
        waitTime: row.wait_time,
        includePaths: row.include_paths,
        excludePaths: row.exclude_paths
      },
      dumpData: row.dump_data,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async listDumps(limit = 50, offset = 0): Promise<CrawleeDumpSummary[]> {
    const query = `
      SELECT 
        id, domain, status,
        pages_crawled, total_size_bytes, processing_time_ms,
        created_at, error_message
      FROM crawlee_dumps 
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await executeBetaV2Query(query, [limit, offset]);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      domain: row.domain,
      status: row.status,
      pagesCrawled: row.pages_crawled || 0,
      totalSizeBytes: row.total_size_bytes || 0,
      processingTimeMs: row.processing_time_ms || 0,
      createdAt: row.created_at,
      error: row.error_message
    }));
  }

  async deleteDump(id: number): Promise<void> {
    const query = 'DELETE FROM crawlee_dumps WHERE id = $1';
    await executeBetaV2Query(query, [id]);
  }
}