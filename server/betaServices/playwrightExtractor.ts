import { chromium, Browser, Page } from 'playwright';

export class PlaywrightExtractor {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('[Beta] [Playwright] Initializing browser...');
      
      this.browser = await chromium.launch({
        headless: true,
        executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log('[Beta] [Playwright] Browser initialized successfully');
    } catch (error) {
      console.error('[Beta] [Playwright] Failed to initialize browser:', error);
      throw error;
    }
  }

  async extractFromDomain(domain: string): Promise<any> {
    const startTime = Date.now();
    let page: Page | null = null;
    let context: any = null;

    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`[Beta] [Playwright] Processing domain: ${domain}`);
      
      // Create browser context with user agent and viewport
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });
      
      page = await context.newPage();
      await page.setDefaultTimeout(15000);

      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      console.log(`[Beta] [Playwright] Navigating to: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      const httpStatus = response?.status() || 0;
      
      if (httpStatus >= 400) {
        throw new Error(`HTTP ${httpStatus} - Failed to load page`);
      }

      // Wait for content to stabilize
      await page.waitForTimeout(1000);

      // Simple test to isolate the issue
      const extractedData = await page.evaluate(() => {
        // Return a minimal object to test if Playwright is working
        return {
          title: document.title || 'No title',
          companyName: 'Test Company',
          extractionMethod: 'test',
          confidence: 100,
          websiteType: 'test',
          htmlSize: 1000
        };
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`[Beta] [Playwright] Extraction complete for ${domain}:`, {
        companyName: extractedData.companyName,
        confidence: extractedData.confidence,
        method: extractedData.extractionMethod,
        processingTime: `${processingTime}ms`
      });

      return {
        companyName: extractedData.companyName,
        confidence: extractedData.confidence || 0,
        extractionMethod: extractedData.extractionMethod,
        processingTimeMs: processingTime,
        success: !!extractedData.companyName,
        error: null,
        httpStatus,
        renderRequired: true,
        rawHtmlSize: extractedData.htmlSize,
        websiteType: extractedData.websiteType
      };

    } catch (error: any) {
      console.error(`[Beta] [Playwright] Error processing ${domain}:`, error.message);
      
      return {
        companyName: null,
        confidence: 0,
        extractionMethod: null,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
        httpStatus: 0,
        renderRequired: true,
        rawHtmlSize: 0
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('[Beta] [Playwright] Error closing page:', e);
        }
      }
      if (context) {
        try {
          await context.close();
        } catch (e) {
          console.error('[Beta] [Playwright] Error closing context:', e);
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Beta] [Playwright] Browser closed');
    }
  }
}