import { llmCleaningService } from '../../services/llmCleaningService';
import { entityExtractionService } from '../../services/entityExtractionService';
import { GLEIFSearchService } from '../gleif-search/gleifSearchService';
import { GLEIFSearchStorage } from '../gleif-search/gleifSearchStorage';
import { processingStorage } from './processingStorage';
import { 
  ProcessingResult, 
  AvailableDump, 
  ProcessingStatus,
  StageResult 
} from './processingTypes';

export class ProcessingPipelineService {
  private gleifService: GLEIFSearchService;
  private gleifSearchStorage: GLEIFSearchStorage;

  constructor() {
    this.gleifService = new GLEIFSearchService();
    this.gleifSearchStorage = new GLEIFSearchStorage();
  }

  /**
   * Get all available dumps from different collection methods
   */
  async getAvailableDumps(): Promise<AvailableDump[]> {
    const dumps: AvailableDump[] = [];
    
    try {
      // Get Crawlee dumps
      const crawleeDumps = await processingStorage.getCrawleeDumps();
      dumps.push(...crawleeDumps.map((d: any) => ({
        id: d.id,
        domain: d.domain,
        sourceType: 'crawlee_dump' as const,
        createdAt: d.created_at,
        status: d.status,
        hasData: !!d.dump_data
      })));

      // Get Scrapy crawls
      const scrapyCrawls = await processingStorage.getScrapyCrawls();
      dumps.push(...scrapyCrawls.map((d: any) => ({
        id: d.id,
        domain: d.domain,
        sourceType: 'scrapy_crawl' as const,
        createdAt: d.created_at,
        status: d.status,
        hasData: !!d.raw_data
      })));

      // Get Playwright dumps
      const playwrightDumps = await processingStorage.getPlaywrightDumps();
      dumps.push(...playwrightDumps.map((d: any) => ({
        id: d.id,
        domain: d.domain,
        sourceType: 'playwright_dump' as const,
        createdAt: d.created_at,
        status: d.status,
        hasData: !!d.dump_data
      })));

      // Get Axios+Cheerio dumps
      const axiosDumps = await processingStorage.getAxiosCheerioDumps();
      dumps.push(...axiosDumps.map((d: any) => ({
        id: d.id,
        domain: d.domain,
        sourceType: 'axios_cheerio_dump' as const,
        createdAt: d.created_at,
        status: d.status,
        hasData: !!d.dump_data
      })));

      // Sort by date, newest first
      dumps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return dumps;
    } catch (error) {
      console.error('[ProcessingPipeline] Error getting available dumps:', error);
      return [];
    }
  }

  /**
   * Process a dump through all stages
   */
  async processDump(sourceType: string, sourceId: number): Promise<ProcessingResult> {
    const startTime = Date.now();
    let currentStatus: ProcessingStatus = 'stage1';
    
    try {
      // Get the raw data
      const rawData = await this.getRawData(sourceType, sourceId);
      if (!rawData) {
        throw new Error('Failed to retrieve raw data');
      }

      // Create processing record
      const processingId = await processingStorage.createProcessingResult({
        sourceType,
        sourceId,
        domain: rawData.domain,
        processingStatus: currentStatus
      });

      // Stage 1: HTML Stripping
      currentStatus = 'stage1';
      await processingStorage.updateProcessingStatus(processingId, currentStatus);
      const stage1Result = await this.runStage1(rawData);
      await processingStorage.updateStage1(processingId, stage1Result);

      // Stage 2: Data Extraction
      currentStatus = 'stage2';
      await processingStorage.updateProcessingStatus(processingId, currentStatus);
      const stage2Result = await this.runStage2(stage1Result.strippedText, rawData.domain);
      await processingStorage.updateStage2(processingId, stage2Result);

      // Stage 3: Entity Extraction
      currentStatus = 'stage3';
      await processingStorage.updateProcessingStatus(processingId, currentStatus);
      const stage3Result = await this.runStage3(
        stage1Result.strippedText, 
        rawData.domain, 
        stage2Result.extractedData
      );
      await processingStorage.updateStage3(processingId, stage3Result);

      // Stage 4: GLEIF Search (only if we have an entity name)
      if (stage3Result.entityName) {
        currentStatus = 'stage4';
        await processingStorage.updateProcessingStatus(processingId, currentStatus);
        const stage4Result = await this.runStage4(stage3Result.entityName, rawData.domain);
        await processingStorage.updateStage4(processingId, stage4Result);
      }

      // Mark as completed
      const totalTime = Date.now() - startTime;
      await processingStorage.completeProcessing(processingId, totalTime);

      // Return the complete result
      return await processingStorage.getProcessingResult(processingId);
    } catch (error) {
      console.error('[ProcessingPipeline] Processing error:', error);
      throw error;
    }
  }

  /**
   * Get raw data from different sources
   */
  private async getRawData(sourceType: string, sourceId: number): Promise<{ 
    domain: string; 
    html?: string; 
    text?: string;
    data?: any;
  } | null> {
    try {
      switch (sourceType) {
        case 'crawlee_dump':
          const crawlee = await processingStorage.getCrawleeDump(sourceId);
          if (crawlee?.dump_data?.pages?.[0]) {
            return {
              domain: crawlee.domain,
              html: crawlee.dump_data.pages[0].html,
              text: crawlee.dump_data.pages[0].text,
              data: crawlee.dump_data
            };
          }
          break;

        case 'scrapy_crawl':
          const scrapy = await processingStorage.getScrapyCrawl(sourceId);
          if (scrapy?.raw_data) {
            return {
              domain: scrapy.domain,
              html: scrapy.raw_data.html || scrapy.raw_data.content,
              text: scrapy.raw_data.text,
              data: scrapy.raw_data
            };
          }
          break;

        case 'playwright_dump':
          const playwright = await processingStorage.getPlaywrightDump(sourceId);
          if (playwright?.dump_data) {
            return {
              domain: playwright.domain,
              html: playwright.dump_data.html,
              text: playwright.dump_data.text,
              data: playwright.dump_data
            };
          }
          break;

        case 'axios_cheerio_dump':
          const axios = await processingStorage.getAxiosCheerioDump(sourceId);
          if (axios?.dump_data) {
            return {
              domain: axios.domain,
              html: axios.dump_data.html,
              text: axios.dump_data.text,
              data: axios.dump_data
            };
          }
          break;
      }
    } catch (error) {
      console.error(`[ProcessingPipeline] Error getting ${sourceType} data:`, error);
    }

    return null;
  }

  /**
   * Stage 1: HTML Stripping
   */
  private async runStage1(rawData: any): Promise<{
    strippedText: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    const html = rawData.html || rawData.data?.pages?.[0]?.html || '';
    const strippedText = this.stripHTML(html);
    
    return {
      strippedText,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Stage 2: Data Extraction using existing cleaning service
   */
  private async runStage2(strippedText: string, domain: string): Promise<{
    extractedData: any;
    modelUsed: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      const cleanedData = await llmCleaningService.cleanDump({
        rawDump: strippedText,
        domain: domain
      });

      return {
        extractedData: cleanedData,
        modelUsed: 'meta-llama/llama-3.1-8b-instruct:free',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('[ProcessingPipeline] Stage 2 error:', error);
      return {
        extractedData: null,
        modelUsed: 'none',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Stage 3: Entity Name Extraction
   */
  private async runStage3(
    strippedText: string, 
    domain: string, 
    existingData: any
  ): Promise<{
    entityName: string | null;
    confidence: number;
    modelUsed: string;
    processingTime: number;
    reasoning: string;
    alternativeNames: string[];
  }> {
    const startTime = Date.now();
    
    try {
      const result = await entityExtractionService.extractLegalEntity({
        rawText: strippedText,
        domain,
        existingData
      });

      if (result) {
        return {
          entityName: result.entityName,
          confidence: result.confidence,
          modelUsed: 'mistralai/mistral-nemo',
          processingTime: Date.now() - startTime,
          reasoning: result.reasoning,
          alternativeNames: result.alternativeNames || []
        };
      }
    } catch (error) {
      console.error('[ProcessingPipeline] Stage 3 error:', error);
    }

    return {
      entityName: null,
      confidence: 0,
      modelUsed: 'none',
      processingTime: Date.now() - startTime,
      reasoning: 'Failed to extract entity name',
      alternativeNames: []
    };
  }

  /**
   * Stage 4: GLEIF Search
   */
  private async runStage4(entityName: string, domain: string): Promise<{
    gleifSearchId: number;
    primaryLei: string | null;
    primaryLegalName: string | null;
    confidenceScore: number;
    totalCandidates: number;
  }> {
    try {
      // Create GLEIF search request
      const searchId = await this.gleifSearchStorage.createSearchRequest({
        suspectedName: entityName,
        domain,
        searchMethod: 'pipeline'
      });

      // Perform GLEIF search
      const searchResult = await this.gleifService.searchGLEIF(entityName, domain);
      
      // Store candidates
      await this.gleifSearchStorage.storeCandidates(searchId, searchResult.entities);
      
      // Update search status
      await this.gleifSearchStorage.updateSearchRequest(searchId, 'completed');

      // Get the top candidate
      const topCandidate = searchResult.entities.length > 0 ? searchResult.entities[0] : null;

      return {
        gleifSearchId: searchId,
        primaryLei: topCandidate?.leiCode || null,
        primaryLegalName: topCandidate?.legalName || null,
        confidenceScore: topCandidate?.weightedTotalScore || 0,
        totalCandidates: searchResult.entities.length
      };
    } catch (error) {
      console.error('[ProcessingPipeline] Stage 4 error:', error);
      return {
        gleifSearchId: 0,
        primaryLei: null,
        primaryLegalName: null,
        confidenceScore: 0,
        totalCandidates: 0
      };
    }
  }

  /**
   * Simple HTML stripping (reused from cleaning service)
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000); // Limit to ~50k chars
  }
}

// Export singleton instance
export const processingPipelineService = new ProcessingPipelineService();