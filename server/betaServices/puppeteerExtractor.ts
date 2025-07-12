import puppeteer, { Browser, Page } from 'puppeteer';

export class PuppeteerExtractor {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    try {
      console.log('[Beta] [Puppeteer] Initializing browser...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });
      
      console.log('[Beta] [Puppeteer] Browser initialized successfully');
    } catch (error) {
      console.error('[Beta] [Puppeteer] Failed to initialize browser:', error);
      throw error;
    }
  }

  async extractFromDomain(domain: string): Promise<any> {
    const startTime = Date.now();
    let page: Page | null = null;

    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`[Beta] [Puppeteer] Processing domain: ${domain}`);
      
      page = await this.browser!.newPage();
      
      // Configure page
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setDefaultTimeout(15000);

      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      console.log(`[Beta] [Puppeteer] Navigating to: ${url}`);
      
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

      // Extract data
      const extractedData = await page.evaluate(() => {
        const extractCompanyName = () => {
          // Try structured data first
          const jsonLd = document.querySelector('script[type="application/ld+json"]');
          if (jsonLd) {
            try {
              const data = JSON.parse(jsonLd.textContent || '');
              if (data.name || (data['@type'] === 'Organization' && data.name)) {
                return {
                  name: data.name,
                  method: 'structured_data',
                  confidence: 95
                };
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
          
          // Try meta tags
          const ogSiteName = document.querySelector('meta[property="og:site_name"]');
          const appName = document.querySelector('meta[name="application-name"]');
          const metaName = ogSiteName?.getAttribute('content') || appName?.getAttribute('content');
          if (metaName && metaName.trim()) {
            return { 
              name: metaName.trim(), 
              method: 'meta_property', 
              confidence: 85 
            };
          }
          
          // Try footer copyright
          const footer = document.querySelector('footer');
          if (footer) {
            const footerText = footer.textContent || '';
            const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.,|]+?)(?:\.|,|All|$)/i);
            if (copyrightMatch && copyrightMatch[1].trim()) {
              return { 
                name: copyrightMatch[1].trim(), 
                method: 'footer_copyright', 
                confidence: 75 
              };
            }
          }
          
          return null;
        };

        const companyResult = extractCompanyName();
        
        return {
          title: document.title,
          companyName: companyResult?.name || null,
          extractionMethod: companyResult?.method || null,
          confidence: companyResult?.confidence || 0,
          htmlSize: document.documentElement.outerHTML.length
        };
      });

      const processingTime = Date.now() - startTime;
      
      console.log(`[Beta] [Puppeteer] Extraction complete for ${domain}:`, {
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
        rawHtmlSize: extractedData.htmlSize
      };

    } catch (error: any) {
      console.error(`[Beta] [Puppeteer] Error processing ${domain}:`, error.message);
      
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
          console.error('[Beta] [Puppeteer] Error closing page:', e);
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[Beta] [Puppeteer] Browser closed');
    }
  }
}