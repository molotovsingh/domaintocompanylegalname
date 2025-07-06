
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

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
        case 'playwright':
          return await this.testWithPlaywright(domain);
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

  async testWithPlaywright(domain: string): Promise<BetaExtractionResult> {
    const startTime = Date.now();
    let browser;
    
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
      
      // Extract company name using various methods
      let companyName: string | null = null;
      let extractionMethod: string | null = null;
      
      // Try meta tags
      const metaSelectors = [
        'meta[property="og:site_name"]',
        'meta[name="application-name"]',
        'meta[property="og:title"]'
      ];
      
      for (const selector of metaSelectors) {
        const content = await page.getAttribute(selector, 'content');
        if (content && content.trim()) {
          companyName = content.trim();
          extractionMethod = `playwright_meta_${selector}`;
          break;
        }
      }
      
      // Try title if no meta found
      if (!companyName) {
        const title = await page.title();
        if (title) {
          companyName = title.split('|')[0].split('-')[0].trim();
          extractionMethod = 'playwright_title';
        }
      }
      
      // Try visible text elements
      if (!companyName) {
        const headerSelectors = ['h1', '.logo', '#logo', '.brand', '.company-name'];
        for (const selector of headerSelectors) {
          try {
            const text = await page.textContent(selector);
            if (text && text.trim().length > 2 && text.trim().length < 100) {
              companyName = text.trim();
              extractionMethod = `playwright_element_${selector}`;
              break;
            }
          } catch {
            // Continue to next selector
          }
        }
      }
      
      const confidence = companyName ? (extractionMethod?.includes('meta') ? 90 : 75) : 0;
      
      return {
        domain,
        method: 'playwright',
        companyName,
        confidence,
        processingTime: Date.now() - startTime,
        success: !!companyName,
        error: null,
        extractionMethod,
        technicalDetails: 'Playwright with Chromium browser'
      };
      
    } catch (error) {
      return {
        domain,
        method: 'playwright',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: null
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // Note: We'll simulate puppeteer since it's similar to playwright
  // In a real implementation, you'd import puppeteer and implement similarly
  async testWithPuppeteer(domain: string): Promise<BetaExtractionResult> {
    // For now, return a message that puppeteer isn't implemented
    return {
      domain,
      method: 'puppeteer',
      companyName: null,
      confidence: 0,
      processingTime: 0,
      success: false,
      error: 'Puppeteer not implemented in beta - use playwright instead',
      extractionMethod: null,
      technicalDetails: 'Puppeteer would work similarly to Playwright'
    };
  }
}
