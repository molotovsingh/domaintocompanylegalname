
import axios from 'axios';
import * as cheerio from 'cheerio';
import { betaDb } from '../betaDb';
import { betaSmokeTests } from '../../shared/betaSchema';

interface AxiosCheerioResult {
  domain: string;
  method: string;
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
  rawExtractionData: string;
  pageMetadata: string;
  httpStatus: number;
  renderRequired: boolean;
  javascriptErrors: string;
  extractionSteps: string;
}

export async function runAxiosCheerioExtraction(domain: string): Promise<AxiosCheerioResult> {
  const startTime = Date.now();
  const steps: any[] = [];

  function logStep(step: string, success: boolean, details: string) {
    steps.push({
      step,
      success,
      details,
      timestamp: Date.now()
    });
  }

  const axiosConfig = {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const response = await axios.get(url, axiosConfig);
    const $ = cheerio.load(response.data);
    const htmlSize = response.data.length;

    logStep('navigation', true, `Loaded ${url} with status ${response.status}`);

    // Company name extraction with multiple strategies
    let companyName: string | null = null;
    let extractionMethod: string | null = null;
    let confidence = 0;

    // Strategy 1: Meta tags
    const metaTags = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="author"]',
      'meta[property="og:title"]'
    ];

    for (const selector of metaTags) {
      const content = $(selector).attr('content');
      if (content && content.trim()) {
        companyName = content.trim();
        extractionMethod = `meta_tag_${selector}`;
        confidence = 85;
        break;
      }
    }

    // Strategy 2: Title tag
    if (!companyName) {
      const title = $('title').text().trim();
      if (title && title !== 'Example Domain') {
        companyName = title.split('|')[0].split('-')[0].trim();
        extractionMethod = 'title_tag';
        confidence = 70;
      }
    }

    // Strategy 3: Header selectors
    if (!companyName) {
      const headerSelectors = ['h1', '.logo', '#logo', '.brand', '.company-name'];
      for (const selector of headerSelectors) {
        const text = $(selector).first().text().trim();
        if (text && text.length > 2 && text.length < 100) {
          companyName = text;
          extractionMethod = `header_${selector}`;
          confidence = 65;
          break;
        }
      }
    }

    logStep('company_extraction', !!companyName, `Found: ${companyName || 'none'}`);

    // Geographic detection from domain TLD
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

    // Legal document extraction
    const legalUrls: any[] = [];
    $('a').each((_, link) => {
      const href = $(link).attr('href') || '';
      const text = $(link).text().toLowerCase();
      
      if (text.includes('terms') || text.includes('conditions') || href.includes('terms')) {
        legalUrls.push({ type: 'terms', url: href });
      }
      if (text.includes('privacy') || href.includes('privacy')) {
        legalUrls.push({ type: 'privacy', url: href });
      }
    });

    // Social media extraction
    const socialLinks: Record<string, string> = {};
    $('a').each((_, link) => {
      const href = $(link).attr('href') || '';
      
      const patterns = [
        ['twitter', /twitter\.com|x\.com/i],
        ['linkedin', /linkedin\.com/i],
        ['facebook', /facebook\.com/i],
        ['instagram', /instagram\.com/i],
        ['youtube', /youtube\.com/i],
        ['github', /github\.com/i]
      ];

      for (const [platform, pattern] of patterns) {
        if (pattern.test(href) && !socialLinks[platform]) {
          socialLinks[platform] = href;
        }
      }
    });

    // Contact information extraction
    const text = $('body').text();
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;
    
    const emails = Array.from(new Set((text.match(emailRegex) || [])
      .filter(email => !email.includes('example.com'))
      .slice(0, 5)));
    
    const phones = Array.from(new Set((text.match(phoneRegex) || [])
      .filter(phone => phone.length >= 10 && phone.length <= 20)
      .slice(0, 5)));

    // About page detection
    let aboutUrl = null;
    $('a').each((_, link) => {
      const href = $(link).attr('href') || '';
      const linkText = $(link).text().toLowerCase();
      if (linkText.includes('about') || linkText.includes('company') || href.includes('about')) {
        aboutUrl = href;
        return false; // Break
      }
    });

    logStep('data_extraction', true, 'Completed all extractions');

    const result: AxiosCheerioResult = {
      domain,
      method: 'axios_cheerio',
      processingTimeMs: Date.now() - startTime,
      success: !!companyName,
      error: null,
      companyName,
      companyConfidence: confidence,
      companyExtractionMethod: extractionMethod,
      detectedCountry,
      countryConfidence,
      geoMarkers: JSON.stringify({
        addresses: [],
        phones: phones,
        currencies: [],
        languages: [],
        postalCodes: []
      }),
      termsUrl: legalUrls.find(u => u.type === 'terms')?.url || null,
      privacyUrl: legalUrls.find(u => u.type === 'privacy')?.url || null,
      legalUrls: JSON.stringify(legalUrls),
      legalContentExtracted: legalUrls.length > 0,
      aboutUrl,
      aboutContent: null,
      aboutExtractionSuccess: !!aboutUrl,
      socialMediaLinks: JSON.stringify(socialLinks),
      socialMediaCount: Object.keys(socialLinks).length,
      contactEmails: JSON.stringify(emails),
      contactPhones: JSON.stringify(phones),
      contactAddresses: JSON.stringify([]),
      hasContactPage: text.toLowerCase().includes('contact us'),
      rawHtmlSize: htmlSize,
      rawExtractionData: JSON.stringify({
        title: $('title').text(),
        domain,
        httpStatus: response.status,
        companyExtraction: { companyName, extractionMethod, confidence }
      }),
      pageMetadata: JSON.stringify({
        title: $('title').text(),
        charset: 'utf-8',
        htmlLang: $('html').attr('lang') || 'en'
      }),
      httpStatus: response.status,
      renderRequired: false,
      javascriptErrors: JSON.stringify([]),
      extractionSteps: JSON.stringify(steps)
    };

    // Store in beta database
    await betaDb.insert(betaSmokeTests).values({
      domain: result.domain,
      method: result.method,
      processingTimeMs: result.processingTimeMs,
      success: result.success,
      error: result.error,
      companyName: result.companyName,
      companyConfidence: result.companyConfidence,
      companyExtractionMethod: result.companyExtractionMethod,
      detectedCountry: result.detectedCountry,
      countryConfidence: result.countryConfidence,
      geoMarkers: JSON.parse(result.geoMarkers),
      termsUrl: result.termsUrl,
      privacyUrl: result.privacyUrl,
      legalUrls: JSON.parse(result.legalUrls),
      legalContentExtracted: result.legalContentExtracted,
      aboutUrl: result.aboutUrl,
      aboutContent: result.aboutContent,
      aboutExtractionSuccess: result.aboutExtractionSuccess,
      socialMediaLinks: JSON.parse(result.socialMediaLinks),
      socialMediaCount: result.socialMediaCount,
      contactEmails: JSON.parse(result.contactEmails),
      contactPhones: JSON.parse(result.contactPhones),
      contactAddresses: JSON.parse(result.contactAddresses),
      hasContactPage: result.hasContactPage,
      rawHtmlSize: result.rawHtmlSize,
      rawExtractionData: JSON.parse(result.rawExtractionData),
      pageMetadata: JSON.parse(result.pageMetadata),
      httpStatus: result.httpStatus,
      renderRequired: result.renderRequired,
      javascriptErrors: JSON.parse(result.javascriptErrors),
      extractionSteps: JSON.parse(result.extractionSteps)
    });

    console.log(`✅ Axios/Cheerio extraction completed for ${domain}: ${companyName || 'no company found'}`);
    return result;

  } catch (error: any) {
    logStep('error', false, error.message);

    const errorResult: AxiosCheerioResult = {
      domain,
      method: 'axios_cheerio',
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
      renderRequired: false,
      javascriptErrors: JSON.stringify([]),
      extractionSteps: JSON.stringify(steps)
    };

    // Store error result in database
    await betaDb.insert(betaSmokeTests).values({
      domain: errorResult.domain,
      method: errorResult.method,
      processingTimeMs: errorResult.processingTimeMs,
      success: errorResult.success,
      error: errorResult.error,
      companyName: errorResult.companyName,
      companyConfidence: errorResult.companyConfidence,
      companyExtractionMethod: errorResult.companyExtractionMethod,
      detectedCountry: errorResult.detectedCountry,
      countryConfidence: errorResult.countryConfidence,
      geoMarkers: JSON.parse(errorResult.geoMarkers),
      termsUrl: errorResult.termsUrl,
      privacyUrl: errorResult.privacyUrl,
      legalUrls: JSON.parse(errorResult.legalUrls),
      legalContentExtracted: errorResult.legalContentExtracted,
      aboutUrl: errorResult.aboutUrl,
      aboutContent: errorResult.aboutContent,
      aboutExtractionSuccess: errorResult.aboutExtractionSuccess,
      socialMediaLinks: JSON.parse(errorResult.socialMediaLinks),
      socialMediaCount: errorResult.socialMediaCount,
      contactEmails: JSON.parse(errorResult.contactEmails),
      contactPhones: JSON.parse(errorResult.contactPhones),
      contactAddresses: JSON.parse(errorResult.contactAddresses),
      hasContactPage: errorResult.hasContactPage,
      rawHtmlSize: errorResult.rawHtmlSize,
      rawExtractionData: JSON.parse(errorResult.rawExtractionData),
      pageMetadata: JSON.parse(errorResult.pageMetadata),
      httpStatus: errorResult.httpStatus,
      renderRequired: errorResult.renderRequired,
      javascriptErrors: JSON.parse(errorResult.javascriptErrors),
      extractionSteps: JSON.parse(errorResult.extractionSteps)
    });

    console.error(`❌ Axios/Cheerio extraction failed for ${domain}: ${error.message}`);
    return errorResult;
  }
}
