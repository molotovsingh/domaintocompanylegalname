import puppeteer from 'puppeteer';

interface GeoMarkers {
  addresses: string[];
  phones: string[];
  currencies: string[];
  languages: string[];
  postalCodes: string[];
}

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
      
      // Extract all data in one page evaluation
      const extractedData = await page.evaluate(() => {
        // Company name extraction
        const extractCompanyName = () => {
          // Try structured data first
          const jsonLd = document.querySelector('script[type="application/ld+json"]');
          if (jsonLd) {
            try {
              const data = JSON.parse(jsonLd.textContent || '');
              if (data.name || data.organization?.name) {
                return {
                  name: data.name || data.organization.name,
                  method: 'structured_data',
                  confidence: 90
                };
              }
            } catch {}
          }
          
          // Try meta tags
          const metaName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
                          document.querySelector('meta[name="application-name"]')?.getAttribute('content');
          if (metaName) {
            return { name: metaName.trim(), method: 'meta_property', confidence: 75 };
          }
          
          // Try footer copyright
          const footer = document.querySelector('footer');
          if (footer) {
            const footerText = footer.textContent || '';
            const copyrightMatch = footerText.match(/©\s*\d{4}\s*([^.]+?)(?:\.|All|$)/i);
            if (copyrightMatch) {
              return { name: copyrightMatch[1].trim(), method: 'footer_copyright', confidence: 70 };
            }
          }
          
          // Fallback to title
          const title = document.title;
          if (title) {
            return { name: title.split(/[-|]/)[0].trim(), method: 'title_tag', confidence: 55 };
          }
          
          return null;
        };
        
        // Geographic markers extraction
        const extractGeoMarkers = () => {
          const text = document.body.textContent || '';
          const markers: any = {
            addresses: [],
            phones: [],
            currencies: [],
            languages: [],
            postalCodes: []
          };
          
          // Extract phone numbers
          const phoneRegex = /(\+\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
          const phones = text.match(phoneRegex) || [];
          markers.phones = [...new Set(phones.slice(0, 5))];
          
          // Extract postal codes
          const postalRegex = /\b\d{5}(-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g;
          const postals = text.match(postalRegex) || [];
          markers.postalCodes = [...new Set(postals.slice(0, 5))];
          
          // Detect currency symbols
          if (text.includes('$')) markers.currencies.push('USD');
          if (text.includes('€')) markers.currencies.push('EUR');
          if (text.includes('£')) markers.currencies.push('GBP');
          if (text.includes('¥')) markers.currencies.push('JPY/CNY');
          
          // Detect language from html lang attribute
          const htmlLang = document.documentElement.lang;
          if (htmlLang) markers.languages.push(htmlLang);
          
          return markers;
        };
        
        // Find legal documents
        const findLegalUrls = () => {
          const links = Array.from(document.querySelectorAll('a'));
          const legalUrls = [];
          
          const termsLink = links.find(a => 
            /terms|conditions|tos/i.test(a.textContent || '') || 
            /terms|conditions|tos/i.test(a.href)
          );
          
          const privacyLink = links.find(a => 
            /privacy/i.test(a.textContent || '') || 
            /privacy/i.test(a.href)
          );
          
          const cookieLink = links.find(a => 
            /cookie/i.test(a.textContent || '') || 
            /cookie/i.test(a.href)
          );
          
          if (termsLink) legalUrls.push({ type: 'terms', url: termsLink.href });
          if (privacyLink) legalUrls.push({ type: 'privacy', url: privacyLink.href });
          if (cookieLink) legalUrls.push({ type: 'cookies', url: cookieLink.href });
          
          return {
            termsUrl: termsLink?.href || null,
            privacyUrl: privacyLink?.href || null,
            legalUrls
          };
        };
        
        // Find about us page
        const findAboutUrl = () => {
          const links = Array.from(document.querySelectorAll('a'));
          const aboutLink = links.find(a => 
            /about|company|who.we.are/i.test(a.textContent || '') || 
            /about|company/i.test(a.href)
          );
          return aboutLink?.href || null;
        };
        
        // Extract social media links
        const findSocialMedia = () => {
          const links = Array.from(document.querySelectorAll('a'));
          const socialMedia: any = {};
          
          // Common social media patterns
          const patterns = {
            twitter: /twitter\.com|x\.com/i,
            linkedin: /linkedin\.com/i,
            facebook: /facebook\.com/i,
            instagram: /instagram\.com/i,
            youtube: /youtube\.com/i,
            github: /github\.com/i,
            tiktok: /tiktok\.com/i
          };
          
          for (const link of links) {
            const href = link.href || '';
            for (const [platform, pattern] of Object.entries(patterns)) {
              if (pattern.test(href) && !socialMedia[platform]) {
                socialMedia[platform] = href;
              }
            }
          }
          
          return socialMedia;
        };
        
        // Extract contact information
        const extractContactInfo = () => {
          const text = document.body.textContent || '';
          const html = document.body.innerHTML || '';
          
          // Extract emails
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = [...new Set(text.match(emailRegex) || [])].filter(email => 
            !email.includes('example.com') && !email.includes('@2x')
          ).slice(0, 5);
          
          // Extract phone numbers (enhanced)
          const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
          const phones = [...new Set(text.match(phoneRegex) || [])]
            .filter(phone => phone.length >= 10 && phone.length <= 20)
            .slice(0, 5);
          
          // Extract addresses (basic pattern)
          const addressRegex = /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|plaza|place|pl)[\s,]+[\w\s]+(?:,\s*[\w\s]+)?(?:\s+\d{5})?/gi;
          const addresses = [...new Set(text.match(addressRegex) || [])].slice(0, 3);
          
          // Check for contact page
          const hasContactPage = !!document.querySelector('a[href*="contact"]') || 
                                text.toLowerCase().includes('contact us');
          
          return {
            emails,
            phones,
            addresses,
            hasContactPage
          };
        };
        
        // Get page metadata
        const getPageMetadata = () => {
          return {
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
            keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content'),
            viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
            charset: document.characterSet,
            htmlLang: document.documentElement.lang
          };
        };
        
        return {
          company: extractCompanyName(),
          geoMarkers: extractGeoMarkers(),
          legal: findLegalUrls(),
          aboutUrl: findAboutUrl(),
          socialMedia: findSocialMedia(),
          contactInfo: extractContactInfo(),
          pageMetadata: getPageMetadata(),
          htmlSize: document.documentElement.outerHTML.length
        };
      });
      
      this.logStep('data_extraction', true, 'Extracted all primary data');
      
      // Detect country from geo markers
      const detectedCountry = this.detectCountry(extractedData.geoMarkers, domain);
      
      // Try to extract about content if URL found
      let aboutContent = null;
      let aboutSuccess = false;
      if (extractedData.aboutUrl) {
        try {
          await page.goto(extractedData.aboutUrl, { waitUntil: 'networkidle0', timeout: 10000 });
          aboutContent = await page.evaluate(() => {
            const main = document.querySelector('main') || document.querySelector('.content') || document.body;
            return main?.textContent?.substring(0, 1000) || null;
          });
          aboutSuccess = !!aboutContent;
          this.logStep('about_extraction', aboutSuccess, 'Extracted about page content');
        } catch (e) {
          this.logStep('about_extraction', false, `Failed: ${e.message}`);
        }
      }
      
      // Check for JavaScript errors
      const jsErrors: any[] = [];
      page.on('pageerror', error => {
        jsErrors.push({
          message: error.message,
          stack: error.stack
        });
      });
      
      await page.close();
      
      return {
        // Performance
        processingTimeMs: Date.now() - startTime,
        success: !!extractedData.company,
        error: null,
        
        // Company data
        companyName: extractedData.company?.name || null,
        companyConfidence: extractedData.company?.confidence || 0,
        companyExtractionMethod: extractedData.company?.method || null,
        
        // Geographic
        detectedCountry: detectedCountry.country,
        countryConfidence: detectedCountry.confidence,
        geoMarkers: extractedData.geoMarkers,
        
        // Legal
        termsUrl: extractedData.legal.termsUrl,
        privacyUrl: extractedData.legal.privacyUrl,
        legalUrls: extractedData.legal.legalUrls,
        legalContentExtracted: extractedData.legal.legalUrls.length > 0,
        
        // About
        aboutUrl: extractedData.aboutUrl,
        aboutContent: aboutContent,
        aboutExtractionSuccess: aboutSuccess,
        
        // Social Media
        socialMediaLinks: extractedData.socialMedia,
        socialMediaCount: Object.keys(extractedData.socialMedia).length,
        
        // Contact Information
        contactEmails: extractedData.contactInfo.emails,
        contactPhones: extractedData.contactInfo.phones,
        contactAddresses: extractedData.contactInfo.addresses,
        hasContactPage: extractedData.contactInfo.hasContactPage,
        
        // Raw data
        rawHtmlSize: extractedData.htmlSize,
        rawExtractionData: extractedData,
        pageMetadata: extractedData.pageMetadata,
        
        // Technical
        httpStatus,
        renderRequired: true,
        javascriptErrors: jsErrors,
        extractionSteps: this.steps
      };
      
    } catch (error) {
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
        geoMarkers: { addresses: [], phones: [], currencies: [], languages: [], postalCodes: [] },
        termsUrl: null,
        privacyUrl: null,
        legalUrls: [],
        legalContentExtracted: false,
        aboutUrl: null,
        aboutContent: null,
        aboutExtractionSuccess: false,
        socialMediaLinks: {},
        socialMediaCount: 0,
        contactEmails: [],
        contactPhones: [],
        contactAddresses: [],
        hasContactPage: false,
        rawHtmlSize: 0,
        rawExtractionData: null,
        pageMetadata: null,
        httpStatus: 0,
        renderRequired: true,
        javascriptErrors: [],
        extractionSteps: this.steps
      };
    }
  }
  
  private detectCountry(geoMarkers: GeoMarkers, domain: string): { country: string | null, confidence: number } {
    const tld = domain.split('.').pop();
    const tldCountryMap: Record<string, string> = {
      'uk': 'GB', 'de': 'DE', 'fr': 'FR', 'jp': 'JP', 'cn': 'CN',
      'ca': 'CA', 'au': 'AU', 'in': 'IN', 'br': 'BR', 'mx': 'MX'
    };
    
    // Check TLD first
    if (tldCountryMap[tld || '']) {
      return { country: tldCountryMap[tld || ''], confidence: 85 };
    }
    
    // Check phone country codes
    const phoneCountryCodes: Record<string, string> = {
      '+1': 'US', '+44': 'GB', '+49': 'DE', '+33': 'FR', '+81': 'JP',
      '+86': 'CN', '+91': 'IN', '+55': 'BR', '+52': 'MX'
    };
    
    for (const phone of geoMarkers.phones) {
      for (const [code, country] of Object.entries(phoneCountryCodes)) {
        if (phone.startsWith(code)) {
          return { country, confidence: 75 };
        }
      }
    }
    
    // Check currencies
    const currencyCountryMap: Record<string, string> = {
      'USD': 'US', 'EUR': 'EU', 'GBP': 'GB', 'JPY': 'JP', 'CNY': 'CN'
    };
    
    if (geoMarkers.currencies.length > 0) {
      const currency = geoMarkers.currencies[0];
      if (currencyCountryMap[currency]) {
        return { country: currencyCountryMap[currency], confidence: 60 };
      }
    }
    
    // Check language
    if (geoMarkers.languages.length > 0) {
      const lang = geoMarkers.languages[0].split('-')[0];
      const langCountryMap: Record<string, string> = {
        'en': 'US', 'de': 'DE', 'fr': 'FR', 'es': 'ES', 'pt': 'BR',
        'ja': 'JP', 'zh': 'CN', 'hi': 'IN'
      };
      if (langCountryMap[lang]) {
        return { country: langCountryMap[lang], confidence: 50 };
      }
    }
    
    return { country: null, confidence: 0 };
  }
}