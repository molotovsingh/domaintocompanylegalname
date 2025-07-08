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
      
      // Extract comprehensive data step by step
      const title = await page.title();
      const htmlSize = await page.evaluate(() => document.documentElement.outerHTML.length);
      
      // Company name extraction
      const companyResult = await this.extractCompanyName(page);
      this.logStep('company_extraction', !!companyResult.name, `Found: ${companyResult.name || 'none'}`);
      
      // Geographic intelligence
      const geoResult = await this.extractGeographicMarkers(page, domain);
      this.logStep('geo_extraction', geoResult.markers.length > 0, `Found ${geoResult.markers.length} geo markers`);
      
      // Legal documents
      const legalResult = await this.extractLegalDocuments(page);
      this.logStep('legal_extraction', legalResult.urls.length > 0, `Found ${legalResult.urls.length} legal docs`);
      
      // Social media
      const socialResult = await this.extractSocialMedia(page);
      this.logStep('social_extraction', socialResult.count > 0, `Found ${socialResult.count} social links`);
      
      // Contact information
      const contactResult = await this.extractContactInfo(page);
      this.logStep('contact_extraction', contactResult.emails.length > 0, `Found ${contactResult.emails.length} emails`);
      
      // About page
      const aboutResult = await this.extractAboutInfo(page);
      this.logStep('about_extraction', !!aboutResult.url, `Found about: ${!!aboutResult.url}`);
      
      await page.close();
      
      return {
        // Performance
        processingTimeMs: Date.now() - startTime,
        success: !!companyResult.name,
        error: null,
        
        // Company data
        companyName: companyResult.name,
        companyConfidence: companyResult.confidence,
        companyExtractionMethod: companyResult.method,
        
        // Geographic
        detectedCountry: geoResult.country,
        countryConfidence: geoResult.countryConfidence,
        geoMarkers: JSON.stringify({
          addresses: geoResult.markers.filter(m => m.type === 'address').map(m => m.value),
          phones: geoResult.markers.filter(m => m.type === 'phone').map(m => m.value),
          currencies: geoResult.markers.filter(m => m.type === 'currency').map(m => m.value),
          languages: geoResult.markers.filter(m => m.type === 'language').map(m => m.value),
          postalCodes: geoResult.markers.filter(m => m.type === 'postal').map(m => m.value)
        }),
        
        // Legal
        termsUrl: legalResult.urls.find(u => u.type === 'terms')?.url || null,
        privacyUrl: legalResult.urls.find(u => u.type === 'privacy')?.url || null,
        legalUrls: JSON.stringify(legalResult.urls),
        legalContentExtracted: legalResult.urls.length > 0,
        
        // About
        aboutUrl: aboutResult.url,
        aboutContent: aboutResult.content,
        aboutExtractionSuccess: !!aboutResult.content,
        
        // Social Media
        socialMediaLinks: JSON.stringify(socialResult.links),
        socialMediaCount: socialResult.count,
        
        // Contact Information
        contactEmails: JSON.stringify(contactResult.emails),
        contactPhones: JSON.stringify(contactResult.phones),
        contactAddresses: JSON.stringify(contactResult.addresses),
        hasContactPage: contactResult.hasContactPage,
        
        // Raw data
        rawHtmlSize: htmlSize,
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
            about: aboutResult
          }
        }),
        pageMetadata: JSON.stringify({ 
          title, 
          charset: await page.evaluate(() => document.characterSet),
          htmlLang: await page.evaluate(() => document.documentElement.lang)
        }),
        
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
  
  private async extractCompanyName(page: puppeteer.Page) {
    try {
      // Try multiple methods with confidence scoring
      const title = await page.title();
      
      // Check for structured data
      const structuredData = await page.evaluate(() => {
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd.textContent || '');
            return data.name || (data.organization && data.organization.name) || null;
          } catch (e) {
            return null;
          }
        }
        return null;
      });
      
      if (structuredData) {
        return { name: structuredData, method: 'structured_data', confidence: 90 };
      }
      
      // Check meta tags
      const metaName = await page.evaluate(() => {
        const ogSiteName = document.querySelector('meta[property="og:site_name"]');
        const appName = document.querySelector('meta[name="application-name"]');
        return ogSiteName?.getAttribute('content') || appName?.getAttribute('content') || null;
      });
      
      if (metaName) {
        return { name: metaName.trim(), method: 'meta_property', confidence: 85 };
      }
      
      // Footer copyright
      const footerName = await page.evaluate(() => {
        const footer = document.querySelector('footer');
        if (footer) {
          const footerText = footer.textContent || '';
          const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.]+?)(?:\.|All|$)/i);
          if (copyrightMatch) {
            return copyrightMatch[1].trim();
          }
        }
        return null;
      });
      
      if (footerName) {
        return { name: footerName, method: 'footer_copyright', confidence: 75 };
      }
      
      // Fallback to title
      if (title && title !== 'Example Domain') {
        const cleanTitle = title.split(/[-|]/)[0].trim();
        return { name: cleanTitle, method: 'title_tag', confidence: 60 };
      }
      
      return { name: null, method: null, confidence: 0 };
    } catch (error) {
      return { name: null, method: null, confidence: 0 };
    }
  }
  
  private async extractGeographicMarkers(page: puppeteer.Page, domain: string) {
    try {
      const text = await page.evaluate(() => document.body.textContent || '');
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
      const htmlLang = await page.evaluate(() => document.documentElement.lang);
      if (htmlLang) {
        markers.push({ type: 'language', value: htmlLang });
      }
      
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
      
      return { markers, country, countryConfidence };
    } catch (error) {
      return { markers: [], country: null, countryConfidence: 0 };
    }
  }
  
  private async extractLegalDocuments(page: puppeteer.Page) {
    try {
      const urls = await page.evaluate(() => {
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
        
        return legalUrls.slice(0, 10); // Limit results
      });
      
      return { urls };
    } catch (error) {
      return { urls: [] };
    }
  }
  
  private async extractSocialMedia(page: puppeteer.Page) {
    try {
      const links = await page.evaluate(() => {
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
      
      return { links, count: Object.keys(links).length };
    } catch (error) {
      return { links: {}, count: 0 };
    }
  }
  
  private async extractContactInfo(page: puppeteer.Page) {
    try {
      const text = await page.evaluate(() => document.body.textContent || '');
      
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
      const hasContactPage = await page.evaluate(() => {
        const contactLinks = document.querySelectorAll('a[href*="contact"]');
        const text = document.body.textContent || '';
        return contactLinks.length > 0 || text.toLowerCase().includes('contact us');
      });
      
      return { emails, phones, addresses, hasContactPage };
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
          await page.goto(aboutUrl, { waitUntil: 'networkidle0', timeout: 10000 });
          content = await page.evaluate(() => {
            const main = document.querySelector('main') || document.querySelector('.content') || document.body;
            return main?.textContent?.substring(0, 500) || null;
          });
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