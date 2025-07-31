// Core cleaning service for Beta V2 - Updated for beta-v2 database

import { v4 as uuidv4 } from 'uuid';
import { executeBetaV2Query } from '../database';
import { 
  CleaningRequest, 
  CleaningResult, 
  RawDumpData, 
  AvailableDump,
  CleaningSession,
  ModelPerformanceRecord 
} from './types';
import { BaseModelAdapter } from './modelAdapters/baseAdapter';
import { OpenRouterAdapter } from './modelAdapters/openRouterAdapter';
import { 
  CLEANING_SERVICE_CONFIG, 
  getEnabledModels, 
  getModelConfig 
} from './config';

export class CleaningService {
  private modelAdapters: Map<string, BaseModelAdapter> = new Map();

  constructor() {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    const apiKey = CLEANING_SERVICE_CONFIG.openRouterApiKey;
    
    if (!apiKey) {
      console.warn('[CleaningService] No OpenRouter API key found. Service will be limited.');
      return;
    }

    // Initialize adapters for enabled models
    const enabledModels = getEnabledModels();
    
    for (const modelName of enabledModels) {
      const config = getModelConfig(modelName);
      if (config && config.provider === 'openrouter') {
        const adapter = new OpenRouterAdapter(
          apiKey,
          modelName,
          config.modelId,
          config.isFree,
          config.costPer1kTokens
        );
        this.modelAdapters.set(modelName, adapter);
      }
    }

    console.log(`[CleaningService] Initialized ${this.modelAdapters.size} model adapters`);
  }

  /**
   * Get available raw dumps from all collection methods
   */
  async getAvailableDumps(): Promise<AvailableDump[]> {
    const dumps: AvailableDump[] = [];

    try {
      // Get Crawlee dumps
      const crawleeResult = await executeBetaV2Query(`
        SELECT id, domain, created_at, 
               pages_crawled as pages,
               pg_size_pretty(total_size_bytes::bigint) as size
        FROM crawlee_dumps
        WHERE status = 'completed'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      for (const row of crawleeResult.rows) {
        const cleanedResults = await this.getCleanedModels(row.id, 'crawlee_dump');
        dumps.push({
          type: 'crawlee_dump',
          id: row.id,
          domain: row.domain,
          pages: row.pages || 1,
          size: row.size,
          collectedAt: row.created_at,
          hasBeenCleaned: cleanedResults.length > 0,
          cleanedWith: cleanedResults
        });
      }

      // Get Scrapy crawls
      const scrapyResult = await executeBetaV2Query(`
        SELECT id, domain, created_at,
               jsonb_array_length(raw_data->'pages') as pages,
               pg_size_pretty(length(raw_data::text)::bigint) as size
        FROM scrapy_crawls
        WHERE status = 'completed'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      for (const row of scrapyResult.rows) {
        const cleanedResults = await this.getCleanedModels(row.id, 'scrapy_crawl');
        dumps.push({
          type: 'scrapy_crawl',
          id: row.id,
          domain: row.domain,
          pages: row.pages_crawled || 1,
          size: row.size,
          collectedAt: row.created_at,
          hasBeenCleaned: cleanedResults.length > 0,
          cleanedWith: cleanedResults
        });
      }

      // Get Playwright dumps
      const playwrightResult = await executeBetaV2Query(`
        SELECT id, domain, created_at,
               pg_size_pretty(length(raw_data::text)::bigint) as size
        FROM playwright_dumps
        WHERE status = 'completed'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      for (const row of playwrightResult.rows) {
        const cleanedResults = await this.getCleanedModels(row.id, 'playwright_dump');
        dumps.push({
          type: 'playwright_dump',
          id: row.id,
          domain: row.domain,
          pages: 1, // Playwright is single page
          size: row.size,
          collectedAt: row.created_at,
          hasBeenCleaned: cleanedResults.length > 0,
          cleanedWith: cleanedResults
        });
      }

      return dumps;
    } catch (error) {
      console.error('[CleaningService] Error getting available dumps:', error);
      throw error;
    }
  }

  /**
   * Get raw data from a specific dump
   */
  async getRawData(sourceType: string, sourceId: number): Promise<RawDumpData | null> {
    try {
      let query: string;
      
      switch (sourceType) {
        case 'crawlee_dump':
          query = `
            SELECT id, domain, dump_data as content, created_at
            FROM crawlee_dumps
            WHERE id = $1 AND status = 'completed'
          `;
          break;
          
        case 'scrapy_crawl':
          query = `
            SELECT id, domain, crawl_data as content, created_at
            FROM scrapy_crawls
            WHERE id = $1 AND status = 'completed'
          `;
          break;
          
        case 'playwright_dump':
          query = `
            SELECT id, domain, raw_data as content, created_at
            FROM playwright_dumps
            WHERE id = $1 AND status = 'completed'
          `;
          break;
          
        default:
          throw new Error(`Unknown source type: ${sourceType}`);
      }

      const result = await executeBetaV2Query(query, [sourceId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      // Extract text content based on source type
      let textContent = '';
      
      if (sourceType === 'crawlee_dump' && row.content?.pages) {
        // For crawlee dumps, extract text from each page
        textContent = row.content.pages.map((page: any) => {
          // Use cleaned text if available, otherwise extract from HTML
          if (page.text) {
            return page.text;
          } else if (page.html) {
            // Simple HTML text extraction - remove tags
            return page.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          return '';
        }).filter((text: string) => text.length > 0).join('\n\n');
      } else if (sourceType === 'scrapy_crawl' && row.content?.pages) {
        // Extract text from scrapy pages
        textContent = row.content.pages.map((p: any) => p.extracted_data?.text || '').join('\n\n');
      } else if (sourceType === 'playwright_dump' && row.content?.textContent) {
        // Use text content from playwright
        textContent = row.content.textContent;
      }
      
      // If no text content extracted, provide structured data as fallback
      if (!textContent || textContent.length < 100) {
        textContent = JSON.stringify(row.content, null, 2);
      }

      return {
        id: row.id,
        domain: row.domain,
        content: textContent,
        metadata: row.content,
        collectedAt: row.created_at
      };
    } catch (error) {
      console.error('[CleaningService] Error getting raw data:', error);
      throw error;
    }
  }

  /**
   * Process a dump with one or more models
   */
  async processWithModels(request: CleaningRequest): Promise<CleaningResult[]> {
    const { sourceType, sourceId, modelName, compareModels } = request;
    
    // Get raw data
    const rawData = await this.getRawData(sourceType, sourceId);
    if (!rawData) {
      throw new Error(`No data found for ${sourceType} with ID ${sourceId}`);
    }

    // Determine which models to use
    const modelsToUse = compareModels && compareModels.length > 0 
      ? [modelName, ...compareModels]
      : [modelName];

    // Create session if multiple models
    let sessionId: string | undefined;
    if (modelsToUse.length > 1) {
      sessionId = uuidv4();
      await this.createCleaningSession({
        sessionId,
        sourceType,
        sourceId,
        modelsUsed: modelsToUse
      });
    }

    // Process with each model
    const results: CleaningResult[] = [];
    
    for (const model of modelsToUse) {
      const adapter = this.modelAdapters.get(model);
      if (!adapter) {
        console.warn(`[CleaningService] No adapter found for model: ${model}`);
        continue;
      }

      try {
        console.log(`[CleaningService] Processing ${rawData.domain} with ${model}`);
        
        // Clean the data
        const result = await adapter.clean(rawData.content);
        
        // Save the result
        const savedResult = await this.saveCleaningResult(
          sourceType,
          sourceId,
          model,
          result
        );
        
        // Track performance
        await this.recordModelPerformance({
          modelName: model,
          domain: rawData.domain,
          processingTimeMs: result.metadata.processingTimeMs,
          success: true
        });
        
        results.push({ ...result, id: savedResult.id });
      } catch (error) {
        console.error(`[CleaningService] Error processing with ${model}:`, error);
        
        // Track failure
        await this.recordModelPerformance({
          modelName: model,
          domain: rawData.domain,
          processingTimeMs: 0,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Save cleaning result to database
   */
  private async saveCleaningResult(
    sourceType: string,
    sourceId: number,
    modelName: string,
    result: CleaningResult
  ): Promise<{ id: number }> {
    const query = `
      INSERT INTO cleaned_data (
        source_type, source_id, model_name, model_provider,
        cleaned_data, processing_time_ms, token_count,
        cost_estimate, confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    const values = [
      sourceType,
      sourceId,
      modelName,
      result.metadata.provider,
      result.extractedData,
      result.metadata.processingTimeMs,
      result.metadata.tokenCount,
      result.metadata.costEstimate,
      result.metadata.confidenceScore
    ];

    const dbResult = await executeBetaV2Query(query, values);
    return { id: dbResult.rows[0].id };
  }

  /**
   * Get cleaning results for a specific dump
   */
  async getCleaningResults(sourceType: string, sourceId: number): Promise<CleaningResult[]> {
    const query = `
      SELECT id, model_name, model_provider, cleaned_data,
             processing_time_ms, token_count, cost_estimate,
             confidence_score, created_at
      FROM cleaned_data
      WHERE source_type = $1 AND source_id = $2
      ORDER BY created_at DESC
    `;

    const result = await executeBetaV2Query(query, [sourceType, sourceId]);
    
    return result.rows.map(row => ({
      id: row.id,
      extractedData: row.cleaned_data,
      metadata: {
        processingTimeMs: row.processing_time_ms,
        tokenCount: row.token_count,
        costEstimate: parseFloat(row.cost_estimate || '0'),
        confidenceScore: parseFloat(row.confidence_score || '0'),
        model: row.model_name,
        provider: row.model_provider
      }
    }));
  }

  /**
   * Get models that have cleaned a specific dump
   */
  private async getCleanedModels(sourceId: number, sourceType: string): Promise<string[]> {
    const query = `
      SELECT DISTINCT model_name
      FROM cleaned_data
      WHERE source_type = $1 AND source_id = $2
    `;

    const result = await executeBetaV2Query(query, [sourceType, sourceId]);
    return result.rows.map(row => row.model_name);
  }

  /**
   * Create a cleaning session for multi-model comparison
   */
  private async createCleaningSession(session: CleaningSession): Promise<void> {
    const query = `
      INSERT INTO cleaning_sessions (session_id, source_type, source_id, models_used)
      VALUES ($1, $2, $3, $4)
    `;

    await executeBetaV2Query(query, [
      session.sessionId,
      session.sourceType,
      session.sourceId,
      session.modelsUsed
    ]);
  }

  /**
   * Record model performance
   */
  private async recordModelPerformance(record: ModelPerformanceRecord): Promise<void> {
    const query = `
      INSERT INTO model_performance (
        model_name, domain, processing_time_ms, success
      ) VALUES ($1, $2, $3, $4)
    `;

    await executeBetaV2Query(query, [
      record.modelName,
      record.domain,
      record.processingTimeMs,
      record.success
    ]);
  }

  /**
   * Get available models and their status
   */
  getAvailableModels() {
    const models = [];
    
    for (const [name, adapter] of this.modelAdapters) {
      models.push(adapter.getModelInfo());
    }

    return models;
  }
}