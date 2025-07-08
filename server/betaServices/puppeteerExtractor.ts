import puppeteer from 'puppeteer';

interface ExtractionStep {
  step: string;
  success: boolean;
  details: string;
  timestamp: number;
}

interface PuppeteerExtractionResult {
  processingTimeMs: number;
  success: boolean;
  error: string | null;
  companyName: string | null;
  companyConfidence: number;
  companyExtractionMethod: string | null;
  detectedCountry: string | null;
  countryConfidence: number;
  geoMarkers: string;
  termsUrl: string | null;
  privacyUrl: string | null;
  legalUrls: string;
  legalContentExtracted: boolean;
  aboutUrl: string | null;
  aboutContent: string | null;
  aboutExtractionSuccess: boolean;
  socialMediaLinks: string;
  socialMediaCount: number;
  contactEmails: string;
  contactPhones: string;
  contactAddresses: string;
  hasContactPage: boolean;
  rawHtmlSize: number;
  rawExtractionData: string | null;
  pageMetadata: string | null;
  httpStatus: number;
  renderRequired: boolean;
  javascriptErrors: string;
  extractionSteps: string;
}

export class PuppeteerExtractor {
  private browser: puppeteer.Browser | null = null;
  private steps: ExtractionStep[] = [];

  async initialize(): Promise<void> {
    try {
      console.log('[Beta] [Puppeteer] Starting browser initialization...');
      this.logStep('browser_init_start', true, 'Starting browser initialization');

      // Find Chrome/Chromium executable
      console.log('[Beta] [Puppeteer] Finding Chromium executable...');
      const executablePath = await this.findChromiumPath();
      console.log(`[Beta] [Puppeteer] Found executable: ${executablePath}`);
      this.logStep('executable_found', true, `Using executable: ${executablePath}`);

      // Test if executable exists and is accessible
      const fs = require('fs');
      try {
        const stats = fs.statSync(executablePath);
        console.log(`[Beta] [Puppeteer] Executable stats: size=${stats.size}, mode=${stats.mode.toString(8)}`);
        this.logStep('executable_validation', true, `Executable validated: ${stats.size} bytes`);
      } catch (fsError: any) {
        console.error(`[Beta] [Puppeteer] Executable validation failed:`, fsError);
        this.logStep('executable_validation', false, `File access error: ${fsError.message}`);
        throw new Error(`Chromium executable not accessible: ${fsError.message}`);
      }

      console.log('[Beta] [Puppeteer] Launching browser with extensive args...');
      this.browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-default-browser-check',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--no-pings',
          '--mute-audio',
          '--disable-ipc-flooding-protection'
        ],
        timeout: 30000,
        dumpio: true
      });

      console.log('[Beta] [Puppeteer] Browser launched successfully!');
      this.logStep('browser_init_success', true, 'Browser launched successfully');

      // Test browser with simple page
      console.log('[Beta] [Puppeteer] Testing browser with simple page...');
      const testPage = await this.browser.newPage();
      await testPage.goto('data:text/html,<html><body>Test</body></html>', { timeout: 10000 });
      const testContent = await testPage.content();
      console.log(`[Beta] [Puppeteer] Test page content length: ${testContent.length}`);
      await testPage.close();

      console.log('[Beta] [Puppeteer] Browser initialization completed successfully!');
      this.logStep('browser_test_success', true, 'Browser test page successful');

    } catch (error: any) {
      console.error(`[Beta] [Puppeteer] Browser initialization failed:`, error);
      console.error(`[Beta] [Puppeteer] Error stack:`, error.stack);
      this.logStep('browser_init_error', false, `Browser initialization failed: ${error.message}`);
      throw new Error(`Failed to initialize Puppeteer: ${error.message}`);
    }
  }

  private async findChromiumPath(): Promise<string> {
    const { execSync } = require('child_process');
    const fs = require('fs');

    console.log('[Beta] [Puppeteer] Starting executable path search...');

    // Try to find Chromium in common locations
    const possiblePaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/nix/store/*/bin/chromium',
      '/nix/store/*/bin/chromium-browser'
    ];

    // Try `which` command first
    try {
      console.log('[Beta] [Puppeteer] Trying which command...');
      const whichResult = execSync('which chromium || which chromium-browser || which google-chrome || echo "NONE"', { encoding: 'utf8' }).trim();
      console.log(`[Beta] [Puppeteer] Which result: "${whichResult}"`);
      if (whichResult && whichResult !== 'NONE' && fs.existsSync(whichResult)) {
        console.log(`[Beta] [Puppeteer] Found via which: ${whichResult}`);
        return whichResult;
      }
    } catch (e: any) {
      console.log(`[Beta] [Puppeteer] Which command failed: ${e.message}`);
    }

    // Check Nix store specifically
    try {
      console.log('[Beta] [Puppeteer] Searching Nix store...');
      const nixResult = execSync('find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1 || echo "NONE"', { encoding: 'utf8' }).trim();
      console.log(`[Beta] [Puppeteer] Nix search result: "${nixResult}"`);
      if (nixResult && nixResult !== 'NONE' && fs.existsSync(nixResult)) {
        console.log(`[Beta] [Puppeteer] Found in Nix store: ${nixResult}`);
        return nixResult;
      }
    } catch (e: any) {
      console.log(`[Beta] [Puppeteer] Nix search failed: ${e.message}`);
    }

    // Check if any of the common paths exist
    console.log('[Beta] [Puppeteer] Checking common paths...');
    for (const path of possiblePaths) {
      try {
        console.log(`[Beta] [Puppeteer] Checking: ${path}`);
        if (fs.existsSync(path)) {
          console.log(`[Beta] [Puppeteer] Found: ${path}`);
          return path;
        }
      } catch (e: any) {
        console.log(`[Beta] [Puppeteer] Error checking ${path}: ${e.message}`);
      }
    }

    // Let Puppeteer find it
    try {
      console.log('[Beta] [Puppeteer] Trying Puppeteer default...');
      const defaultPath = puppeteer.executablePath();
      console.log(`[Beta] [Puppeteer] Puppeteer default: ${defaultPath}`);
      return defaultPath;
    } catch (e: any) {
      console.error(`[Beta] [Puppeteer] Puppeteer default failed: ${e.message}`);
      throw new Error(`No Chromium executable found. Searched paths: ${possiblePaths.join(', ')}. Error: ${e.message}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logStep('cleanup_success', true, 'Browser closed successfully');
      } catch (error: any) {
        this.logStep('cleanup_error', false, `Cleanup error: ${error.message}`);
      }
      this.browser = null;
    }
  }

  private logStep(step: string, success: boolean, details: string): void {
    this.steps.push({
      step,
      success,
      details,
      timestamp: Date.now()
    });
  }

  async extractFromDomain(domain: string): Promise<PuppeteerExtractionResult> {
    const startTime = Date.now();
    this.steps = [];

    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    let page: puppeteer.Page | null = null;

    try {
      this.logStep('page_create', true, 'Creating new page');
      page = await this.browser.newPage();

      // Set reasonable timeouts
      await page.setDefaultTimeout(15000);
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      this.logStep('page_config', true, 'Page configured');

      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      this.logStep('navigation_start', true, `Navigating to ${url}`);

      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      const httpStatus = response?.status() || 0;
      this.logStep('navigation_complete', httpStatus < 400, `Navigation completed with status ${httpStatus}`);

      if (httpStatus >= 400) {
        throw new Error(`HTTP ${httpStatus} - Failed to load page`);
      }

      // Wait a bit for content to stabilize
      await page.waitForTimeout(1000);

      // Extract basic information
      const extraction = await this.performBasicExtraction(page);

      const result: PuppeteerExtractionResult = {
        processingTimeMs: Date.now() - startTime,
        success: !!extraction.companyName,
        error: null,
        companyName: extraction.companyName,
        companyConfidence: extraction.confidence,
        companyExtractionMethod: extraction.method,
        detectedCountry: extraction.country,
        countryConfidence: extraction.countryConfidence,
        geoMarkers: JSON.stringify(extraction.geoMarkers),
        termsUrl: extraction.termsUrl,
        privacyUrl: extraction.privacyUrl,
        legalUrls: JSON.stringify(extraction.legalUrls),
        legalContentExtracted: extraction.legalUrls.length > 0,
        aboutUrl: extraction.aboutUrl,
        aboutContent: extraction.aboutContent,
        aboutExtractionSuccess: !!extraction.aboutContent,
        socialMediaLinks: JSON.stringify(extraction.socialLinks),
        socialMediaCount: Object.keys(extraction.socialLinks).length,
        contactEmails: JSON.stringify(extraction.emails),
        contactPhones: JSON.stringify(extraction.phones),
        contactAddresses: JSON.stringify(extraction.addresses),
        hasContactPage: extraction.hasContactPage,
        rawHtmlSize: extraction.htmlSize,
        rawExtractionData: JSON.stringify(extraction),
        pageMetadata: JSON.stringify(extraction.metadata),
        httpStatus,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps)
      };

      this.logStep('extraction_complete', true, `Successfully extracted data for ${domain}`);
      return result;

    } catch (error: any) {
      this.logStep('extraction_error', false, `Extraction failed: ${error.message}`);

      return {
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
        companyName: null,
        companyConfidence: 0,
        companyExtractionMethod: null,
        detectedCountry: null,
        countryConfidence: 0,
        geoMarkers: JSON.stringify({}),
        termsUrl: null,
        privacyUrl: null,
        legalUrls: JSON.stringify([]),
        legalContentExtracted: false,
        aboutUrl: null,
        aboutContent: null,
        aboutExtractionSuccess: false,
        socialMediaLinks: JSON.stringify({}),
        socialMediaCount: 0,
        contactEmails: JSON.stringify([]),
        contactPhones: JSON.stringify([]),
        contactAddresses: JSON.stringify([]),
        hasContactPage: false,
        rawHtmlSize: 0,
        rawExtractionData: JSON.stringify({ error: error.message }),
        pageMetadata: JSON.stringify({}),
        httpStatus: 0,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps)
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore page cleanup errors
        }
      }
    }
  }

  private async performBasicExtraction(page: puppeteer.Page) {
    try {
      const data = await page.evaluate(() => {
        // Company name extraction
        let companyName = null;
        let method = null;
        let confidence = 0;

        // Try meta tags
        const metaSelectors = [
          'meta[property="og:site_name"]',
          'meta[name="application-name"]',
          'meta[property="og:title"]'
        ];

        for (const selector of metaSelectors) {
          const meta = document.querySelector(selector);
          if (meta) {
            const content = meta.getAttribute('content');
            if (content && content.trim()) {
              companyName = content.trim();
              method = `meta_${selector.split('[')[1].split('=')[0]}`;
              confidence = 85;
              break;
            }
          }
        }

        // Try title if no meta found
        if (!companyName) {
          const title = document.title;
          if (title && title.trim()) {
            companyName = title.split(/[-|]/)[0].trim();
            method = 'title_tag';
            confidence = 60;
          }
        }

        // Try h1 if still no company found
        if (!companyName) {
          const h1 = document.querySelector('h1');
          if (h1 && h1.textContent) {
            const text = h1.textContent.trim();
            if (text.length > 2 && text.length < 100) {
              companyName = text;
              method = 'h1_tag';
              confidence = 50;
            }
          }
        }

        // Basic extraction of other data
        const links = Array.from(document.querySelectorAll('a'));
        const legalUrls = [];
        const socialLinks = {};

        for (const link of links.slice(0, 50)) { // Limit to first 50 links
          const href = link.href || '';
          const text = (link.textContent || '').toLowerCase();

          // Legal documents
          if (text.includes('privacy') || href.includes('privacy')) {
            legalUrls.push({ type: 'privacy', url: href });
          }
          if (text.includes('terms') || href.includes('terms')) {
            legalUrls.push({ type: 'terms', url: href });
          }

          // Social media
          if (href.includes('twitter.com') || href.includes('x.com')) {
            socialLinks['twitter'] = href;
          }
          if (href.includes('linkedin.com')) {
            socialLinks['linkedin'] = href;
          }
          if (href.includes('facebook.com')) {
            socialLinks['facebook'] = href;
          }
        }

        // Extract emails and phones from text
        const bodyText = document.body.textContent || '';
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;

        const emails = Array.from(new Set((bodyText.match(emailRegex) || [])
          .filter(email => !email.includes('example.com'))
          .slice(0, 3)));

        const phones = Array.from(new Set((bodyText.match(phoneRegex) || [])
          .filter(phone => phone.length >= 10 && phone.length <= 20)
          .slice(0, 3)));

        return {
          companyName,
          method,
          confidence,
          legalUrls: legalUrls.slice(0, 5),
          socialLinks,
          emails,
          phones,
          addresses: [], // Skip complex address extraction for now
          hasContactPage: links.some(l => (l.textContent || '').toLowerCase().includes('contact')),
          aboutUrl: links.find(l => (l.textContent || '').toLowerCase().includes('about'))?.href || null,
          htmlSize: document.documentElement.outerHTML.length,
          metadata: {
            title: document.title,
            lang: document.documentElement.lang,
            charset: document.characterSet
          },
          country: null,
          countryConfidence: 0,
          geoMarkers: {},
          aboutContent: null
        };
      });

      this.logStep('basic_extraction', true, `Extracted company: ${data.companyName || 'none'}`);
      return data;

    } catch (error: any) {
      this.logStep('basic_extraction_error', false, `Extraction error: ${error.message}`);
      return {
        companyName: null,
        method: null,
        confidence: 0,
        legalUrls: [],
        socialLinks: {},
        emails: [],
        phones: [],
        addresses: [],
        hasContactPage: false,
        aboutUrl: null,
        htmlSize: 0,
        metadata: {},
        country: null,
        countryConfidence: 0,
        geoMarkers: {},
        aboutContent: null
      };
    }
  }
}