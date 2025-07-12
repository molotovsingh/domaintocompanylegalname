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
    const processingLogs: string[] = [];
    const networkRequests: any[] = [];

    try {
      if (!this.browser) {
        await this.initialize();
      }

      console.log(`[Beta] [Playwright] Processing domain: ${domain}`);
      processingLogs.push(`Started processing domain: ${domain}`);
      
      // Create browser context with user agent and viewport
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });
      
      page = await context.newPage();
      await page.setDefaultTimeout(15000);

      // Track network requests
      page.on('request', request => {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          timestamp: Date.now()
        });
      });

      page.on('response', response => {
        const reqIndex = networkRequests.findIndex(req => req.url === response.url());
        if (reqIndex !== -1) {
          networkRequests[reqIndex].status = response.status();
          networkRequests[reqIndex].responseTime = Date.now() - networkRequests[reqIndex].timestamp;
        }
      });

      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      console.log(`[Beta] [Playwright] Navigating to: ${url}`);
      processingLogs.push(`Navigating to: ${url}`);
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      const httpStatus = response?.status() || 0;
      processingLogs.push(`HTTP Status: ${httpStatus}`);
      
      if (httpStatus >= 400) {
        throw new Error(`HTTP ${httpStatus} - Failed to load page`);
      }

      // Wait for content to stabilize
      await page.waitForTimeout(1000);
      processingLogs.push('Content stabilized');

      // Take screenshots for visual data
      processingLogs.push('Capturing screenshots');
      const screenshotFullPage = await page.screenshot({ 
        fullPage: true,
        type: 'png'
      });
      
      const screenshotAboveFold = await page.screenshot({ 
        fullPage: false,
        type: 'png'
      });

      // Extract comprehensive data including all attempts
      const extractedData = await page.evaluate(() => {
        const extractionAttempts = [];
        let companyName = null;
        let method = null;
        let confidence = 0;
        
        // Collect all meta tags
        const metaTags: Record<string, string> = {};
        document.querySelectorAll('meta').forEach(meta => {
          const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
          const content = meta.getAttribute('content') || '';
          if (name && content) {
            metaTags[name] = content;
          }
        });

        // Collect all structured data
        const structuredData: any[] = [];
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent || '');
            structuredData.push(data);
            
            // Try structured data extraction (95% confidence)
            if (!companyName && data.name && (data['@type'] === 'Organization' || data['@type'] === 'Corporation' || data['@type'] === 'Company')) {
              companyName = data.name;
              method = 'structured_data';
              confidence = 95;
              extractionAttempts.push({
                method: 'structured_data',
                result: data.name,
                confidence: 95,
                rawContent: JSON.stringify(data),
                selectorUsed: 'script[type="application/ld+json"]'
              });
            }
          } catch (e) {
            extractionAttempts.push({
              method: 'structured_data',
              result: null,
              confidence: 0,
              error: 'Invalid JSON-LD',
              rawContent: script.textContent || ''
            });
          }
        });
        
        // Try meta property extraction (85% confidence)
        const ogSiteName = document.querySelector('meta[property="og:site_name"]');
        const appName = document.querySelector('meta[name="application-name"]');
        const metaContent = ogSiteName?.getAttribute('content') || appName?.getAttribute('content');
        
        if (metaContent && metaContent.trim()) {
          extractionAttempts.push({
            method: 'meta_property',
            result: metaContent.trim(),
            confidence: 85,
            selectorUsed: ogSiteName ? 'meta[property="og:site_name"]' : 'meta[name="application-name"]',
            rawContent: metaContent
          });
          
          if (!companyName) {
            companyName = metaContent.trim();
            method = 'meta_property';
            confidence = 85;
          }
        }
        
        // Try footer copyright (75% confidence)
        const footer = document.querySelector('footer');
        if (footer) {
          const footerText = footer.textContent || '';
          const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.,|]+?)(?:\.|,|All|$)/i);
          
          extractionAttempts.push({
            method: 'footer_copyright',
            result: copyrightMatch ? copyrightMatch[1].trim() : null,
            confidence: copyrightMatch ? 75 : 0,
            selectorUsed: 'footer',
            rawContent: footerText.substring(0, 500) // First 500 chars of footer
          });
          
          if (!companyName && copyrightMatch && copyrightMatch[1].trim()) {
            companyName = copyrightMatch[1].trim();
            method = 'footer_copyright';
            confidence = 75;
          }
        }
        
        // Try logo alt text (70% confidence)
        const nav = document.querySelector('nav, header');
        if (nav) {
          const logo = nav.querySelector('img[alt*="logo" i], .logo img, [class*="brand"] img');
          if (logo && logo.tagName === 'IMG') {
            const altText = logo.getAttribute('alt');
            
            extractionAttempts.push({
              method: 'logo_alt_text',
              result: altText && !altText.toLowerCase().includes('logo') ? altText.trim() : null,
              confidence: altText && !altText.toLowerCase().includes('logo') ? 70 : 0,
              selectorUsed: 'nav/header img',
              rawContent: altText || ''
            });
            
            if (!companyName && altText && altText.trim() && !altText.toLowerCase().includes('logo')) {
              companyName = altText.trim();
              method = 'logo_alt_text';
              confidence = 70;
            }
          }
        }
        
        // Try h1 analysis (65% confidence)
        const h1 = document.querySelector('h1');
        if (h1 && h1.textContent) {
          const h1Text = h1.textContent.trim();
          
          extractionAttempts.push({
            method: 'h1_text',
            result: h1Text.length > 2 && h1Text.length < 50 && !h1Text.match(/welcome|home|hello/i) ? h1Text : null,
            confidence: h1Text.length > 2 && h1Text.length < 50 && !h1Text.match(/welcome|home|hello/i) ? 65 : 0,
            selectorUsed: 'h1',
            rawContent: h1Text
          });
          
          if (!companyName && h1Text.length > 2 && h1Text.length < 50 && !h1Text.match(/welcome|home|hello/i)) {
            companyName = h1Text;
            method = 'h1_text';
            confidence = 65;
          }
        }
        
        // Try page title (60% confidence)
        const title = document.title;
        if (title) {
          const cleanTitle = title.split(/[-|–]/)[0].trim();
          
          extractionAttempts.push({
            method: 'page_title',
            result: cleanTitle.length > 2 ? cleanTitle : null,
            confidence: cleanTitle.length > 2 ? 60 : 0,
            selectorUsed: 'title',
            rawContent: title
          });
          
          if (!companyName && cleanTitle && cleanTitle.length > 2) {
            companyName = cleanTitle;
            method = 'page_title';
            confidence = 60;
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
        
        // Get DOM metrics
        const domMetrics = {
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          documentHeight: document.documentElement.scrollHeight,
          documentWidth: document.documentElement.scrollWidth
        };
        
        // Get full HTML
        const fullHtml = document.documentElement.outerHTML;
        
        return {
          title: document.title || '',
          companyName: companyName,
          extractionMethod: method,
          confidence: confidence,
          websiteType: websiteType,
          htmlSize: fullHtml.length,
          extractionAttempts,
          metaTags,
          structuredData,
          domMetrics,
          fullHtml: fullHtml.substring(0, 50000) // First 50k chars to avoid huge payloads
        };
      });

      const processingTime = Date.now() - startTime;
      processingLogs.push(`Extraction complete in ${processingTime}ms`);
      
      console.log(`[Beta] [Playwright] Extraction complete for ${domain}:`, {
        companyName: extractedData.companyName,
        confidence: extractedData.confidence,
        method: extractedData.extractionMethod,
        processingTime: `${processingTime}ms`,
        attemptsCount: extractedData.extractionAttempts.length
      });

      // Prepare comprehensive raw data
      const rawExtractionData = {
        // Text Data
        fullHtml: extractedData.fullHtml,
        extractionAttempts: extractedData.extractionAttempts,
        structuredData: extractedData.structuredData,
        metaTags: extractedData.metaTags,
        networkRequests: networkRequests.filter(req => req.status), // Only completed requests
        
        // Visual Data
        screenshots: {
          fullPage: screenshotFullPage.toString('base64'),
          aboveFold: screenshotAboveFold.toString('base64')
        },
        domMetrics: extractedData.domMetrics,
        
        // Processing Context
        processingLogs,
        performanceMetrics: {
          totalTime: processingTime,
          navigationTime: networkRequests.find(req => req.url === url)?.responseTime || 0,
          extractionTime: processingTime - (networkRequests.find(req => req.url === url)?.responseTime || 0)
        },
        websiteType: extractedData.websiteType
      };

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
        websiteType: extractedData.websiteType,
        rawExtractionData // Include comprehensive raw data
      };

    } catch (error: any) {
      console.error(`[Beta] [Playwright] Error processing ${domain}:`, error.message);
      processingLogs.push(`Error: ${error.message}`);
      
      // Capture whatever raw data we have even on error
      const rawExtractionData = {
        // Text Data
        fullHtml: null,
        extractionAttempts: [],
        structuredData: [],
        metaTags: {},
        networkRequests: networkRequests.filter(req => req.status),
        
        // Visual Data  
        screenshots: {
          fullPage: null,
          aboveFold: null
        },
        domMetrics: null,
        
        // Processing Context
        processingLogs,
        performanceMetrics: {
          totalTime: Date.now() - startTime,
          navigationTime: 0,
          extractionTime: 0
        },
        websiteType: null,
        error: error.message,
        errorStack: error.stack
      };
      
      return {
        companyName: null,
        confidence: 0,
        extractionMethod: null,
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
        httpStatus: 0,
        renderRequired: true,
        rawHtmlSize: 0,
        rawExtractionData // Include raw data even on error
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