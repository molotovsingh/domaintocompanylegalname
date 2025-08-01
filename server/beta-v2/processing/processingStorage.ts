import { sql } from 'drizzle-orm';
import { betaV2Db } from '../database';
import { ProcessingResult, CreateProcessingInput, ProcessingStatus } from './processingTypes';

class ProcessingStorage {
  /**
   * Create a new processing result record
   */
  async createProcessingResult(input: CreateProcessingInput): Promise<number> {
    try {
      const result = await betaV2Db.execute(sql`
        INSERT INTO beta_v2_processing_results (
          source_type, source_id, domain, processing_status
        ) VALUES (
          ${input.sourceType}, ${input.sourceId}, ${input.domain}, ${input.processingStatus}
        ) RETURNING id
      `);
      
      return result.rows[0].id as number;
    } catch (error) {
      console.error('[ProcessingStorage] Error creating processing result:', error);
      throw error;
    }
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(id: number, status: ProcessingStatus, errorMessage?: string): Promise<void> {
    try {
      if (errorMessage) {
        await betaV2Db.execute(sql`
          UPDATE beta_v2_processing_results 
          SET processing_status = ${status}, 
              error_message = ${errorMessage},
              updated_at = NOW()
          WHERE id = ${id}
        `);
      } else {
        await betaV2Db.execute(sql`
          UPDATE beta_v2_processing_results 
          SET processing_status = ${status}, 
              updated_at = NOW()
          WHERE id = ${id}
        `);
      }
    } catch (error) {
      console.error('[ProcessingStorage] Error updating status:', error);
      throw error;
    }
  }

  /**
   * Update Stage 1 results
   */
  async updateStage1(id: number, result: { strippedText: string; processingTime: number }): Promise<void> {
    try {
      await betaV2Db.execute(sql`
        UPDATE beta_v2_processing_results 
        SET stage1_stripped_text = ${result.strippedText},
            stage1_processing_time_ms = ${result.processingTime},
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('[ProcessingStorage] Error updating stage 1:', error);
      throw error;
    }
  }

  /**
   * Update Stage 2 results
   */
  async updateStage2(id: number, result: { extractedData: any; modelUsed: string; processingTime: number }): Promise<void> {
    try {
      await betaV2Db.execute(sql`
        UPDATE beta_v2_processing_results 
        SET stage2_extracted_data = ${JSON.stringify(result.extractedData)}::jsonb,
            stage2_model_used = ${result.modelUsed},
            stage2_processing_time_ms = ${result.processingTime},
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('[ProcessingStorage] Error updating stage 2:', error);
      throw error;
    }
  }

  /**
   * Update Stage 3 results
   */
  async updateStage3(id: number, result: {
    entityName: string | null;
    confidence: number;
    modelUsed: string;
    processingTime: number;
    reasoning: string;
    alternativeNames: string[];
  }): Promise<void> {
    try {
      await betaV2Db.execute(sql`
        UPDATE beta_v2_processing_results 
        SET stage3_entity_name = ${result.entityName},
            stage3_entity_confidence = ${result.confidence},
            stage3_model_used = ${result.modelUsed},
            stage3_processing_time_ms = ${result.processingTime},
            stage3_reasoning = ${result.reasoning},
            stage3_alternative_names = ${JSON.stringify(result.alternativeNames)}::jsonb,
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('[ProcessingStorage] Error updating stage 3:', error);
      throw error;
    }
  }

  /**
   * Update Stage 4 results
   */
  async updateStage4(id: number, result: {
    gleifSearchId: number;
    primaryLei: string | null;
    primaryLegalName: string | null;
    confidenceScore: number;
    totalCandidates: number;
  }): Promise<void> {
    try {
      await betaV2Db.execute(sql`
        UPDATE beta_v2_processing_results 
        SET stage4_gleif_search_id = ${result.gleifSearchId},
            stage4_primary_lei = ${result.primaryLei},
            stage4_primary_legal_name = ${result.primaryLegalName},
            stage4_confidence_score = ${result.confidenceScore},
            stage4_total_candidates = ${result.totalCandidates},
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('[ProcessingStorage] Error updating stage 4:', error);
      throw error;
    }
  }

  /**
   * Complete processing
   */
  async completeProcessing(id: number, totalTime: number): Promise<void> {
    try {
      await betaV2Db.execute(sql`
        UPDATE beta_v2_processing_results 
        SET processing_status = 'completed',
            total_processing_time_ms = ${totalTime},
            updated_at = NOW()
        WHERE id = ${id}
      `);
    } catch (error) {
      console.error('[ProcessingStorage] Error completing processing:', error);
      throw error;
    }
  }

  /**
   * Get processing result by ID
   */
  async getProcessingResult(id: number): Promise<ProcessingResult> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT * FROM beta_v2_processing_results WHERE id = ${id}
      `);
      
      if (result.rows.length === 0) {
        throw new Error('Processing result not found');
      }
      
      return this.mapToProcessingResult(result.rows[0]);
    } catch (error) {
      console.error('[ProcessingStorage] Error getting processing result:', error);
      throw error;
    }
  }

  /**
   * Get all processing results
   */
  async getAllProcessingResults(limit: number = 50): Promise<ProcessingResult[]> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT * FROM beta_v2_processing_results 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `);
      
      return result.rows.map(row => this.mapToProcessingResult(row));
    } catch (error) {
      console.error('[ProcessingStorage] Error getting all processing results:', error);
      throw error;
    }
  }

  /**
   * Get dump data from different tables
   */
  async getCrawleeDumps(): Promise<any[]> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, dump_data, created_at 
        FROM crawlee_dumps 
        WHERE status = 'completed' AND dump_data IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      return result.rows;
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Crawlee dumps:', error);
      return [];
    }
  }

  async getScrapyCrawls(): Promise<any[]> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, raw_data, created_at 
        FROM scrapy_crawls 
        WHERE status = 'completed' AND raw_data IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      return result.rows;
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Scrapy crawls:', error);
      return [];
    }
  }

  async getPlaywrightDumps(): Promise<any[]> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, raw_data AS dump_data, created_at 
        FROM playwright_dumps 
        WHERE status = 'completed' AND raw_data IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      return result.rows;
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Playwright dumps:', error);
      return [];
    }
  }

  async getAxiosCheerioDumps(): Promise<any[]> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, 
               JSONB_BUILD_OBJECT(
                 'html', raw_html,
                 'headers', headers,
                 'meta_tags', meta_tags,
                 'extraction_strategies', extraction_strategies,
                 'page_metadata', page_metadata
               ) AS dump_data, 
               created_at 
        FROM axios_cheerio_dumps 
        WHERE status = 'completed' AND raw_html IS NOT NULL
        ORDER BY created_at DESC 
        LIMIT 20
      `);
      return result.rows;
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Axios+Cheerio dumps:', error);
      return [];
    }
  }

  /**
   * Get individual dump by ID
   */
  async getCrawleeDump(id: number): Promise<any> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT * FROM crawlee_dumps WHERE id = ${id}
      `);
      return result.rows[0];
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Crawlee dump:', error);
      return null;
    }
  }

  async getScrapyCrawl(id: number): Promise<any> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT * FROM scrapy_crawls WHERE id = ${id}
      `);
      return result.rows[0];
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Scrapy crawl:', error);
      return null;
    }
  }

  async getPlaywrightDump(id: number): Promise<any> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, raw_data AS dump_data, created_at 
        FROM playwright_dumps 
        WHERE id = ${id}
      `);
      return result.rows[0];
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Playwright dump:', error);
      return null;
    }
  }

  async getAxiosCheerioDump(id: number): Promise<any> {
    try {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, 
               JSONB_BUILD_OBJECT(
                 'html', raw_html,
                 'headers', headers,
                 'meta_tags', meta_tags,
                 'extraction_strategies', extraction_strategies,
                 'page_metadata', page_metadata
               ) AS dump_data, 
               created_at 
        FROM axios_cheerio_dumps 
        WHERE id = ${id}
      `);
      return result.rows[0];
    } catch (error) {
      console.error('[ProcessingStorage] Error getting Axios+Cheerio dump:', error);
      return null;
    }
  }

  /**
   * Map database row to ProcessingResult type
   */
  private mapToProcessingResult(row: any): ProcessingResult {
    return {
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      domain: row.domain,
      
      stage1StrippedText: row.stage1_stripped_text,
      stage1ProcessingTimeMs: row.stage1_processing_time_ms,
      
      stage2ExtractedData: row.stage2_extracted_data,
      stage2ModelUsed: row.stage2_model_used,
      stage2ProcessingTimeMs: row.stage2_processing_time_ms,
      
      stage3EntityName: row.stage3_entity_name,
      stage3EntityConfidence: row.stage3_entity_confidence,
      stage3ModelUsed: row.stage3_model_used,
      stage3ProcessingTimeMs: row.stage3_processing_time_ms,
      stage3Reasoning: row.stage3_reasoning,
      stage3AlternativeNames: row.stage3_alternative_names,
      
      stage4GleifSearchId: row.stage4_gleif_search_id,
      stage4PrimaryLei: row.stage4_primary_lei,
      stage4PrimaryLegalName: row.stage4_primary_legal_name,
      stage4ConfidenceScore: row.stage4_confidence_score,
      stage4TotalCandidates: row.stage4_total_candidates,
      
      processingStatus: row.processing_status,
      errorMessage: row.error_message,
      totalProcessingTimeMs: row.total_processing_time_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get GLEIF candidates for a search ID
   */
  async getGleifCandidates(searchId: number): Promise<any[]> {
    try {
      const results = await betaV2Db.execute(sql`
        SELECT 
          lei_code,
          legal_name,
          entity_status,
          legal_form,
          headquarters_city,
          headquarters_country,
          weighted_total_score,
          selection_reason
        FROM gleif_candidates_v2 
        WHERE search_id = ${searchId}
        ORDER BY weighted_total_score DESC
      `);
      
      return results.rows;
    } catch (error) {
      console.error('[ProcessingStorage] Error getting GLEIF candidates:', error);
      return [];
    }
  }
}

// Export singleton instance
export const processingStorage = new ProcessingStorage();