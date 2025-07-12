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

      // Extract data using enhanced methods
      const extractedData = await page.evaluate(() => {
        let companyName = null;
        let method = null;
        let confidence = 0;
        
        // Try structured data first (95% confidence)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data.name && (data['@type'] === 'Organization' || data['@type'] === 'Corporation' || data['@type'] === 'Company')) {
              companyName = data.name;
              method = 'structured_data';
              confidence = 95;
              break;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
        
        // Try meta property if no structured data (85% confidence)
        if (!companyName) {
          const ogSiteName = document.querySelector('meta[property="og:site_name"]');
          const appName = document.querySelector('meta[name="application-name"]');
          const metaContent = ogSiteName?.getAttribute('content') || appName?.getAttribute('content');
          
          if (metaContent && metaContent.trim()) {
            companyName = metaContent.trim();
            method = 'meta_property';
            confidence = 85;
          }
        }
        
        // Try footer copyright (75% confidence)
        if (!companyName) {
          const footer = document.querySelector('footer');
          if (footer) {
            const footerText = footer.textContent || '';
            const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.,|]+?)(?:\.|,|All|$)/i);
            if (copyrightMatch && copyrightMatch[1].trim()) {
              companyName = copyrightMatch[1].trim();
              method = 'footer_copyright';
              confidence = 75;
            }
          }
        }
        
        // Try logo alt text (70% confidence)
        if (!companyName) {
          const nav = document.querySelector('nav, header');
          if (nav) {
            const logo = nav.querySelector('img[alt*="logo" i], .logo img, [class*="brand"] img');
            if (logo && logo.tagName === 'IMG') {
              const altText = logo.getAttribute('alt');
              if (altText && altText.trim() && !altText.toLowerCase().includes('logo')) {
                companyName = altText.trim();
                method = 'logo_alt_text';
                confidence = 70;
              }
            }
          }
        }
        
        // Try h1 analysis (65% confidence)
        if (!companyName) {
          const h1 = document.querySelector('h1');
          if (h1 && h1.textContent) {
            const h1Text = h1.textContent.trim();
            if (h1Text.length > 2 && h1Text.length < 50 && !h1Text.match(/welcome|home|hello/i)) {
              companyName = h1Text;
              method = 'h1_text';
              confidence = 65;
            }
          }
        }
        
        // Try page title as fallback (60% confidence)
        if (!companyName) {
          const title = document.title;
          if (title) {
            // Extract first part before common separators
            const cleanTitle = title.split(/[-|–]/)[0].trim();
            if (cleanTitle && cleanTitle.length > 2) {
              companyName = cleanTitle;
              method = 'page_title';
              confidence = 60;
            }
          }
        }
        
        // Detect website type
        let websiteType = 'general';
        if (document.querySelector('.cart, #cart, .shopping-cart, [data-testid*="cart"]')) {
          websiteType = 'ecommerce';
        } else if (document.querySelector('.pricing, [href*="pricing"], .plans')) {
          websiteType = 'saas';
        } else if (document.querySelector('.about, [href*="about"], .company')) {
          websiteType = 'corporate';
        }
        
        return {
          title: document.title || '',
          companyName: companyName,
          extractionMethod: method,
          confidence: confidence,
          websiteType: websiteType,
          htmlSize: document.documentElement ? document.documentElement.outerHTML.length : 0
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