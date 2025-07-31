// Axios + Cheerio Dump Service for Beta V2

import axios from 'axios';
import * as cheerio from 'cheerio';
import { AxiosCheerioStorage } from './axiosCheerioStorage';
import type { 
  AxiosCheerioConfig, 
  AxiosCheerioData, 
  DumpStatus,
  MetaTag,
  ExtractionResult,
  PageMetadata,
  CompanyCandidate
} from './axiosCheerioTypes';

export class AxiosCheerioService {
  private storage: AxiosCheerioStorage;
  
  constructor() {
    this.storage = new AxiosCheerioStorage();
  }
  
  async startExtraction(domain: string, config?: AxiosCheerioConfig): Promise<number> {
    // Create database entry
    const dumpId = await this.storage.createDump(domain);
    
    // Start extraction in background
    this.performExtraction(dumpId, domain, config)
      .catch(error => {
        console.error('[Axios+Cheerio] Extraction error:', error);
        this.storage.updateDumpStatus(dumpId, 'failed', error.message);
      });
    
    return dumpId;
  }
  
  async getDumpStatus(dumpId: number): Promise<DumpStatus | null> {
    return this.storage.getDumpStatus(dumpId);
  }
  
  async getRecentDumps(limit?: number): Promise<DumpStatus[]> {
    return this.storage.getRecentDumps(limit);
  }
  
  async getDumpData(dumpId: number) {
    return this.storage.getDumpData(dumpId);
  }
  
  private async performExtraction(
    dumpId: number, 
    domain: string, 
    config?: AxiosCheerioConfig
  ): Promise<void> {
    const startTime = Date.now();
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const attemptedStrategies: string[] = [];
    const candidates: CompanyCandidate[] = [];
    
    try {
      console.log(`[Axios+Cheerio] Starting extraction for ${domain}`);
      
      // Update status to processing
      await this.storage.updateDumpStatus(dumpId, 'processing');
      
      // Configure axios
      const axiosConfig = {
        timeout: config?.timeout || 10000,
        headers: {
          'User-Agent': config?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: config?.maxRedirects || 3,
        validateStatus: (status: number) => status < 500
      };
      
      // Make request
      const requestStartTime = Date.now();
      const response = await axios.get(url, axiosConfig);
      const responseTimeMs = Date.now() - requestStartTime;
      
      // Load HTML with Cheerio
      const $ = cheerio.load(response.data);
      const htmlSizeBytes = Buffer.byteLength(response.data, 'utf8');
      
      // Extract meta tags
      const metaTags: MetaTag[] = [];
      $('meta').each((_, elem) => {
        const name = $(elem).attr('name');
        const property = $(elem).attr('property');
        const content = $(elem).attr('content');
        
        if (content) {
          metaTags.push({ name, property, content });
        }
      });
      
      // Extract company name using multiple strategies
      let companyName: string | null = null;
      let extractionMethod: string | null = null;
      let confidence = 0;
      
      // Strategy 1: Structured data (JSON-LD)
      attemptedStrategies.push('json-ld');
      $('script[type="application/ld+json"]').each((_, elem) => {
        if (companyName) return;
        
        try {
          const jsonData = JSON.parse($(elem).html() || '{}');
          if (jsonData['@type'] === 'Organization' && jsonData.name) {
            companyName = jsonData.name;
            extractionMethod = 'json-ld_organization';
            confidence = 95;
            candidates.push({ name: companyName, extractionMethod, confidence });
          }
        } catch (e) {
          // Invalid JSON, skip
        }
      });
      
      // Strategy 2: Meta tags
      if (!companyName) {
        attemptedStrategies.push('meta-tags');
        const metaSelectors = [
          { selector: 'meta[property="og:site_name"]', name: 'og:site_name', confidence: 90 },
          { selector: 'meta[name="application-name"]', name: 'application-name', confidence: 85 },
          { selector: 'meta[name="author"]', name: 'author', confidence: 80 },
          { selector: 'meta[property="og:title"]', name: 'og:title', confidence: 75 }
        ];
        
        for (const meta of metaSelectors) {
          const content = $(meta.selector).attr('content');
          if (content && content.trim()) {
            const candidate = content.trim();
            candidates.push({ 
              name: candidate, 
              extractionMethod: `meta_${meta.name}`, 
              confidence: meta.confidence 
            });
            
            if (!companyName) {
              companyName = candidate;
              extractionMethod = `meta_${meta.name}`;
              confidence = meta.confidence;
            }
          }
        }
      }
      
      // Strategy 3: Title tag
      if (!companyName) {
        attemptedStrategies.push('title-tag');
        const title = $('title').text().trim();
        if (title && title !== 'Example Domain') {
          // Extract first part before separator
          const titlePart = title.split(/[|\-–—]/)[0].trim();
          if (titlePart) {
            candidates.push({ 
              name: titlePart, 
              extractionMethod: 'title_tag', 
              confidence: 70 
            });
            
            companyName = titlePart;
            extractionMethod = 'title_tag';
            confidence = 70;
          }
        }
      }
      
      // Strategy 4: Header elements
      if (!companyName) {
        attemptedStrategies.push('header-elements');
        const headerSelectors = [
          { selector: 'h1', confidence: 65 },
          { selector: '.logo', confidence: 75 },
          { selector: '#logo', confidence: 75 },
          { selector: '.brand', confidence: 70 },
          { selector: '.company-name', confidence: 80 },
          { selector: '[itemProp="name"]', confidence: 85 }
        ];
        
        for (const header of headerSelectors) {
          const text = $(header.selector).first().text().trim();
          if (text && text.length > 2 && text.length < 100) {
            candidates.push({ 
              name: text, 
              extractionMethod: `header_${header.selector}`, 
              confidence: header.confidence 
            });
            
            if (!companyName) {
              companyName = text;
              extractionMethod = `header_${header.selector}`;
              confidence = header.confidence;
            }
          }
        }
      }
      
      // Strategy 5: Footer copyright
      if (!companyName) {
        attemptedStrategies.push('footer-copyright');
        const footerText = $('footer').text() || $('[id*="footer"]').text() || $('[class*="footer"]').text();
        const copyrightMatch = footerText.match(/©\s*(?:\d{4}\s*)?([^.\n]+)/);
        if (copyrightMatch && copyrightMatch[1]) {
          const candidate = copyrightMatch[1].trim();
          candidates.push({ 
            name: candidate, 
            extractionMethod: 'footer_copyright', 
            confidence: 60 
          });
          
          if (!companyName) {
            companyName = candidate;
            extractionMethod = 'footer_copyright';
            confidence = 60;
          }
        }
      }
      
      // Extract page metadata
      const pageMetadata: PageMetadata = {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content') || '',
        charset: $('meta[charset]').attr('charset') || 'utf-8',
        language: $('html').attr('lang') || 'en',
        viewport: $('meta[name="viewport"]').attr('content') || ''
      };
      
      // Prepare extraction results
      const extractionResults: ExtractionResult = {
        companyName,
        extractionMethod,
        confidence,
        alternativeCandidates: candidates.filter(c => c.name !== companyName),
        attemptedStrategies
      };
      
      // Prepare data object
      const data: AxiosCheerioData = {
        rawHtml: response.data,
        headers: response.headers as Record<string, string>,
        metaTags,
        extractionResults,
        pageMetadata,
        httpStatus: response.status,
        responseTimeMs,
        htmlSizeBytes
      };
      
      // Update database with results
      const processingTimeMs = Date.now() - startTime;
      await this.storage.updateDumpData(dumpId, data, processingTimeMs);
      
      console.log(`[Axios+Cheerio] Extraction completed for ${domain}: ${companyName || 'no company found'} (${processingTimeMs}ms)`);
      
    } catch (error: any) {
      const processingTimeMs = Date.now() - startTime;
      console.error(`[Axios+Cheerio] Error extracting ${domain}:`, error.message);
      
      // Create error data
      const errorData: AxiosCheerioData = {
        rawHtml: '',
        headers: {},
        metaTags: [],
        extractionResults: {
          companyName: null,
          extractionMethod: null,
          confidence: 0,
          alternativeCandidates: candidates,
          attemptedStrategies
        },
        pageMetadata: {
          title: '',
          description: '',
          charset: 'utf-8',
          language: 'en',
          viewport: ''
        },
        httpStatus: 0,
        responseTimeMs: 0,
        htmlSizeBytes: 0,
        error: error.message
      };
      
      await this.storage.updateDumpData(dumpId, errorData, processingTimeMs);
      await this.storage.updateDumpStatus(dumpId, 'failed', error.message);
    }
  }
  
  async initializeStorage(): Promise<void> {
    await this.storage.initializeTable();
  }
}