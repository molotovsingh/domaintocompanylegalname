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
      console.log('[CleaningService] Fetching available dumps from all collection methods...');
      
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

      console.log(`[CleaningService] Found ${crawleeResult.rows.length} Crawlee dumps`);

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

      // Get Scrapy crawls - include both 'completed' and 'success' status
      const scrapyResult = await executeBetaV2Query(`
        SELECT id, domain, created_at, status,
               CASE 
                 WHEN raw_data ? 'pages' THEN jsonb_array_length(raw_data->'pages')
                 WHEN raw_data ? 'siteMap' THEN jsonb_array_length(raw_data->'siteMap')
                 ELSE 1
               END as pages,
               pg_size_pretty(length(raw_data::text)::bigint) as size
        FROM scrapy_crawls
        WHERE status IN ('completed', 'success') AND raw_data IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20
      `);

      console.log(`[CleaningService] Found ${scrapyResult.rows.length} Scrapy crawls`);

      for (const row of scrapyResult.rows) {
        const cleanedResults = await this.getCleanedModels(row.id, 'scrapy_crawl');
        dumps.push({
          type: 'scrapy_crawl',
          id: row.id,
          domain: row.domain,
          pages: row.pages || 1,
          size: row.size,
          collectedAt: row.created_at,
          hasBeenCleaned: cleanedResults.length > 0,
          cleanedWith: cleanedResults
        });
      }

      // Get Playwright dumps - include both 'completed' and 'success' status
      const playwrightResult = await executeBetaV2Query(`
        SELECT id, domain, created_at, status,
               pg_size_pretty(length(raw_data::text)::bigint) as size
        FROM playwright_dumps
        WHERE status IN ('completed', 'success') AND raw_data IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20
      `);

      console.log(`[CleaningService] Found ${playwrightResult.rows.length} Playwright dumps`);

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

      // Get Axios+Cheerio dumps
      const axiosCheerioResult = await executeBetaV2Query(`
        SELECT id, domain, created_at, 
               html_size_bytes,
               pg_size_pretty(html_size_bytes::bigint) as size,
               company_name,
               confidence_score
        FROM axios_cheerio_dumps
        WHERE status = 'completed'
        ORDER BY created_at DESC
        LIMIT 20
      `);

      console.log(`[CleaningService] Found ${axiosCheerioResult.rows.length} Axios+Cheerio dumps`);

      for (const row of axiosCheerioResult.rows) {
        const cleanedResults = await this.getCleanedModels(row.id, 'axios_cheerio_dump');
        dumps.push({
          type: 'axios_cheerio_dump',
          id: row.id,
          domain: row.domain,
          pages: 1, // Axios+Cheerio captures single page
          size: row.size,
          collectedAt: row.created_at,
          hasBeenCleaned: cleanedResults.length > 0,
          cleanedWith: cleanedResults
        });
      }

      console.log(`[CleaningService] Total dumps found: ${dumps.length} (Crawlee: ${dumps.filter(d => d.type === 'crawlee_dump').length}, Scrapy: ${dumps.filter(d => d.type === 'scrapy_crawl').length}, Playwright: ${dumps.filter(d => d.type === 'playwright_dump').length}, Axios+Cheerio: ${dumps.filter(d => d.type === 'axios_cheerio_dump').length})`);
      
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
            SELECT id, domain, raw_data as content, created_at
            FROM scrapy_crawls
            WHERE id = $1 AND status IN ('completed', 'success')
          `;
          break;
          
        case 'playwright_dump':
          query = `
            SELECT id, domain, raw_data as content, created_at
            FROM playwright_dumps
            WHERE id = $1 AND status IN ('completed', 'success')
          `;
          break;
          
        case 'axios_cheerio_dump':
          query = `
            SELECT id, domain, raw_html as content, meta_tags, page_metadata, created_at
            FROM axios_cheerio_dumps
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
      
      // Parse JSON content if it's a string
      if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
        try {
          row.content = JSON.parse(row.content);
        } catch (e) {
          console.error('[CleaningService] Failed to parse JSON content:', e);
        }
      }
      
      // Extract enhanced metadata based on source type
      let enhancedMetadata: any = {};
      
      // For cleaning, we want to preserve the original structure
      // The adapters will handle extraction properly
      let contentForCleaning = row.content;
      
      if (sourceType === 'crawlee_dump' && row.content?.pages) {
        // Extract enhanced metadata from pages (aggregate from all pages)
        if (row.content.pages.length > 0) {
          const firstPage = row.content.pages[0];
          if (firstPage.metadata) {
            enhancedMetadata = {
              language: firstPage.metadata.language,
              location: firstPage.metadata.location,
              currency: firstPage.metadata.currency,
              contentPatterns: firstPage.metadata.contentPatterns
            };
          }
        }
        // Keep the full structure for the adapter to process
        contentForCleaning = row.content;
      } else if (sourceType === 'scrapy_crawl') {
        // Keep the full structure for scrapy data
        contentForCleaning = row.content;
      } else if (sourceType === 'playwright_dump') {
        // Keep the full structure for playwright dumps
        contentForCleaning = row.content;
      } else if (sourceType === 'axios_cheerio_dump') {
        // For axios+cheerio, the content is already HTML
        contentForCleaning = row.content;
      }

      // Build proper metadata object for axios_cheerio dumps
      let metadata = row.content;
      if (sourceType === 'axios_cheerio_dump') {
        metadata = {
          raw_html: row.content,
          meta_tags: row.meta_tags,
          page_metadata: row.page_metadata
        };
      }

      return {
        id: row.id,
        domain: row.domain,
        content: contentForCleaning,  // Pass the full structure to adapters
        metadata: metadata,
        enhancedMetadata: Object.keys(enhancedMetadata).length > 0 ? enhancedMetadata : undefined,
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
        
        // Create enhanced system prompt if metadata is available
        let systemPrompt: string | undefined;
        if (rawData.enhancedMetadata) {
          systemPrompt = this.createEnhancedSystemPrompt(rawData.enhancedMetadata);
        }
        
        // Clean the data with optional enhanced metadata context
        const result = await adapter.clean(rawData.content, systemPrompt);
        
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
   * Create enhanced system prompt with metadata context for bias-aware extraction
   */
  private createEnhancedSystemPrompt(metadata: any): string {
    let contextParts: string[] = [];
    
    // Add language context
    if (metadata.language) {
      const lang = metadata.language;
      if (lang.primaryLanguage) {
        contextParts.push(`Primary language: ${lang.primaryLanguage} (confidence: ${Math.round(lang.confidence * 100)}%)`);
      }
      if (lang.detectedLanguages?.length > 1) {
        contextParts.push(`Multiple languages detected: ${lang.detectedLanguages.join(', ')}`);
      }
    }
    
    // Add location context
    if (metadata.location) {
      const loc = metadata.location;
      if (loc.consolidatedCountry) {
        contextParts.push(`Operating country: ${loc.consolidatedCountry}`);
      }
      if (loc.legalJurisdiction) {
        contextParts.push(`Legal jurisdiction: ${loc.legalJurisdiction}`);
      }
    }
    
    // Add currency context
    if (metadata.currency) {
      const curr = metadata.currency;
      if (curr.primaryCurrency) {
        contextParts.push(`Primary currency: ${curr.primaryCurrency}`);
      }
      if (curr.allCurrencies?.length > 1) {
        contextParts.push(`Multiple currencies: ${curr.allCurrencies.join(', ')}`);
      }
    }
    
    // Add content pattern context
    if (metadata.contentPatterns) {
      const patterns = metadata.contentPatterns;
      if (patterns.formalityLevel) {
        contextParts.push(`Content formality: ${patterns.formalityLevel}`);
      }
      if (patterns.privacyFocused) {
        contextParts.push(`Privacy-focused content detected (GDPR region likely)`);
      }
      if (patterns.industrySector) {
        contextParts.push(`Industry: ${patterns.industrySector}`);
      }
    }
    
    // Build enhanced prompt
    let prompt = `Extract legal entity information from the following content.

IMPORTANT CONTEXT FOR BIAS ADJUSTMENT:
${contextParts.join('\n')}

EXTRACTION GUIDELINES:
1. Be aware that entity disclosure varies by region:
   - Japanese/Asian sites may have less prominent legal entity display
   - EU sites may obscure ownership due to GDPR
   - US sites typically have clearer entity disclosure
   
2. Consider multi-language scenarios:
   - Entity names may appear in different languages
   - Look for transliterations and romanized versions
   
3. Currency/location mismatches may indicate:
   - International subsidiaries
   - Regional branches
   - Parent/subsidiary relationships

4. Adjust confidence based on regional norms:
   - High formality + low transparency = possible regulatory compliance (not hiding)
   - Multiple currencies = likely international operation

Extract the following information, adjusting for the regional and language context provided above:`;

    return prompt;
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
    // First check if this combination already exists
    const checkQuery = `
      SELECT id FROM cleaned_data 
      WHERE source_type = $1 AND source_id = $2 AND model_name = $3
    `;
    
    const existingResult = await executeBetaV2Query(checkQuery, [sourceType, sourceId, modelName]);
    
    if (existingResult.rows.length > 0) {
      console.log(`[CleaningService] Result already exists for ${sourceType}:${sourceId} with ${modelName}, updating...`);
      
      // Update existing record
      const updateQuery = `
        UPDATE cleaned_data 
        SET cleaned_data = $1, processing_time_ms = $2, token_count = $3,
            cost_estimate = $4, confidence_score = $5, created_at = NOW()
        WHERE source_type = $6 AND source_id = $7 AND model_name = $8
        RETURNING id
      `;
      
      const updateValues = [
        result.extractedData,
        result.metadata.processingTimeMs,
        result.metadata.tokenCount,
        result.metadata.costEstimate,
        result.metadata.confidenceScore,
        sourceType,
        sourceId,
        modelName
      ];
      
      const dbResult = await executeBetaV2Query(updateQuery, updateValues);
      return { id: dbResult.rows[0].id };
    } else {
      // Insert new record
      const insertQuery = `
        INSERT INTO cleaned_data (
          source_type, source_id, model_name, model_provider,
          cleaned_data, processing_time_ms, token_count,
          cost_estimate, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const insertValues = [
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

      const dbResult = await executeBetaV2Query(insertQuery, insertValues);
      return { id: dbResult.rows[0].id };
    }
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
    
    return result.rows.map((row: any) => ({
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
    return result.rows.map((row: any) => row.model_name);
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