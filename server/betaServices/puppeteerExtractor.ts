import puppeteer from 'puppeteer';

interface ExtractionStep {
  step: string;
  success: boolean;
  details: string;
  timestamp: number;
}

export class PuppeteerExtractor {
  private browser: puppeteer.Browser | null = null;
  private steps: ExtractionStep[] = [];

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials'
      ]
    });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private logStep(step: string, success: boolean, details: string) {
    this.steps.push({
      step,
      success,
      details,
      timestamp: Date.now()
    });
  }

  async extractFromDomain(domain: string) {
    const startTime = Date.now();
    this.steps = [];
    
    const page = await this.browser!.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    try {
      // Navigate to domain
      const url = `https://${domain}`;
      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 20000 
      });
      
      const httpStatus = response?.status() || 0;
      this.logStep('navigation', true, `Loaded ${url} with status ${httpStatus}`);
      
      // Simple extraction - get basic data only
      const title = await page.title();
      const htmlSize = await page.evaluate(() => document.documentElement.outerHTML.length);
      
      // Try to get company name from title
      let companyName = null;
      let companyConfidence = 0;
      let companyExtractionMethod = null;
      
      if (title && title !== 'Example Domain') {
        companyName = title.split(/[-|]/)[0].trim();
        companyConfidence = 60;
        companyExtractionMethod = 'title_tag';
      }
      
      // Basic geo detection from domain TLD
      let detectedCountry = null;
      let countryConfidence = 0;
      const tld = domain.split('.').pop();
      const tldCountryMap: Record<string, string> = {
        'uk': 'GB', 'de': 'DE', 'fr': 'FR', 'jp': 'JP', 'cn': 'CN',
        'ca': 'CA', 'au': 'AU', 'in': 'IN', 'br': 'BR', 'mx': 'MX'
      };
      
      if (tldCountryMap[tld || '']) {
        detectedCountry = tldCountryMap[tld || ''];
        countryConfidence = 85;
      }
      
      this.logStep('data_extraction', true, 'Extracted basic data');
      
      await page.close();
      
      return {
        // Performance
        processingTimeMs: Date.now() - startTime,
        success: !!companyName,
        error: null,
        
        // Company data
        companyName,
        companyConfidence,
        companyExtractionMethod,
        
        // Geographic
        detectedCountry,
        countryConfidence,
        geoMarkers: JSON.stringify({ addresses: [], phones: [], currencies: [], languages: [], postalCodes: [] }),
        
        // Legal
        termsUrl: null,
        privacyUrl: null,
        legalUrls: JSON.stringify([]),
        legalContentExtracted: false,
        
        // About
        aboutUrl: null,
        aboutContent: null,
        aboutExtractionSuccess: false,
        
        // Social Media
        socialMediaLinks: JSON.stringify({}),
        socialMediaCount: 0,
        
        // Contact Information
        contactEmails: JSON.stringify([]),
        contactPhones: JSON.stringify([]),
        contactAddresses: JSON.stringify([]),
        hasContactPage: false,
        
        // Raw data
        rawHtmlSize: htmlSize,
        rawExtractionData: JSON.stringify({ title, domain, httpStatus }),
        pageMetadata: JSON.stringify({ title, charset: 'utf-8', htmlLang: 'en' }),
        
        // Technical
        httpStatus,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps)
      };
      
    } catch (error: any) {
      await page.close();
      this.logStep('error', false, error.message);
      
      return {
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message,
        companyName: null,
        companyConfidence: 0,
        companyExtractionMethod: null,
        detectedCountry: null,
        countryConfidence: 0,
        geoMarkers: JSON.stringify({ addresses: [], phones: [], currencies: [], languages: [], postalCodes: [] }),
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
        rawExtractionData: null,
        pageMetadata: null,
        httpStatus: 0,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps)
      };
    }
  }
}