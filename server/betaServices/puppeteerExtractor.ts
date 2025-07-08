
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
      // Try to find Chromium executable dynamically
      const chromiumPath = await this.findChromiumExecutable();
      
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor,IsolateOrigins',
          '--disable-site-isolation-trials',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--no-default-browser-check',
          '--single-process'
        ],
        timeout: 30000
      });
      
      this.logStep('browser_init', true, 'Browser initialized successfully');
      
    } catch (error: any) {
      this.logStep('browser_init', false, `Browser initialization failed: ${error.message}`);
      throw new Error(`Failed to initialize Puppeteer browser: ${error.message}`);
    }
  }

  private async findChromiumExecutable(): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    
    // Common Chromium paths in Nix environments
    const possiblePaths = [
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      process.env.PUPPETEER_EXECUTABLE_PATH
    ].filter(Boolean);

    // Try to find a working executable
    for (const execPath of possiblePaths) {
      try {
        if (fs.existsSync(execPath)) {
          return execPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    // If no specific path found, let Puppeteer handle it
    return puppeteer.executablePath();
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.logStep('cleanup', true, 'Browser closed successfully');
      } catch (error: any) {
        this.logStep('cleanup', false, `Cleanup error: ${error.message}`);
      }
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
      // Create new page with timeout
      page = await this.browser.newPage();
      await page.setDefaultTimeout(20000);
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      this.logStep('page_setup', true, 'Page created and configured');
      
      // Navigate to domain
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      });
      
      const httpStatus = response?.status() || 0;
      this.logStep('navigation', httpStatus < 400, `Loaded ${url} with status ${httpStatus}`);
      
      if (httpStatus >= 400) {
        throw new Error(`HTTP ${httpStatus} - Failed to load page`);
      }
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Extract comprehensive data
      const extractionResult = await this.performExtraction(page, domain);
      
      const result: PuppeteerExtractionResult = {
        processingTimeMs: Date.now() - startTime,
        success: !!extractionResult.companyName,
        error: null,
        companyName: extractionResult.companyName,
        companyConfidence: extractionResult.companyConfidence,
        companyExtractionMethod: extractionResult.companyExtractionMethod,
        detectedCountry: extractionResult.detectedCountry,
        countryConfidence: extractionResult.countryConfidence,
        geoMarkers: JSON.stringify(extractionResult.geoMarkers),
        termsUrl: extractionResult.termsUrl,
        privacyUrl: extractionResult.privacyUrl,
        legalUrls: JSON.stringify(extractionResult.legalUrls),
        legalContentExtracted: extractionResult.legalUrls.length > 0,
        aboutUrl: extractionResult.aboutUrl,
        aboutContent: extractionResult.aboutContent,
        aboutExtractionSuccess: !!extractionResult.aboutContent,
        socialMediaLinks: JSON.stringify(extractionResult.socialMediaLinks),
        socialMediaCount: Object.keys(extractionResult.socialMediaLinks).length,
        contactEmails: JSON.stringify(extractionResult.contactEmails),
        contactPhones: JSON.stringify(extractionResult.contactPhones),
        contactAddresses: JSON.stringify(extractionResult.contactAddresses),
        hasContactPage: extractionResult.hasContactPage,
        rawHtmlSize: extractionResult.rawHtmlSize,
        rawExtractionData: JSON.stringify(extractionResult.rawData),
        pageMetadata: JSON.stringify(extractionResult.pageMetadata),
        httpStatus,
        renderRequired: true,
        javascriptErrors: JSON.stringify([]),
        extractionSteps: JSON.stringify(this.steps)
      };
      
      this.logStep('extraction_complete', true, `Extracted data for ${domain}`);
      return result;
      
    } catch (error: any) {
      this.logStep('extraction_error', false, error.message);
      
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

  private async performExtraction(page: puppeteer.Page, domain: string) {
    // Extract basic page data
    const title = await page.title();
    const htmlSize = await page.evaluate(() => document.documentElement.outerHTML.length);
    
    // Company name extraction with multiple methods
    const companyResult = await this.extractCompanyName(page);
    this.logStep('company_extraction', !!companyResult.name, `Company: ${companyResult.name || 'none'}`);
    
    // Geographic markers
    const geoResult = await this.extractGeographicMarkers(page, domain);
    this.logStep('geo_extraction', geoResult.markers.length > 0, `Geo markers: ${geoResult.markers.length}`);
    
    // Legal documents
    const legalResult = await this.extractLegalDocuments(page);
    this.logStep('legal_extraction', legalResult.length > 0, `Legal docs: ${legalResult.length}`);
    
    // Social media links
    const socialResult = await this.extractSocialMedia(page);
    this.logStep('social_extraction', Object.keys(socialResult).length > 0, `Social links: ${Object.keys(socialResult).length}`);
    
    // Contact information
    const contactResult = await this.extractContactInfo(page);
    this.logStep('contact_extraction', contactResult.emails.length > 0, `Contacts: ${contactResult.emails.length} emails`);
    
    // About information
    const aboutResult = await this.extractAboutInfo(page);
    this.logStep('about_extraction', !!aboutResult.url, `About: ${aboutResult.url ? 'found' : 'none'}`);
    
    // Page metadata
    const metadata = await page.evaluate(() => ({
      title: document.title,
      charset: document.characterSet,
      lang: document.documentElement.lang,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null
    }));
    
    return {
      companyName: companyResult.name,
      companyConfidence: companyResult.confidence,
      companyExtractionMethod: companyResult.method,
      detectedCountry: geoResult.country,
      countryConfidence: geoResult.countryConfidence,
      geoMarkers: {
        addresses: geoResult.markers.filter(m => m.type === 'address').map(m => m.value),
        phones: geoResult.markers.filter(m => m.type === 'phone').map(m => m.value),
        currencies: geoResult.markers.filter(m => m.type === 'currency').map(m => m.value),
        languages: geoResult.markers.filter(m => m.type === 'language').map(m => m.value),
        postalCodes: geoResult.markers.filter(m => m.type === 'postal').map(m => m.value)
      },
      termsUrl: legalResult.find(l => l.type === 'terms')?.url || null,
      privacyUrl: legalResult.find(l => l.type === 'privacy')?.url || null,
      legalUrls: legalResult,
      aboutUrl: aboutResult.url,
      aboutContent: aboutResult.content,
      socialMediaLinks: socialResult,
      contactEmails: contactResult.emails,
      contactPhones: contactResult.phones,
      contactAddresses: contactResult.addresses,
      hasContactPage: contactResult.hasContactPage,
      rawHtmlSize: htmlSize,
      rawData: {
        title,
        domain,
        extractionSummary: {
          company: companyResult,
          geo: geoResult,
          legal: legalResult,
          social: socialResult,
          contact: contactResult,
          about: aboutResult
        }
      },
      pageMetadata: metadata
    };
  }

  private async extractCompanyName(page: puppeteer.Page) {
    try {
      const result = await page.evaluate(() => {
        // Method 1: Structured data (JSON-LD)
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd.textContent || '');
            const name = data.name || (data.organization && data.organization.name);
            if (name) return { name, method: 'structured_data', confidence: 90 };
          } catch (e) {
            // Continue
          }
        }
        
        // Method 2: Meta tags
        const ogSiteName = document.querySelector('meta[property="og:site_name"]');
        const appName = document.querySelector('meta[name="application-name"]');
        const metaName = ogSiteName?.getAttribute('content') || appName?.getAttribute('content');
        if (metaName) {
          return { name: metaName.trim(), method: 'meta_property', confidence: 85 };
        }
        
        // Method 3: Footer copyright
        const footer = document.querySelector('footer');
        if (footer) {
          const footerText = footer.textContent || '';
          const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.]+?)(?:\.|All|$)/i);
          if (copyrightMatch) {
            return { name: copyrightMatch[1].trim(), method: 'footer_copyright', confidence: 75 };
          }
        }
        
        // Method 4: Page title
        const title = document.title;
        if (title && title !== 'Example Domain') {
          const cleanTitle = title.split(/[-|]/)[0].trim();
          return { name: cleanTitle, method: 'title_tag', confidence: 60 };
        }
        
        return { name: null, method: null, confidence: 0 };
      });
      
      return result;
    } catch (error) {
      return { name: null, method: null, confidence: 0 };
    }
  }

  private async extractGeographicMarkers(page: puppeteer.Page, domain: string) {
    try {
      const result = await page.evaluate(() => {
        const text = document.body.textContent || '';
        const markers: any[] = [];
        
        // Phone numbers
        const phoneRegex = /(\+\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
        const phones = text.match(phoneRegex) || [];
        phones.slice(0, 3).forEach(phone => {
          if (phone.length >= 10 && phone.length <= 20) {
            markers.push({ type: 'phone', value: phone });
          }
        });
        
        // Postal codes
        const postalRegex = /\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g;
        const postals = text.match(postalRegex) || [];
        postals.slice(0, 3).forEach(postal => {
          markers.push({ type: 'postal', value: postal });
        });
        
        // Currency symbols
        if (text.includes('$')) markers.push({ type: 'currency', value: 'USD' });
        if (text.includes('€')) markers.push({ type: 'currency', value: 'EUR' });
        if (text.includes('£')) markers.push({ type: 'currency', value: 'GBP' });
        if (text.includes('¥')) markers.push({ type: 'currency', value: 'JPY/CNY' });
        
        // Language detection
        const htmlLang = document.documentElement.lang;
        if (htmlLang) {
          markers.push({ type: 'language', value: htmlLang });
        }
        
        return { markers };
      });
      
      // Country detection from TLD
      const tld = domain.split('.').pop();
      const tldCountryMap: Record<string, string> = {
        'uk': 'GB', 'de': 'DE', 'fr': 'FR', 'jp': 'JP', 'cn': 'CN',
        'ca': 'CA', 'au': 'AU', 'in': 'IN', 'br': 'BR', 'mx': 'MX'
      };
      
      let country = null;
      let countryConfidence = 0;
      
      if (tldCountryMap[tld || '']) {
        country = tldCountryMap[tld || ''];
        countryConfidence = 85;
      }
      
      return { 
        markers: result.markers, 
        country, 
        countryConfidence 
      };
    } catch (error) {
      return { markers: [], country: null, countryConfidence: 0 };
    }
  }

  private async extractLegalDocuments(page: puppeteer.Page) {
    try {
      return await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const legalUrls: any[] = [];
        
        for (const link of links) {
          const href = link.href;
          const text = (link.textContent || '').toLowerCase();
          
          if (text.includes('terms') || text.includes('conditions') || href.includes('terms')) {
            legalUrls.push({ type: 'terms', url: href });
          }
          if (text.includes('privacy') || href.includes('privacy')) {
            legalUrls.push({ type: 'privacy', url: href });
          }
          if (text.includes('cookie') || href.includes('cookie')) {
            legalUrls.push({ type: 'cookies', url: href });
          }
          if (text.includes('legal') || href.includes('legal')) {
            legalUrls.push({ type: 'legal', url: href });
          }
        }
        
        return legalUrls.slice(0, 10);
      });
    } catch (error) {
      return [];
    }
  }

  private async extractSocialMedia(page: puppeteer.Page) {
    try {
      return await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        const socialLinks: Record<string, string> = {};
        
        const patterns = [
          ['twitter', /twitter\.com|x\.com/i],
          ['linkedin', /linkedin\.com/i],
          ['facebook', /facebook\.com/i],
          ['instagram', /instagram\.com/i],
          ['youtube', /youtube\.com/i],
          ['github', /github\.com/i],
          ['tiktok', /tiktok\.com/i]
        ];
        
        for (const link of allLinks) {
          const href = link.href || '';
          for (const [platform, pattern] of patterns) {
            if (pattern.test(href) && !socialLinks[platform]) {
              socialLinks[platform] = href;
            }
          }
        }
        
        return socialLinks;
      });
    } catch (error) {
      return {};
    }
  }

  private async extractContactInfo(page: puppeteer.Page) {
    try {
      return await page.evaluate(() => {
        const text = document.body.textContent || '';
        
        // Extract emails
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emailMatches = text.match(emailRegex) || [];
        const emails = Array.from(new Set(emailMatches))
          .filter(email => !email.includes('example.com') && !email.includes('@2x'))
          .slice(0, 5);
        
        // Extract phone numbers
        const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
        const phoneMatches = text.match(phoneRegex) || [];
        const phones = Array.from(new Set(phoneMatches))
          .filter(phone => phone.length >= 10 && phone.length <= 20)
          .slice(0, 5);
        
        // Extract addresses
        const addressRegex = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|plaza|place|pl)[\s,]+[\w\s]+/gi;
        const addressMatches = text.match(addressRegex) || [];
        const addresses = Array.from(new Set(addressMatches)).slice(0, 3);
        
        // Check for contact page
        const contactLinks = document.querySelectorAll('a[href*="contact"]');
        const hasContactPage = contactLinks.length > 0 || text.toLowerCase().includes('contact us');
        
        return { emails, phones, addresses, hasContactPage };
      });
    } catch (error) {
      return { emails: [], phones: [], addresses: [], hasContactPage: false };
    }
  }

  private async extractAboutInfo(page: puppeteer.Page) {
    try {
      const aboutUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const aboutLink = links.find(a => {
          const text = (a.textContent || '').toLowerCase();
          const href = a.href.toLowerCase();
          return text.includes('about') || text.includes('company') || href.includes('about') || href.includes('company');
        });
        return aboutLink?.href || null;
      });
      
      let content = null;
      if (aboutUrl) {
        try {
          const newPage = await this.browser!.newPage();
          await newPage.goto(aboutUrl, { waitUntil: 'networkidle0', timeout: 10000 });
          content = await newPage.evaluate(() => {
            const main = document.querySelector('main') || document.querySelector('.content') || document.body;
            return main?.textContent?.substring(0, 500) || null;
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
}
