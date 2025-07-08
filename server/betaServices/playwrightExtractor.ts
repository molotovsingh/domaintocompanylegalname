
import { chromium, Browser, Page } from 'playwright';

interface PlaywrightResult {
  processingTimeMs: number;
  success: boolean;
  error: string | null;
  companyName: string | null;
  companyConfidence: number;
  companyExtractionMethod: string | null;
  legalEntityType: string | null;
  detectedCountry: string | null;
  countryConfidence: number;
  httpStatus: number;
  extractionSteps: string;
  sources: string[];
  technicalDetails: string | null;
}

interface ExtractionStep {
  step: string;
  success: boolean;
  details: string;
  timestamp: number;
}

export class PlaywrightExtractor {
  private browser: Browser | null = null;
  private steps: ExtractionStep[] = [];
  private readonly PAGE_TIMEOUT = 12000;
  private readonly NAVIGATION_TIMEOUT = 15000;

  async initialize() {
    try {
      // Try to find Chrome executable in Replit environment
      const fs = await import('fs');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      let executablePath: string | undefined;
      
      // First, try to find chromium in nix store dynamically
      try {
        console.log('🎭 Searching for Chromium in nix store...');
        const { stdout } = await execAsync('find /nix/store -name "chromium" -type f -executable 2>/dev/null | head -1');
        if (stdout.trim()) {
          executablePath = stdout.trim();
          console.log(`🎭 Found Chromium in nix store: ${executablePath}`);
        }
      } catch (error) {
        console.log('🎭 Nix store search failed, trying fallback paths...');
      }
      
      // Fallback to known paths if nix search failed
      if (!executablePath) {
        const possibleChromePaths = [
          process.env.CHROME_EXECUTABLE_PATH,
          "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium"
        ].filter(Boolean);

        for (const chromePath of possibleChromePaths) {
          try {
            if (fs.existsSync(chromePath!)) {
              executablePath = chromePath!;
              console.log(`🎭 Found Chrome at fallback path: ${executablePath}`);
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--memory-pressure-off',
          '--max_old_space_size=2048',
          '--single-process',
          '--no-zygote',
          '--no-first-run',
          '--mute-audio',
          '--hide-scrollbars',
          '--disable-software-rasterizer',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only'
        ]
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
        console.log(`🎭 Using Chrome executable: ${executablePath}`);
      } else {
        console.log(`⚠️ No Chrome executable found, using Playwright default`);
      }

      // Try to launch browser with error handling
      try {
        this.browser = await chromium.launch(launchOptions);
        console.log("✅ Playwright browser initialized successfully");
      } catch (launchError) {
        console.error("❌ First launch attempt failed:", launchError.message);
        
        // Try fallback without executable path
        console.log("🔄 Trying fallback launch without executable path...");
        delete launchOptions.executablePath;
        this.browser = await chromium.launch(launchOptions);
        console.log("✅ Playwright browser initialized with fallback method");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Playwright browser:", error);
      throw new Error(`Playwright browser initialization failed: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log("✅ Playwright browser closed successfully");
      } catch (error) {
        console.error("⚠️ Error closing Playwright browser:", error);
      }
      this.browser = null;
    }
  }

  private logStep(step: string, success: boolean, details: string) {
    this.steps.push({
      step,
      success,
      details,
      timestamp: Date.now(),
    });
    console.log(`🎭 ${success ? "✅" : "❌"} ${step}: ${details}`);
  }

  async extractFromDomain(domain: string): Promise<PlaywrightResult> {
    const startTime = Date.now();
    this.steps = [];

    // Ensure browser is initialized
    if (!this.browser) {
      try {
        await this.initialize();
      } catch (initError) {
        this.logStep(
          "browser_init_error",
          false,
          `Browser initialization failed: ${initError.message}`,
        );
        return {
          processingTimeMs: Date.now() - startTime,
          success: false,
          error: `Browser initialization failed: ${initError.message}`,
          companyName: null,
          companyConfidence: 0,
          companyExtractionMethod: null,
          legalEntityType: null,
          detectedCountry: null,
          countryConfidence: 0,
          httpStatus: 0,
          extractionSteps: JSON.stringify(this.steps),
          sources: [],
          technicalDetails: `Playwright initialization failed: ${initError.message}`
        };
      }
    }

    let page: Page | null = null;

    try {
      // Create new page with optimized settings
      page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
      });

      // Set timeouts
      page.setDefaultTimeout(this.PAGE_TIMEOUT);
      page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      const httpStatus = response?.status() || 0;
      this.logStep('navigation', true, `Loaded ${url} with status ${httpStatus}`);

      // Wait for dynamic content
      await page.waitForTimeout(2000);

      // Extract company name using multiple strategies
      const companyResult = await this.extractCompanyName(page, domain);
      this.logStep(
        'company_extraction',
        !!companyResult.name,
        `Found: ${companyResult.name || 'none'} via ${companyResult.method}`
      );

      // Basic country detection from domain TLD
      const countryResult = this.detectCountryFromTLD(domain);

      return {
        processingTimeMs: Date.now() - startTime,
        success: !!companyResult.name,
        error: null,
        companyName: companyResult.name,
        companyConfidence: companyResult.confidence,
        companyExtractionMethod: companyResult.method,
        legalEntityType: companyResult.legalEntityType,
        detectedCountry: countryResult.country,
        countryConfidence: countryResult.confidence,
        httpStatus,
        extractionSteps: JSON.stringify(this.steps),
        sources: companyResult.sources,
        technicalDetails: `Playwright extraction completed in ${Date.now() - startTime}ms`
      };

    } catch (error: any) {
      this.logStep('playwright_error', false, `Extraction failed: ${error.message}`);
      
      return {
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
        companyName: null,
        companyConfidence: 0,
        companyExtractionMethod: null,
        legalEntityType: null,
        detectedCountry: null,
        countryConfidence: 0,
        httpStatus: 0,
        extractionSteps: JSON.stringify(this.steps),
        sources: [],
        technicalDetails: `Playwright extraction failed: ${error.message}`
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  private async extractCompanyName(page: Page, domain: string) {
    let sources: string[] = [];

    try {
      // Strategy 1: JSON-LD Structured Data (highest priority)
      const structuredData = await page.evaluate(() => {
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data.name) return { name: data.name, type: data['@type'] };
            if (data.organization?.name) return { name: data.organization.name, type: 'Organization' };
            if (data.legalName) return { name: data.legalName, type: 'LegalEntity' };
          } catch (e) {
            continue;
          }
        }
        return null;
      });

      if (structuredData) {
        sources.push('JSON-LD structured data');
        return {
          name: structuredData.name,
          method: 'structured_data_jsonld',
          confidence: 95,
          legalEntityType: this.detectEntityType(structuredData.name),
          sources,
        };
      }

      // Strategy 2: Meta Tags
      const metaData = await page.evaluate(() => {
        const metaTags = [
          'meta[property="og:site_name"]',
          'meta[name="application-name"]',
          'meta[property="og:title"]',
          'meta[name="author"]',
          'meta[name="company"]',
          'meta[name="organization"]',
        ];

        for (const selector of metaTags) {
          const meta = document.querySelector(selector);
          if (meta) {
            const content = meta.getAttribute('content');
            if (content && content.trim()) {
              return { name: content.trim(), selector };
            }
          }
        }
        return null;
      });

      if (metaData) {
        sources.push(`Meta tag: ${metaData.selector}`);
        return {
          name: metaData.name,
          method: 'meta_property',
          confidence: 90,
          legalEntityType: this.detectEntityType(metaData.name),
          sources,
        };
      }

      // Strategy 3: Footer Copyright
      const footerData = await page.evaluate(() => {
        const footers = document.querySelectorAll('footer, [class*="footer"], [id*="footer"]');
        for (const footer of footers) {
          const footerText = footer.textContent || '';
          const copyrightMatch = footerText.match(
            /©\s*\d{4}[-\s]*\d*\s*([^.]+?)(?:\s*[.|,]|\s*All\s*rights|\s*Inc\b|\s*Corp\b|\s*Ltd\b|\s*LLC\b|$)/i
          );
          if (copyrightMatch) {
            const company = copyrightMatch[1].trim();
            if (company.length > 2 && company.length < 100) {
              return { name: company };
            }
          }
        }
        return null;
      });

      if (footerData) {
        sources.push('Footer copyright section');
        return {
          name: footerData.name,
          method: 'footer_copyright',
          confidence: 85,
          legalEntityType: this.detectEntityType(footerData.name),
          sources,
        };
      }

      // Strategy 4: Header/Logo Elements
      const headerData = await page.evaluate(() => {
        const selectors = [
          'h1',
          '.logo',
          '#logo',
          '.brand',
          '.company-name',
          '[class*="logo"]',
          '[class*="brand"]',
          '.navbar-brand',
          '.site-title',
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.trim();
            if (text && text.length > 2 && text.length < 100 && !text.includes('\n')) {
              return { name: text, selector };
            }
          }
        }
        return null;
      });

      if (headerData) {
        sources.push(`Header element: ${headerData.selector}`);
        return {
          name: headerData.name,
          method: 'header_element',
          confidence: 70,
          legalEntityType: this.detectEntityType(headerData.name),
          sources,
        };
      }

      // Strategy 5: Title Tag Fallback
      const title = await page.title();
      if (title && title !== 'Example Domain' && !title.includes('Error') && !title.includes('404')) {
        const cleanTitle = title.split(/[-|:]/)[0].trim();
        if (cleanTitle.length > 2) {
          sources.push('Page title');
          return {
            name: cleanTitle,
            method: 'title_tag',
            confidence: 60,
            legalEntityType: this.detectEntityType(cleanTitle),
            sources,
          };
        }
      }

      return {
        name: null,
        method: null,
        confidence: 0,
        legalEntityType: null,
        sources: [],
      };
    } catch (error) {
      this.logStep('company_extraction_error', false, `Error: ${error.message}`);
      return {
        name: null,
        method: null,
        confidence: 0,
        legalEntityType: null,
        sources: [],
      };
    }
  }

  private detectEntityType(companyName: string): string | null {
    if (!companyName) return null;

    const entityPatterns = [
      { pattern: /\b(Inc\.?|Incorporated)\b/i, type: 'Corporation' },
      { pattern: /\bCorp\.?\b/i, type: 'Corporation' },
      { pattern: /\bLtd\.?\b/i, type: 'Limited Company' },
      { pattern: /\bLLC\b/i, type: 'Limited Liability Company' },
      { pattern: /\bGmbH\b/i, type: 'Gesellschaft mit beschränkter Haftung' },
      { pattern: /\bS\.A\.?\b/i, type: 'Société Anonyme' },
      { pattern: /\bPvt\.?\b/i, type: 'Private Limited' },
      { pattern: /\bPty\.?\b/i, type: 'Proprietary Limited' },
    ];

    for (const { pattern, type } of entityPatterns) {
      if (pattern.test(companyName)) {
        return type;
      }
    }

    return null;
  }

  private detectCountryFromTLD(domain: string): { country: string | null; confidence: number } {
    const tldCountryMap: Record<string, string> = {
      uk: 'GB',
      de: 'DE',
      fr: 'FR',
      jp: 'JP',
      cn: 'CN',
      ca: 'CA',
      au: 'AU',
      in: 'IN',
      br: 'BR',
      mx: 'MX',
      it: 'IT',
      es: 'ES',
      nl: 'NL',
      se: 'SE',
      no: 'NO',
      dk: 'DK',
      fi: 'FI',
      at: 'AT',
      ch: 'CH',
      be: 'BE',
      ru: 'RU',
      kr: 'KR',
      sg: 'SG',
      hk: 'HK',
      tw: 'TW',
    };

    const tld = domain.split('.').pop()?.toLowerCase();
    if (tld && tldCountryMap[tld]) {
      return { country: tldCountryMap[tld], confidence: 85 };
    }
    return { country: null, confidence: 0 };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      const page = await this.browser!.newPage();
      await page.goto('data:text/html,<html><body>Health Check</body></html>');
      await page.close();

      return true;
    } catch (error) {
      console.error('❌ Playwright health check failed:', error);
      return false;
    }
  }
}

export type { PlaywrightResult };
