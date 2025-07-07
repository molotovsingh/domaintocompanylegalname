import puppeteer from "puppeteer";
import axios from "axios";
import * as cheerio from "cheerio";

interface ExtractionStep {
  step: string;
  success: boolean;
  details: string;
  timestamp: number;
}

interface ExtractorResult {
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
  legalEntityType?: string | null;
  sources?: string[];
}

// Enhanced utility functions
class ExtractionUtils {
  static readonly TLD_COUNTRY_MAP: Record<string, string> = {
    uk: "GB",
    de: "DE",
    fr: "FR",
    jp: "JP",
    cn: "CN",
    ca: "CA",
    au: "AU",
    in: "IN",
    br: "BR",
    mx: "MX",
    it: "IT",
    es: "ES",
    nl: "NL",
    se: "SE",
    no: "NO",
    dk: "DK",
    fi: "FI",
    at: "AT",
    ch: "CH",
    be: "BE",
    ru: "RU",
    kr: "KR",
    sg: "SG",
    hk: "HK",
    tw: "TW",
  };

  static readonly PHONE_COUNTRY_CODES: Record<string, string> = {
    "+1": "US",
    "+44": "GB",
    "+49": "DE",
    "+33": "FR",
    "+81": "JP",
    "+86": "CN",
    "+91": "IN",
    "+55": "BR",
    "+52": "MX",
    "+39": "IT",
    "+34": "ES",
    "+31": "NL",
    "+46": "SE",
    "+47": "NO",
    "+45": "DK",
    "+41": "CH",
    "+43": "AT",
    "+32": "BE",
    "+7": "RU",
    "+82": "KR",
    "+65": "SG",
    "+852": "HK",
    "+886": "TW",
    "+61": "AU",
  };

  static readonly CURRENCY_COUNTRY_MAP: Record<string, string> = {
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    JPY: "JP",
    CNY: "CN",
    CAD: "CA",
    AUD: "AU",
    INR: "IN",
    BRL: "BR",
    MXN: "MX",
    CHF: "CH",
    SEK: "SE",
    NOK: "NO",
    DKK: "DK",
    RUB: "RU",
    KRW: "KR",
    SGD: "SG",
    HKD: "HK",
    TWD: "TW",
  };

  // Updated Chrome path for Replit environment
  static readonly CHROME_EXECUTABLE_PATH =
    process.env.CHROME_EXECUTABLE_PATH || 
    "/nix/store/*/bin/chromium" || 
    "/usr/bin/chromium-browser" || 
    "/usr/bin/google-chrome-stable" || 
    "/usr/bin/chromium";

  static readonly CHROME_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox", 
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-web-security",
    "--disable-features=VizDisplayCompositor",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-images",
    "--disable-default-apps",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", 
    "--disable-renderer-backgrounding",
    "--disable-field-trial-config",
    "--disable-back-forward-cache",
    "--disable-ipc-flooding-protection",
    "--memory-pressure-off",
    "--max_old_space_size=2048",
    "--single-process",
    "--no-zygote",
    "--disable-software-rasterizer",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    "--mute-audio",
    "--hide-scrollbars",
    "--disable-prompt-on-repost",
    "--disable-hang-monitor",
    "--disable-client-side-phishing-detection",
    "--disable-component-update"
  ];

  static readonly USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  static detectCountryFromTLD(domain: string): {
    country: string | null;
    confidence: number;
  } {
    const tld = domain.split(".").pop()?.toLowerCase();
    if (tld && this.TLD_COUNTRY_MAP[tld]) {
      return { country: this.TLD_COUNTRY_MAP[tld], confidence: 85 };
    }
    return { country: null, confidence: 0 };
  }

  static detectCountryFromPhone(phone: string): {
    country: string | null;
    confidence: number;
  } {
    for (const [code, country] of Object.entries(this.PHONE_COUNTRY_CODES)) {
      if (phone.startsWith(code)) {
        return { country, confidence: 75 };
      }
    }
    return { country: null, confidence: 0 };
  }

  static extractPhoneNumbers(text: string): string[] {
    const phoneRegex =
      /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
    const phones = text.match(phoneRegex) || [];
    return Array.from(new Set(phones))
      .filter((phone) => {
        const cleanPhone = phone.replace(/\D/g, "");
        return cleanPhone.length >= 10 && cleanPhone.length <= 15;
      })
      .slice(0, 5);
  }

  static extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    return Array.from(new Set(emails))
      .filter(
        (email) =>
          !email.includes("example.com") &&
          !email.includes("@2x") &&
          !email.includes("noreply") &&
          !email.includes("no-reply"),
      )
      .slice(0, 5);
  }

  static extractPostalCodes(text: string): string[] {
    const postalRegex =
      /\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b|\b\d{4}\s?[A-Z]{2}\b/g;
    const postals = text.match(postalRegex) || [];
    return Array.from(new Set(postals)).slice(0, 5);
  }

  static extractAddresses(text: string): string[] {
    const addressRegex =
      /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|plaza|place|pl|way|circle|crescent|close)[\s,]+[\w\s]+/gi;
    const addresses = text.match(addressRegex) || [];
    return Array.from(new Set(addresses))
      .filter((addr) => addr.length > 10 && addr.length < 200)
      .slice(0, 3);
  }

  static detectCurrencies(text: string): string[] {
    const currencies: string[] = [];
    if (text.includes("$") || text.includes("USD")) currencies.push("USD");
    if (text.includes("€") || text.includes("EUR")) currencies.push("EUR");
    if (text.includes("£") || text.includes("GBP")) currencies.push("GBP");
    if (text.includes("¥") || text.includes("JPY")) currencies.push("JPY");
    if (text.includes("₹") || text.includes("INR")) currencies.push("INR");
    if (text.includes("C$") || text.includes("CAD")) currencies.push("CAD");
    if (text.includes("A$") || text.includes("AUD")) currencies.push("AUD");
    if (text.includes("CHF")) currencies.push("CHF");
    if (text.includes("₽") || text.includes("RUB")) currencies.push("RUB");
    return Array.from(new Set(currencies));
  }

  static findSocialMediaLinks(links: Element[]): Record<string, string> {
    const socialLinks: Record<string, string> = {};
    const patterns = [
      ["twitter", /twitter\.com|x\.com/i],
      ["linkedin", /linkedin\.com/i],
      ["facebook", /facebook\.com/i],
      ["instagram", /instagram\.com/i],
      ["youtube", /youtube\.com/i],
      ["github", /github\.com/i],
      ["tiktok", /tiktok\.com/i],
      ["discord", /discord\.gg|discord\.com/i],
      ["telegram", /t\.me|telegram\.me/i],
      ["whatsapp", /wa\.me|whatsapp\.com/i],
    ];

    for (const link of links) {
      const href = (link as HTMLAnchorElement).href || "";
      for (const [platform, pattern] of patterns) {
        if (pattern.test(href) && !socialLinks[platform]) {
          socialLinks[platform] = href;
        }
      }
    }
    return socialLinks;
  }

  static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static validateDomain(domain: string): boolean {
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }
}

export class PuppeteerExtractor {
  private browser: puppeteer.Browser | null = null;
  private steps: ExtractionStep[] = [];
  private readonly MAX_CONCURRENT_PAGES = 3;
  private readonly PAGE_TIMEOUT = 12000;
  private readonly NAVIGATION_TIMEOUT = 15000;
  private extractionCache = new Map<string, ExtractorResult>();

  async initialize() {
    try {
      // Try with auto-detection first (works better in Replit)
      const launchOptions = {
        headless: true,
        args: ExtractionUtils.CHROME_ARGS,
        timeout: 30000,
      };

      // Only set executablePath if explicitly provided
      if (process.env.CHROME_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.CHROME_EXECUTABLE_PATH;
      }

      this.browser = await puppeteer.launch(launchOptions);
      console.log("✅ Puppeteer browser initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Puppeteer browser:", error);
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log("✅ Puppeteer browser closed successfully");
      } catch (error) {
        console.error("⚠️ Error closing browser:", error);
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
    console.log(`${success ? "✅" : "❌"} ${step}: ${details}`);
  }

  // Smart routing to determine if Puppeteer is needed
  private async shouldUsePuppeteer(domain: string): Promise<boolean> {
    try {
      const response = await axios.head(`https://${domain}`, {
        timeout: 3000,
        headers: { "User-Agent": ExtractionUtils.USER_AGENT },
      });

      const contentType = response.headers["content-type"] || "";

      // Use Puppeteer for SPAs and complex sites
      return (
        contentType.includes("text/html") &&
        (domain.includes("app.") ||
          domain.includes("portal.") ||
          domain.includes("dashboard.") ||
          response.headers["x-powered-by"]?.includes("React") ||
          response.headers["x-powered-by"]?.includes("Vue") ||
          response.headers["x-powered-by"]?.includes("Angular"))
      );
    } catch {
      return true; // Default to Puppeteer for safety
    }
  }

  // Main extraction method with intelligent routing
  async extractFromDomain(
    domain: string,
    useCache: boolean = true,
  ): Promise<ExtractorResult> {
    const startTime = Date.now();
    this.steps = [];

    // Input validation
    if (!ExtractionUtils.validateDomain(domain)) {
      return this.createErrorResult(domain, startTime, "Invalid domain format");
    }

    // Check cache first
    const cacheKey = `${domain}_${Math.floor(Date.now() / (24 * 60 * 60 * 1000))}`; // Daily cache
    if (useCache && this.extractionCache.has(cacheKey)) {
      this.logStep("cache_hit", true, `Retrieved from cache: ${domain}`);
      return this.extractionCache.get(cacheKey)!;
    }

    try {
      // Smart routing decision
      const usePuppeteer = await this.shouldUsePuppeteer(domain);
      this.logStep(
        "routing_decision",
        true,
        `Using ${usePuppeteer ? "Puppeteer" : "Axios/Cheerio"} for ${domain}`,
      );

      let result: ExtractorResult;

      if (usePuppeteer) {
        // Try Puppeteer first
        try {
          result = await this.extractWithPuppeteer(domain, startTime);
        } catch (puppeteerError) {
          this.logStep(
            "puppeteer_fallback",
            false,
            `Puppeteer failed: ${puppeteerError.message}`,
          );

          // Fallback to axios/cheerio
          result = await this.extractWithAxiosCheerio(domain, startTime);
        }
      } else {
        // Try Axios/Cheerio first
        try {
          result = await this.extractWithAxiosCheerio(domain, startTime);
        } catch (axiosError) {
          this.logStep(
            "axios_fallback",
            false,
            `Axios failed: ${axiosError.message}`,
          );

          // Fallback to Puppeteer
          result = await this.extractWithPuppeteer(domain, startTime);
        }
      }

      // Cache successful results
      if (result.success && useCache) {
        this.extractionCache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      this.logStep(
        "extraction_error",
        false,
        `All methods failed: ${error.message}`,
      );
      return this.createErrorResult(
        domain,
        startTime,
        `Extraction failed: ${error.message}`,
      );
    }
  }

  private async extractWithPuppeteer(
    domain: string,
    startTime: number,
  ): Promise<ExtractorResult> {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call initialize() first.");
    }

    const page = await this.createManagedPage();

    try {
      // Navigate to domain
      const url = domain.startsWith("http") ? domain : `https://${domain}`;
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.NAVIGATION_TIMEOUT,
      });

      const httpStatus = response?.status() || 0;
      this.logStep(
        "navigation",
        true,
        `Loaded ${url} with status ${httpStatus}`,
      );

      // Wait for potential dynamic content
      await ExtractionUtils.delay(2000);

      // Extract comprehensive data
      const title = await page.title();
      const htmlSize = await page.evaluate(
        () => document.documentElement.outerHTML.length,
      );

      // Enhanced company name extraction with concurrent processing
      const companyResult = await this.extractCompanyNameComprehensive(
        page,
        domain,
      );
      this.logStep(
        "company_extraction",
        !!companyResult.name,
        `Found: ${companyResult.name || "none"} via ${companyResult.method}`,
      );

      // Geographic intelligence
      const geoResult = await this.extractGeographicMarkers(page, domain);
      this.logStep(
        "geo_extraction",
        geoResult.markers.length > 0,
        `Found ${geoResult.markers.length} geo markers`,
      );

      // Legal documents with enhanced content extraction
      const legalResult = await this.extractLegalDocumentsEnhanced(page);
      this.logStep(
        "legal_extraction",
        legalResult.urls.length > 0,
        `Found ${legalResult.urls.length} legal docs`,
      );

      // Social media
      const socialResult = await this.extractSocialMedia(page);
      this.logStep(
        "social_extraction",
        socialResult.count > 0,
        `Found ${socialResult.count} social links`,
      );

      // Contact information
      const contactResult = await this.extractContactInfo(page);
      this.logStep(
        "contact_extraction",
        contactResult.emails.length > 0,
        `Found ${contactResult.emails.length} emails`,
      );

      // About page with enhanced extraction
      const aboutResult = await this.extractAboutInfoEnhanced(page, domain);
      this.logStep(
        "about_extraction",
        !!aboutResult.url,
        `Found about: ${!!aboutResult.url}`,
      );

      return {
        processingTimeMs: Date.now() - startTime,
        success: !!companyResult.name,
        error: null,
        companyName: companyResult.name,
        companyConfidence: companyResult.confidence,
        companyExtractionMethod: companyResult.method,
        legalEntityType: companyResult.legalEntityType,
        detectedCountry: geoResult.country,
        countryConfidence: geoResult.countryConfidence,
        geoMarkers: JSON.stringify({
          addresses: geoResult.markers
            .filter((m) => m.type === "address")
            .map((m) => m.value),
          phones: geoResult.markers
            .filter((m) => m.type === "phone")
            .map((m) => m.value),
          currencies: geoResult.markers
            .filter((m) => m.type === "currency")
            .map((m) => m.value),
          languages: geoResult.markers
            .filter((m) => m.type === "language")
            .map((m) => m.value),
          postalCodes: geoResult.markers
            .filter((m) => m.type === "postal")
            .map((m) => m.value),
        }),
        termsUrl: legalResult.urls.find((u) => u.type === "terms")?.url || null,
        privacyUrl:
          legalResult.urls.find((u) => u.type === "privacy")?.url || null,
        legalUrls: JSON.stringify(legalResult.urls),
        legalContentExtracted: legalResult.contentExtracted,
        aboutUrl: aboutResult.url,
        aboutContent: aboutResult.content,
        aboutExtractionSuccess: !!aboutResult.content,
        socialMediaLinks: JSON.stringify(socialResult.links),
        socialMediaCount: socialResult.count,
        contactEmails: JSON.stringify(contactResult.emails),
        contactPhones: JSON.stringify(contactResult.phones),
        contactAddresses: JSON.stringify(contactResult.addresses),
        hasContactPage: contactResult.hasContactPage,
        rawHtmlSize: htmlSize,
        sources: companyResult.sources,
        rawExtractionData: JSON.stringify({
          title,
          domain,
          httpStatus,
          extractionSummary: {
            company: companyResult,
            geo: geoResult,
            legal: legalResult,
            social: socialResult,
            contact: contactResult,
            about: aboutResult,
          },
        }),
        pageMetadata: JSON.stringify({
          title,
          charset: await page.evaluate(() => document.characterSet),
          htmlLang: await page.evaluate(() => document.documentElement.lang),
        }),
        httpStatus,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps),
      };
    } catch (error: any) {
      this.logStep(
        "puppeteer_error",
        false,
        `Puppeteer extraction failed: ${error.message}`,
      );
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  }

  // Enhanced resource-managed page creation
  private async createManagedPage(): Promise<puppeteer.Page> {
    const page = await this.browser!.newPage();

    // Set user agent
    await page.setUserAgent(ExtractionUtils.USER_AGENT);

    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Set request interception for performance
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Set timeouts
    page.setDefaultTimeout(this.PAGE_TIMEOUT);
    page.setDefaultNavigationTimeout(this.NAVIGATION_TIMEOUT);

    return page;
  }

  // Enhanced company name extraction with concurrent processing
  private async extractCompanyNameComprehensive(
    page: puppeteer.Page,
    domain: string,
  ) {
    try {
      const title = await page.title();
      let sources: string[] = [];

      // Strategy 1: JSON-LD Structured Data (highest priority)
      const structuredData = await page.evaluate(() => {
        const jsonLdScripts = document.querySelectorAll(
          'script[type="application/ld+json"]',
        );
        for (const script of jsonLdScripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (data.name) return { name: data.name, type: data["@type"] };
            if (data.organization?.name)
              return { name: data.organization.name, type: "Organization" };
            if (data.legalName)
              return { name: data.legalName, type: "LegalEntity" };
          } catch (e) {
            continue;
          }
        }
        return null;
      });

      if (structuredData) {
        sources.push("JSON-LD structured data");
        return {
          name: structuredData.name,
          method: "structured_data_jsonld",
          confidence: 95,
          legalEntityType: this.detectEntityType(structuredData.name),
          sources,
        };
      }

      // Strategy 2: Meta Tags (high priority)
      const metaData = await page.evaluate(() => {
        const metaTags = [
          'meta[property="og:site_name"]',
          'meta[name="application-name"]',
          'meta[property="og:title"]',
          'meta[name="author"]',
          'meta[property="business:contact_data:company_name"]',
          'meta[name="company"]',
          'meta[name="organization"]',
        ];

        for (const selector of metaTags) {
          const meta = document.querySelector(selector);
          if (meta) {
            const content = meta.getAttribute("content");
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
          method: "meta_property",
          confidence: 90,
          legalEntityType: this.detectEntityType(metaData.name),
          sources,
        };
      }

      // Strategy 3: Footer Legal Information (medium-high priority)
      const footerExtraction = await page.evaluate(() => {
        const footers = document.querySelectorAll(
          'footer, [class*="footer"], [id*="footer"]',
        );
        for (const footer of footers) {
          const footerText = footer.textContent || "";

          // Look for copyright notices
          const copyrightMatch = footerText.match(
            /©\s*\d{4}[-\s]*\d*\s*([^.]+?)(?:\s*[.|,]|\s*All\s*rights|\s*Inc\b|\s*Corp\b|\s*Ltd\b|\s*LLC\b|$)/i,
          );
          if (copyrightMatch) {
            const company = copyrightMatch[1].trim();
            if (company.length > 2 && company.length < 100) {
              return { name: company, method: "footer_copyright" };
            }
          }

          // Look for "Company Name Ltd" or similar patterns
          const entityMatch = footerText.match(
            /([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH|S\.A\.|Pvt|Pty|AB|AG)\.?)/,
          );
          if (entityMatch) {
            return { name: entityMatch[1].trim(), method: "footer_entity" };
          }
        }
        return null;
      });

      if (footerExtraction) {
        sources.push("Footer copyright/legal section");
        return {
          name: footerExtraction.name,
          method: footerExtraction.method,
          confidence: 85,
          legalEntityType: this.detectEntityType(footerExtraction.name),
          sources,
        };
      }

      // Strategy 4-6: Concurrent page-based extractions
      const pageExtractions = await this.performConcurrentPageExtractions(
        page,
        domain,
      );
      if (pageExtractions.name) {
        return pageExtractions;
      }

      // Strategy 7: Header/Logo analysis
      const headerData = await page.evaluate(() => {
        const selectors = [
          "h1",
          ".logo",
          "#logo",
          ".brand",
          ".company-name",
          '[class*="logo"]',
          '[class*="brand"]',
          '[class*="company"]',
          ".navbar-brand",
          ".site-title",
          ".header-title",
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent?.trim();
            if (
              text &&
              text.length > 2 &&
              text.length < 100 &&
              !text.includes("\n")
            ) {
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
          method: "header_element",
          confidence: 70,
          legalEntityType: this.detectEntityType(headerData.name),
          sources,
        };
      }

      // Strategy 8: Title tag fallback
      if (
        title &&
        title !== "Example Domain" &&
        !title.includes("Error") &&
        !title.includes("404")
      ) {
        const cleanTitle = title.split(/[-|:]/)[0].trim();
        if (cleanTitle.length > 2) {
          sources.push("Page title");
          return {
            name: cleanTitle,
            method: "title_tag",
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
      this.logStep(
        "company_extraction_error",
        false,
        `Error: ${error.message}`,
      );
      return {
        name: null,
        method: null,
        confidence: 0,
        legalEntityType: null,
        sources: [],
      };
    }
  }

  // Concurrent page-based extractions for better performance
  private async performConcurrentPageExtractions(
    page: puppeteer.Page,
    domain: string,
  ) {
    const extractionPromises = [
      this.safeExtractFromAboutPage(page, domain),
      this.safeExtractFromLegalPages(page, domain),
      this.safeExtractFromContactPage(page, domain),
    ];

    const results = await Promise.allSettled(extractionPromises);

    // Return first successful extraction
    for (const result of results) {
      if (result.status === "fulfilled" && result.value?.name) {
        return result.value;
      }
    }

    return {
      name: null,
      method: null,
      confidence: 0,
      legalEntityType: null,
      sources: [],
    };
  }

  // Safe extraction from About page
  private async safeExtractFromAboutPage(page: puppeteer.Page, domain: string) {
    let newPage: puppeteer.Page | null = null;

    try {
      const aboutUrl = await this.findAboutUrl(page);
      if (!aboutUrl) return null;

      newPage = await this.createManagedPage();
      await newPage.goto(aboutUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.PAGE_TIMEOUT,
      });

      const companyName = await this.extractCompanyFromAboutContent(newPage);
      return companyName
        ? {
            name: companyName,
            method: "about_page",
            confidence: 80,
            legalEntityType: this.detectEntityType(companyName),
            sources: ["About Us page"],
          }
        : null;
    } catch (error) {
      this.logStep(
        "about_extraction_error",
        false,
        `About page error: ${error.message}`,
      );
      return null;
    } finally {
      if (newPage) {
        await newPage.close().catch(() => {});
      }
    }
  }

  // Safe extraction from legal pages
  private async safeExtractFromLegalPages(
    page: puppeteer.Page,
    domain: string,
  ) {
    let newPage: puppeteer.Page | null = null;

    try {
      const legalUrls = await this.findLegalUrls(page);
      if (legalUrls.length === 0) return null;

      for (const url of legalUrls.slice(0, 2)) {
        newPage = await this.createManagedPage();
        try {
          await newPage.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: this.PAGE_TIMEOUT,
          });

          const companyName =
            await this.extractCompanyFromLegalContent(newPage);
          if (companyName) {
            return {
              name: companyName,
              method: "legal_pages",
              confidence: 85,
              legalEntityType: this.detectEntityType(companyName),
              sources: ["Legal pages (Terms/Privacy)"],
            };
          }
        } catch (error) {
          // Continue to next legal page
        } finally {
          await newPage.close().catch(() => {});
          newPage = null;
        }
      }

      return null;
    } catch (error) {
      this.logStep(
        "legal_extraction_error",
        false,
        `Legal page error: ${error.message}`,
      );
      return null;
    } finally {
      if (newPage) {
        await newPage.close().catch(() => {});
      }
    }
  }

  // Safe extraction from contact page
  private async safeExtractFromContactPage(
    page: puppeteer.Page,
    domain: string,
  ) {
    let newPage: puppeteer.Page | null = null;

    try {
      const contactUrl = await this.findContactUrl(page);
      if (!contactUrl) return null;

      newPage = await this.createManagedPage();
      await newPage.goto(contactUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.PAGE_TIMEOUT,
      });

      const companyName = await this.extractCompanyFromContactContent(newPage);
      return companyName
        ? {
            name: companyName,
            method: "contact_page",
            confidence: 75,
            legalEntityType: this.detectEntityType(companyName),
            sources: ["Contact page"],
          }
        : null;
    } catch (error) {
      this.logStep(
        "contact_extraction_error",
        false,
        `Contact page error: ${error.message}`,
      );
      return null;
    } finally {
      if (newPage) {
        await newPage.close().catch(() => {});
      }
    }
  }

  // Helper methods for URL finding
  private async findAboutUrl(page: puppeteer.Page): Promise<string | null> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const aboutLink = links.find((a) => {
        const text = (a.textContent || "").toLowerCase();
        const href = a.href.toLowerCase();
        return (
          text.includes("about") ||
          text.includes("company") ||
          href.includes("/about") ||
          href.includes("/company") ||
          href.includes("/who-we-are") ||
          href.includes("/our-story")
        );
      });
      return aboutLink?.href || null;
    });
  }

  private async findLegalUrls(page: puppeteer.Page): Promise<string[]> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const legalUrls: string[] = [];

      for (const link of links) {
        const href = link.href;
        const text = (link.textContent || "").toLowerCase();

        if (
          (text.includes("terms") ||
            text.includes("privacy") ||
            href.includes("terms") ||
            href.includes("privacy")) &&
          !legalUrls.includes(href)
        ) {
          legalUrls.push(href);
        }
      }

      return legalUrls.slice(0, 3);
    });
  }

  private async findContactUrl(page: puppeteer.Page): Promise<string | null> {
    return await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const contactLink = links.find((a) => {
        const text = (a.textContent || "").toLowerCase();
        const href = a.href.toLowerCase();
        return text.includes("contact") || href.includes("/contact");
      });
      return contactLink?.href || null;
    });
  }

  // Content extraction methods
  private async extractCompanyFromAboutContent(
    page: puppeteer.Page,
  ): Promise<string | null> {
    return await page.evaluate(() => {
      const text = document.body.textContent || "";

      const patterns = [
        /(?:We are|About)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
        /([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)\s+is\s+(?:a|an|the)/,
        /(?:Founded as|Established as)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
        /(?:Welcome to|This is)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
      return null;
    });
  }

  private async extractCompanyFromLegalContent(
    page: puppeteer.Page,
  ): Promise<string | null> {
    return await page.evaluate(() => {
      const text = document.body.textContent || "";

      const patterns = [
        /(?:operated by|provided by|owned by)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
        /([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)\s+(?:operates|provides|owns)/,
        /These terms.*?between you and\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
        /This privacy policy.*?by\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
      return null;
    });
  }

  private async extractCompanyFromContactContent(
    page: puppeteer.Page,
  ): Promise<string | null> {
    return await page.evaluate(() => {
      const text = document.body.textContent || "";

      const patterns = [
        /(?:Contact|Reach)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
        /([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)\s+(?:Contact|Office)/,
        /(?:Get in touch with|Contact us at)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|GmbH)\.?)/,
      ];

      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return match[1].trim();
        }
      }
      return null;
    });
  }

  // Helper method to detect legal entity type from company name
  private detectEntityType(companyName: string): string | null {
    if (!companyName) return null;

    const entityPatterns = [
      { pattern: /\b(Inc\.?|Incorporated)\b/i, type: "Corporation" },
      { pattern: /\bCorp\.?\b/i, type: "Corporation" },
      { pattern: /\bLtd\.?\b/i, type: "Limited Company" },
      { pattern: /\bLLC\b/i, type: "Limited Liability Company" },
      { pattern: /\bGmbH\b/i, type: "Gesellschaft mit beschränkter Haftung" },
      { pattern: /\bS\.A\.?\b/i, type: "Société Anonyme" },
      { pattern: /\bPvt\.?\b/i, type: "Private Limited" },
      { pattern: /\bPty\.?\b/i, type: "Proprietary Limited" },
      { pattern: /\bAB\b/i, type: "Aktiebolag" },
      { pattern: /\bAG\b/i, type: "Aktiengesellschaft" },
      { pattern: /\bSA\b/i, type: "Société Anonyme" },
      { pattern: /\bNV\b/i, type: "Naamloze Vennootschap" },
      { pattern: /\bBV\b/i, type: "Besloten Vennootschap" },
    ];

    for (const { pattern, type } of entityPatterns) {
      if (pattern.test(companyName)) {
        return type;
      }
    }

    return null;
  }

  // Enhanced legal documents extraction
  private async extractLegalDocumentsEnhanced(page: puppeteer.Page) {
    try {
      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a"));
        const legalUrls: any[] = [];

        for (const link of links) {
          const href = link.href;
          const text = (link.textContent || "").toLowerCase();

          if (
            text.includes("terms") ||
            text.includes("conditions") ||
            href.includes("terms")
          ) {
            legalUrls.push({ type: "terms", url: href });
          }
          if (text.includes("privacy") || href.includes("privacy")) {
            legalUrls.push({ type: "privacy", url: href });
          }
          if (text.includes("cookie") || href.includes("cookie")) {
            legalUrls.push({ type: "cookies", url: href });
          }
          if (text.includes("legal") || href.includes("legal")) {
            legalUrls.push({ type: "legal", url: href });
          }
        }

        return legalUrls.slice(0, 10);
      });

      // Try to extract content from legal pages
      let contentExtracted = false;
      for (const legalUrl of urls.slice(0, 2)) {
        try {
          const newPage = await this.createManagedPage();
          await newPage.goto(legalUrl.url, {
            waitUntil: "domcontentloaded",
            timeout: this.PAGE_TIMEOUT,
          });

          const hasContent = await newPage.evaluate(() => {
            return (
              document.body.textContent &&
              document.body.textContent.length > 500
            );
          });

          await newPage.close();

          if (hasContent) {
            contentExtracted = true;
            break;
          }
        } catch (error) {
          // Continue to next legal page
        }
      }

      return { urls, contentExtracted };
    } catch (error) {
      return { urls: [], contentExtracted: false };
    }
  }

  // Enhanced about page extraction
  private async extractAboutInfoEnhanced(page: puppeteer.Page, domain: string) {
    try {
      const aboutUrl = await this.findAboutUrl(page);

      let content = null;
      if (aboutUrl) {
        try {
          const newPage = await this.createManagedPage();
          await newPage.goto(aboutUrl, {
            waitUntil: "domcontentloaded",
            timeout: this.PAGE_TIMEOUT,
          });

          content = await newPage.evaluate(() => {
            const main =
              document.querySelector("main") ||
              document.querySelector(".content") ||
              document.querySelector("#content") ||
              document.body;
            return main?.textContent?.substring(0, 1000) || null;
          });

          await newPage.close();
        } catch (e) {
          // Failed to load about page
        }
      }

      return { url: aboutUrl, content };
    } catch (error) {
      return { url: null, content: null };
    }
  }

  // Geographic markers extraction
  private async extractGeographicMarkers(page: puppeteer.Page, domain: string) {
    try {
      const text = await page.evaluate(() => document.body.textContent || "");
      const markers: any[] = [];

      // Phone numbers
      const phones = ExtractionUtils.extractPhoneNumbers(text);
      phones.forEach((phone) => {
        markers.push({ type: "phone", value: phone });
      });

      // Postal codes
      const postals = ExtractionUtils.extractPostalCodes(text);
      postals.forEach((postal) => {
        markers.push({ type: "postal", value: postal });
      });

      // Addresses
      const addresses = ExtractionUtils.extractAddresses(text);
      addresses.forEach((address) => {
        markers.push({ type: "address", value: address });
      });

      // Currencies
      const currencies = ExtractionUtils.detectCurrencies(text);
      currencies.forEach((currency) => {
        markers.push({ type: "currency", value: currency });
      });

      // Language detection
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      if (htmlLang) {
        markers.push({ type: "language", value: htmlLang });
      }

      // Country detection from TLD
      const tldResult = ExtractionUtils.detectCountryFromTLD(domain);

      // Try phone-based country detection if TLD didn't work
      let country = tldResult.country;
      let countryConfidence = tldResult.confidence;

      if (!country && phones.length > 0) {
        const phoneResult = ExtractionUtils.detectCountryFromPhone(phones[0]);
        country = phoneResult.country;
        countryConfidence = phoneResult.confidence;
      }

      return { markers, country, countryConfidence };
    } catch (error) {
      return { markers: [], country: null, countryConfidence: 0 };
    }
  }

  // Social media extraction
  private async extractSocialMedia(page: puppeteer.Page) {
    try {
      const links = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll("a"));
        const socialLinks: Record<string, string> = {};

        const patterns = [
          ["twitter", /twitter\.com|x\.com/i],
          ["linkedin", /linkedin\.com/i],
          ["facebook", /facebook\.com/i],
          ["instagram", /instagram\.com/i],
          ["youtube", /youtube\.com/i],
          ["github", /github\.com/i],
          ["tiktok", /tiktok\.com/i],
          ["discord", /discord\.gg|discord\.com/i],
          ["telegram", /t\.me|telegram\.me/i],
          ["whatsapp", /wa\.me|whatsapp\.com/i],
        ];

        for (const link of allLinks) {
          const href = link.href || "";
          for (const [platform, pattern] of patterns) {
            if (pattern.test(href) && !socialLinks[platform]) {
              socialLinks[platform] = href;
            }
          }
        }

        return socialLinks;
      });

      return { links, count: Object.keys(links).length };
    } catch (error) {
      return { links: {}, count: 0 };
    }
  }

  // Contact information extraction
  private async extractContactInfo(page: puppeteer.Page) {
    try {
      const text = await page.evaluate(() => document.body.textContent || "");

      // Extract emails
      const emails = ExtractionUtils.extractEmails(text);

      // Extract phone numbers
      const phones = ExtractionUtils.extractPhoneNumbers(text);

      // Extract addresses
      const addresses = ExtractionUtils.extractAddresses(text);

      // Check for contact page
      const hasContactPage = await page.evaluate(() => {
        const contactLinks = document.querySelectorAll('a[href*="contact"]');
        const text = document.body.textContent || "";
        return (
          contactLinks.length > 0 || text.toLowerCase().includes("contact us")
        );
      });

      return { emails, phones, addresses, hasContactPage };
    } catch (error) {
      return { emails: [], phones: [], addresses: [], hasContactPage: false };
    }
  }

  // Axios/Cheerio fallback method
  private async extractWithAxiosCheerio(
    domain: string,
    startTime: number,
  ): Promise<ExtractorResult> {
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const axiosConfig = {
      timeout: 10000,
      headers: {
        "User-Agent": ExtractionUtils.USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    };

    try {
      const response = await axios.get(url, axiosConfig);
      const $ = cheerio.load(response.data);

      this.logStep(
        "axios_navigation",
        true,
        `Loaded ${url} with status ${response.status}`,
      );

      // Extract company name using various selectors
      let companyName: string | null = null;
      let extractionMethod: string | null = null;
      let confidence = 0;
      let legalEntityType: string | null = null;
      let sources: string[] = [];

      // Try structured data first
      const jsonLd = $('script[type="application/ld+json"]').first();
      if (jsonLd.length > 0) {
        try {
          const data = JSON.parse(jsonLd.html() || "");
          if (data.name || (data.organization && data.organization.name)) {
            companyName = data.name || data.organization.name;
            extractionMethod = "structured_data";
            confidence = 90;
            sources.push("JSON-LD structured data");
            legalEntityType = this.detectEntityType(companyName);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Try meta tags
      if (!companyName) {
        const metaTags = [
          'meta[property="og:site_name"]',
          'meta[name="application-name"]',
          'meta[name="author"]',
          'meta[property="og:title"]',
          'meta[name="company"]',
          'meta[name="organization"]',
        ];

        for (const selector of metaTags) {
          const content = $(selector).attr("content");
          if (content && content.trim()) {
            companyName = content.trim();
            extractionMethod = `meta_tag_${selector}`;
            confidence = 80;
            sources.push(`Meta tag: ${selector}`);
            legalEntityType = this.detectEntityType(companyName);
            break;
          }
        }
      }

      // Try footer copyright
      if (!companyName) {
        const footer = $("footer");
        if (footer.length > 0) {
          const footerText = footer.text();
          const copyrightMatch = footerText.match(
            /©\s*\d{4}\s*([^.]+?)(?:\.|All|$)/i,
          );
          if (copyrightMatch) {
            companyName = copyrightMatch[1].trim();
            extractionMethod = "footer_copyright";
            confidence = 75;
            sources.push("Footer copyright section");
            legalEntityType = this.detectEntityType(companyName);
          }
        }
      }

      // Try title tag
      if (!companyName) {
        const title = $("title").text().trim();
        if (title) {
          companyName = title.split("|")[0].split("-")[0].trim();
          extractionMethod = "title_tag";
          confidence = 60;
          sources.push("Page title");
          legalEntityType = this.detectEntityType(companyName);
        }
      }

      // Try common header selectors
      if (!companyName) {
        const headerSelectors = [
          "h1",
          ".logo",
          "#logo",
          ".brand",
          ".company-name",
          ".navbar-brand",
        ];
        for (const selector of headerSelectors) {
          const text = $(selector).first().text().trim();
          if (text && text.length > 2 && text.length < 100) {
            companyName = text;
            extractionMethod = `header_${selector}`;
            confidence = 65;
            sources.push(`Header element: ${selector}`);
            legalEntityType = this.detectEntityType(companyName);
            break;
          }
        }
      }

      // Basic geo detection
      const tldResult = ExtractionUtils.detectCountryFromTLD(domain);

      this.logStep(
        "axios_extraction",
        !!companyName,
        `Extracted: ${companyName || "none"}`,
      );

      return {
        processingTimeMs: Date.now() - startTime,
        success: !!companyName,
        error: null,
        companyName,
        companyConfidence: confidence,
        companyExtractionMethod: extractionMethod,
        legalEntityType,
        detectedCountry: tldResult.country,
        countryConfidence: tldResult.confidence,
        geoMarkers: JSON.stringify({
          addresses: [],
          phones: [],
          currencies: [],
          languages: [],
          postalCodes: [],
        }),
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
        rawHtmlSize: response.data.length,
        sources,
        rawExtractionData: JSON.stringify({
          title: $("title").text(),
          domain,
          httpStatus: response.status,
        }),
        pageMetadata: JSON.stringify({
          title: $("title").text(),
          charset: "utf-8",
          htmlLang: $("html").attr("lang") || "en",
        }),
        httpStatus: response.status,
        renderRequired: false,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps),
      };
    } catch (error) {
      this.logStep(
        "axios_error",
        false,
        `Axios extraction failed: ${error.message}`,
      );
      throw error;
    }
  }

  // Create error result
  private createErrorResult(
    domain: string,
    startTime: number,
    error: string,
  ): ExtractorResult {
    return {
      processingTimeMs: Date.now() - startTime,
      success: false,
      error,
      companyName: null,
      companyConfidence: 0,
      companyExtractionMethod: null,
      legalEntityType: null,
      detectedCountry: null,
      countryConfidence: 0,
      geoMarkers: JSON.stringify({
        addresses: [],
        phones: [],
        currencies: [],
        languages: [],
        postalCodes: [],
      }),
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
      sources: [],
      rawExtractionData: null,
      pageMetadata: null,
      httpStatus: 0,
      renderRequired: false,
      javascriptErrors: JSON.stringify([]),
      extractionSteps: JSON.stringify(this.steps),
    };
  }

  // Cache management methods
  public clearCache(): void {
    this.extractionCache.clear();
    console.log("🗑️ Extraction cache cleared");
  }

  public getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.extractionCache.size,
      domains: Array.from(this.extractionCache.keys()),
    };
  }

  // Health check method
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.browser) {
        await this.initialize();
      }

      const page = await this.browser!.newPage();
      await page.goto("data:text/html,<html><body>Health Check</body></html>");
      await page.close();

      return true;
    } catch (error) {
      console.error("❌ Health check failed:", error);
      return false;
    }
  }
}

// Export the class and types
export type { ExtractorResult, ExtractionStep };
export { ExtractionUtils };
