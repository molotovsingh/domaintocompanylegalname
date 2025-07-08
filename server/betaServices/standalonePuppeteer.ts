
import { PuppeteerExtractor } from './puppeteerExtractor';
import { betaDb } from '../betaDb';
import { betaSmokeTests } from '../../shared/betaSchema';

interface PuppeteerResult {
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
  rawExtractionData: string | null;
  pageMetadata: string | null;
  httpStatus: number;
  renderRequired: boolean;
  javascriptErrors: string;
  extractionSteps: string;
}

export async function runPuppeteerExtraction(domain: string): Promise<PuppeteerResult> {
  const startTime = Date.now();
  const extractor = new PuppeteerExtractor();

  try {
    console.log(`🚀 Starting Puppeteer extraction for ${domain}`);
    await extractor.initialize();
    
    const rawResult = await extractor.extractFromDomain(domain);
    
    // Convert the raw result to our expected format
    const result: PuppeteerResult = {
      domain,
      method: 'puppeteer',
      processingTimeMs: rawResult.processingTimeMs,
      success: rawResult.success,
      error: rawResult.error,
      companyName: rawResult.companyName,
      companyConfidence: rawResult.companyConfidence,
      companyExtractionMethod: rawResult.companyExtractionMethod,
      detectedCountry: rawResult.detectedCountry,
      countryConfidence: rawResult.countryConfidence,
      geoMarkers: rawResult.geoMarkers,
      termsUrl: rawResult.termsUrl,
      privacyUrl: rawResult.privacyUrl,
      legalUrls: rawResult.legalUrls,
      legalContentExtracted: rawResult.legalContentExtracted,
      aboutUrl: rawResult.aboutUrl,
      aboutContent: rawResult.aboutContent,
      aboutExtractionSuccess: rawResult.aboutExtractionSuccess,
      socialMediaLinks: rawResult.socialMediaLinks,
      socialMediaCount: rawResult.socialMediaCount,
      contactEmails: rawResult.contactEmails,
      contactPhones: rawResult.contactPhones,
      contactAddresses: rawResult.contactAddresses,
      hasContactPage: rawResult.hasContactPage,
      rawHtmlSize: rawResult.rawHtmlSize,
      rawExtractionData: rawResult.rawExtractionData,
      pageMetadata: rawResult.pageMetadata,
      httpStatus: rawResult.httpStatus,
      renderRequired: rawResult.renderRequired,
      javascriptErrors: rawResult.javascriptErrors,
      extractionSteps: rawResult.extractionSteps
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
      rawExtractionData: result.rawExtractionData ? JSON.parse(result.rawExtractionData) : null,
      pageMetadata: result.pageMetadata ? JSON.parse(result.pageMetadata) : null,
      httpStatus: result.httpStatus,
      renderRequired: result.renderRequired,
      javascriptErrors: JSON.parse(result.javascriptErrors),
      extractionSteps: JSON.parse(result.extractionSteps)
    });

    console.log(`✅ Puppeteer extraction completed for ${domain}: ${result.companyName || 'no company found'}`);
    return result;

  } catch (error: any) {
    const errorResult: PuppeteerResult = {
      domain,
      method: 'puppeteer',
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
      extractionSteps: JSON.stringify([{ step: 'error', success: false, details: error.message, timestamp: Date.now() }])
    };

    // Store error result
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

    console.error(`❌ Puppeteer extraction failed for ${domain}: ${error.message}`);
    return errorResult;
  } finally {
    await extractor.cleanup();
  }
}
