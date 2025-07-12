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

    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`[Beta] [Playwright] Processing domain: ${domain}`);
      
      page = await this.browser!.newPage();
      
      // Configure page
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewportSize({ width: 1920, height: 1080 });
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

      // Extract data using the same logic as PuppeteerExtractor
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
          
          // Try navigation/header logo analysis
          const nav = document.querySelector('nav, header');
          if (nav) {
            const logo = nav.querySelector('img[alt*="logo" i], .logo, [class*="brand"]');
            if (logo && logo.tagName === 'IMG') {
              const altText = logo.getAttribute('alt');
              if (altText && altText.trim() && !altText.toLowerCase().includes('logo')) {
                return {
                  name: altText.trim(),
                  method: 'logo_alt_text',
                  confidence: 70
                };
              }
            }
          }
          
          // Try h1 analysis
          const h1 = document.querySelector('h1');
          if (h1 && h1.textContent) {
            const h1Text = h1.textContent.trim();
            if (h1Text.length > 2 && h1Text.length < 50 && !h1Text.match(/welcome|home|hello/i)) {
              return {
                name: h1Text,
                method: 'h1_text',
                confidence: 65
              };
            }
          }
          
          // Try page title analysis
          const title = document.title;
          if (title) {
            // Remove common suffixes and extract company name
            const cleanTitle = title.replace(/\s*[-|–]\s*(Home|Welcome|Official Site).*$/i, '').trim();
            const titleMatch = cleanTitle.match(/^([^-|–]+)/);
            if (titleMatch && titleMatch[1].trim().length > 2) {
              return {
                name: titleMatch[1].trim(),
                method: 'page_title',
                confidence: 60
              };
            }
          }
          
          return null;
        };

        // Detect website type
        const detectWebsiteType = () => {
          // E-commerce detection
          if (document.querySelector('[data-testid*="cart"], .cart, #cart, .shopping')) {
            return 'ecommerce';
          }
          
          // SaaS detection
          if (document.querySelector('.pricing, [href*="pricing"], .plans, .subscription')) {
            return 'saas';
          }
          
          // Corporate detection
          if (document.querySelector('.about, [href*="about"], .company, .corporate')) {
            return 'corporate';
          }
          
          return 'general';
        };

        const companyResult = extractCompanyName();
        const websiteType = detectWebsiteType();
        
        return {
          title: document.title,
          companyName: companyResult?.name || null,
          extractionMethod: companyResult?.method || null,
          confidence: companyResult?.confidence || 0,
          websiteType: websiteType,
          htmlSize: document.documentElement.outerHTML.length
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