import { executeBetaV2Query } from '../database';
import type { CrawleeDump, CrawlConfig, CrawleeDumpData, CrawleeDumpSummary } from './crawleeDumpTypes';

export class CrawleeDumpStorage {
  async createDump(domain: string, config: CrawlConfig): Promise<number> {
    const query = `
      INSERT INTO crawlee_dumps (
        domain, status, max_pages, max_depth, wait_time, 
        include_paths, exclude_paths, capture_network_requests
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const result = await executeBetaV2Query(query, [
      domain,
      'pending',
      config.maxPages || 10,
      config.maxDepth || 2,
      config.waitTime || 1000,
      config.includePaths || null,
      config.excludePaths || null,
      config.captureNetworkRequests || false
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
    try {
      // For very large JSON data, we need to use a different approach
      // Convert to JSON string first and explicitly cast
      const jsonString = JSON.stringify(dumpData);
      
      // Check if data is very large (> 500KB)
      const isLargeData = jsonString.length > 500000;
      
      if (isLargeData) {
        console.log(`[CrawleeDumpStorage] Large data detected (${jsonString.length} chars), using explicit type handling`);
      }
      
      // Pass parsed JSON object for proper JSONB handling
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
      
      // Log the data being updated for debugging
      console.log(`[CrawleeDumpStorage] Updating dump ${id} with ${dumpData.pages.length} pages`);
      
      await executeBetaV2Query(query, [
        dumpData,  // Pass object directly, driver will handle JSONB conversion
        dumpData.pages.length,
        dumpData.crawlStats.totalSizeBytes,
        processingTimeMs,
        id
      ]);
      
      console.log(`[CrawleeDumpStorage] Successfully updated dump ${id}`);
    } catch (error: any) {
      console.error(`[CrawleeDumpStorage] Failed to update dump ${id}:`, error.message);
      throw error;
    }
  }

  async getDump(id: number): Promise<CrawleeDump | null> {
    const query = `
      SELECT 
        id, domain, status, 
        max_pages, max_depth, wait_time,
        include_paths, exclude_paths, capture_network_requests,
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
        excludePaths: row.exclude_paths,
        captureNetworkRequests: row.capture_network_requests
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