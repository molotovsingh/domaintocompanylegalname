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

  async testWithAxiosCheerio(domain: string): Promise<BetaExtractionResult> {
    const startTime = Date.now();
    
    try {
      const url = `https://${domain}`;
      const response = await axios.get(url, this.axiosConfig);
      const $ = cheerio.load(response.data);
      
      // Try different extraction methods
      let companyName = null;
      let extractionMethod = null;
      let confidence = 0;
      
      // Method 1: Meta property
      const metaName = $('meta[property="og:site_name"]').attr('content') ||
                      $('meta[name="application-name"]').attr('content');
      if (metaName) {
        companyName = metaName.trim();
        extractionMethod = 'meta_property';
        confidence = 75;
      }
      
      // Method 2: Title fallback
      if (!companyName) {
        const title = $('title').text();
        if (title) {
          companyName = title.split(/[-|]/)[0].trim();
          extractionMethod = 'title_tag';
          confidence = 55;
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        domain,
        method: 'axios_cheerio',
        companyName,
        confidence,
        processingTime,
        success: !!companyName,
        error: null,
        extractionMethod,
        technicalDetails: `Found via ${extractionMethod || 'none'}`
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
        technicalDetails: 'Failed to fetch or parse HTML'
      };
    }
  }

  async testWithPlaywright(domain: string): Promise<BetaExtractionResult> {
    const startTime = Date.now();
    let browser = null;
    
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      const page = await context.newPage();
      
      await page.goto(`https://${domain}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      // Extract using Playwright's evaluate
      const result = await page.evaluate(() => {
        // Try structured data first
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd.textContent || '');
            if (data.name || data.organization?.name) {
              return {
                name: data.name || data.organization.name,
                method: 'structured_data'
              };
            }
          } catch {}
        }
        
        // Try meta tags
        const metaName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                        document.querySelector('meta[name="application-name"]')?.getAttribute('content');
        if (metaName) {
          return { name: metaName, method: 'meta_property' };
        }
        
        // Fallback to title
        const title = document.title;
        if (title) {
          return { name: title.split(/[-|]/)[0].trim(), method: 'title_tag' };
        }
        
        return null;
      });
      
      await browser.close();
      const processingTime = Date.now() - startTime;
      
      if (result) {
        return {
          domain,
          method: 'playwright',
          companyName: result.name,
          confidence: result.method === 'structured_data' ? 90 : 70,
          processingTime,
          success: true,
          error: null,
          extractionMethod: result.method,
          technicalDetails: `JavaScript rendered extraction via ${result.method}`
        };
      }
      
      return {
        domain,
        method: 'playwright',
        companyName: null,
        confidence: 0,
        processingTime,
        success: false,
        error: 'No company name found',
        extractionMethod: null,
        technicalDetails: 'Page loaded but no extraction successful'
      };
    } catch (error) {
      if (browser) await browser.close();
      return {
        domain,
        method: 'playwright',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractionMethod: null,
        technicalDetails: 'Playwright execution failed'
      };
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