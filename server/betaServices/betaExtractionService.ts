import axios from 'axios';
import * as cheerio from 'cheerio';
import { runPerplexityExtraction } from './standalonePerplexity';
import { runAxiosCheerioExtraction } from './standaloneAxiosCheerio';
import { runPuppeteerExtraction } from './standalonePuppeteer';

interface BetaExtractionResult {
  domain: string;
  method: string;
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
  extractionMethod: string | null;
  technicalDetails: string | null;
}

export class BetaExtractionService {
  private axiosConfig = {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  async testDomain(domain: string, method: string): Promise<BetaExtractionResult> {
    const startTime = Date.now();

    try {
      switch (method.toLowerCase()) {
        case 'axios_cheerio':
          return await this.testWithAxiosCheerio(domain);
        case 'puppeteer':
          return await this.testWithPuppeteer(domain);
        default:
          throw new Error(`Unknown extraction method: ${method}`);
      }
    } catch (error) {
      return {
        domain,
        method,
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: null
      };
    }
  }

  async testWithAxiosCheerio(domain: string): Promise<BetaExtractionResult> {
    const startTime = Date.now();

    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const response = await axios.get(url, this.axiosConfig);
      const $ = cheerio.load(response.data);

      // Extract company name using various selectors
      let companyName: string | null = null;
      let extractionMethod: string | null = null;

      // Try meta tags first
      const metaTags = [
        'meta[property="og:site_name"]',
        'meta[name="application-name"]',
        'meta[name="author"]',
        'meta[property="og:title"]'
      ];

      for (const selector of metaTags) {
        const content = $(selector).attr('content');
        if (content && content.trim()) {
          companyName = content.trim();
          extractionMethod = `meta_tag_${selector}`;
          break;
        }
      }

      // Try title tag if no meta tags found
      if (!companyName) {
        const title = $('title').text().trim();
        if (title) {
          companyName = title.split('|')[0].split('-')[0].trim();
          extractionMethod = 'title_tag';
        }
      }

      // Try common header selectors
      if (!companyName) {
        const headerSelectors = ['h1', '.logo', '#logo', '.brand', '.company-name'];
        for (const selector of headerSelectors) {
          const text = $(selector).first().text().trim();
          if (text && text.length > 2 && text.length < 100) {
            companyName = text;
            extractionMethod = `header_${selector}`;
            break;
          }
        }
      }

      const confidence = companyName ? (extractionMethod?.includes('meta') ? 85 : 70) : 0;

      return {
        domain,
        method: 'axios_cheerio',
        companyName,
        confidence,
        processingTime: Date.now() - startTime,
        success: !!companyName,
        error: null,
        extractionMethod,
        technicalDetails: `HTTP ${response.status}, Content-Length: ${response.data.length}`
      };

    } catch (error) {
      return {
        domain,
        method: 'axios_cheerio',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: null
      };
    }
  }

  async testWithPuppeteer(domain: string): Promise<BetaExtractionResult> {
    console.log(`[Beta] [Beta] Testing ${domain} with puppeteer...`);

    try {
      // Use the standalone Puppeteer function
      const result = await runPuppeteerExtraction(domain);

      return {
        domain,
        method: 'puppeteer',
        companyName: result.companyName,
        confidence: result.companyConfidence,
        processingTime: result.processingTimeMs,
        success: result.success,
        error: result.error,
        extractionMethod: result.companyExtractionMethod,
        technicalDetails: null
      };
    } catch (error: any) {
      console.error(`[Beta] Puppeteer extraction failed for ${domain}:`, error);
      return {
        domain,
        method: 'puppeteer',
        companyName: null,
        confidence: 0,
        processingTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: null
      };
    }
  }
}