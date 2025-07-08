
import axios from 'axios';
import * as cheerio from 'cheerio';

interface AxiosCheerioResult {
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

export class AxiosCheerioExtractor {
  private steps: ExtractionStep[] = [];
  private readonly TIMEOUT = 10000;
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  private logStep(step: string, success: boolean, details: string) {
    this.steps.push({
      step,
      success,
      details,
      timestamp: Date.now(),
    });
    console.log(`📡 ${success ? "✅" : "❌"} ${step}: ${details}`);
  }

  async extractFromDomain(domain: string): Promise<AxiosCheerioResult> {
    const startTime = Date.now();
    this.steps = [];

    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      this.logStep('request_start', true, `Requesting ${url}`);

      const response = await axios.get(url, {
        timeout: this.TIMEOUT,
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 5,
      });

      const httpStatus = response.status;
      this.logStep('request_success', true, `HTTP ${httpStatus} - ${response.data.length} bytes`);

      // Parse HTML
      const $ = cheerio.load(response.data);
      
      // Extract company name using multiple strategies
      const companyResult = await this.extractCompanyName($, domain);
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
        technicalDetails: `Axios/Cheerio extraction completed in ${Date.now() - startTime}ms`
      };

    } catch (error: any) {
      this.logStep('axios_error', false, `Request failed: ${error.message}`);
      
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
        httpStatus: error.response?.status || 0,
        extractionSteps: JSON.stringify(this.steps),
        sources: [],
        technicalDetails: `Axios/Cheerio extraction failed: ${error.message}`
      };
    }
  }

  private async extractCompanyName($: cheerio.CheerioAPI, domain: string) {
    let sources: string[] = [];

    try {
      // Strategy 1: JSON-LD Structured Data (highest priority)
      const structuredData = this.extractStructuredData($);
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
      const metaData = this.extractMetaTags($);
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
      const footerData = this.extractFooterCopyright($);
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
      const headerData = this.extractHeaderElements($);
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
      const title = $('title').text().trim();
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

  private extractStructuredData($: cheerio.CheerioAPI) {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const scriptContent = $(jsonLdScripts[i]).html();
        if (scriptContent) {
          const data = JSON.parse(scriptContent);
          if (data.name) return { name: data.name, type: data['@type'] };
          if (data.organization?.name) return { name: data.organization.name, type: 'Organization' };
          if (data.legalName) return { name: data.legalName, type: 'LegalEntity' };
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  private extractMetaTags($: cheerio.CheerioAPI) {
    const metaTags = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[property="og:title"]',
      'meta[name="author"]',
      'meta[name="company"]',
      'meta[name="organization"]',
    ];

    for (const selector of metaTags) {
      const content = $(selector).attr('content');
      if (content && content.trim()) {
        return { name: content.trim(), selector };
      }
    }
    return null;
  }

  private extractFooterCopyright($: cheerio.CheerioAPI) {
    const footers = $('footer, [class*="footer"], [id*="footer"]');
    for (let i = 0; i < footers.length; i++) {
      const footerText = $(footers[i]).text();
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
  }

  private extractHeaderElements($: cheerio.CheerioAPI) {
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
      const elements = $(selector);
      for (let i = 0; i < elements.length; i++) {
        const text = $(elements[i]).text()?.trim();
        if (text && text.length > 2 && text.length < 100 && !text.includes('\n')) {
          return { name: text, selector };
        }
      }
    }
    return null;
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
      const testResult = await this.extractFromDomain('example.com');
      return testResult.httpStatus === 200;
    } catch (error) {
      console.error('❌ Axios/Cheerio health check failed:', error);
      return false;
    }
  }
}

export type { AxiosCheerioResult };
