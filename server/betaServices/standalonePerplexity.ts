
import { PerplexityExtractor } from './perplexityExtractor';
import { betaDb } from '../betaDb';
import { betaSmokeTests } from '../../shared/betaSchema';

interface PerplexityResult {
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

export async function runPerplexityExtraction(domain: string): Promise<PerplexityResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting Perplexity extraction for ${domain}`);
    const extractor = new PerplexityExtractor();
    
    const rawResult = await extractor.extractFromDomain(domain, true);
    
    // Convert Perplexity result to beta schema format
    const result: PerplexityResult = {
      domain,
      method: 'perplexity_llm',
      processingTimeMs: rawResult.processingTime,
      success: rawResult.success,
      error: rawResult.error,
      companyName: rawResult.companyName,
      companyConfidence: rawResult.confidence,
      companyExtractionMethod: rawResult.extractionMethod,
      detectedCountry: rawResult.country,
      countryConfidence: rawResult.country ? 80 : 0, // Perplexity doesn't provide country confidence
      geoMarkers: JSON.stringify({
        addresses: [],
        phones: [],
        currencies: [],
        languages: [],
        postalCodes: []
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
      rawExtractionData: JSON.stringify({
        llmResponse: rawResult.llmResponse,
        sources: rawResult.sources,
        legalEntityType: rawResult.legalEntityType,
        technicalDetails: rawResult.technicalDetails
      }),
      pageMetadata: JSON.stringify({
        title: rawResult.companyName || domain,
        charset: 'utf-8',
        htmlLang: 'en'
      }),
      httpStatus: 200, // Perplexity doesn't provide HTTP status
      renderRequired: false,
      javascriptErrors: JSON.stringify([]),
      extractionSteps: JSON.stringify([
        {
          step: 'llm_analysis',
          success: rawResult.success,
          details: `Perplexity LLM extraction: ${rawResult.companyName || 'no company found'}`,
          timestamp: Date.now()
        }
      ])
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

    console.log(`✅ Perplexity extraction completed for ${domain}: ${result.companyName || 'no company found'}`);
    return result;

  } catch (error: any) {
    const errorResult: PerplexityResult = {
      domain,
      method: 'perplexity_llm',
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
      extractionSteps: JSON.stringify([
        {
          step: 'error',
          success: false,
          details: error.message,
          timestamp: Date.now()
        }
      ])
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

    console.error(`❌ Perplexity extraction failed for ${domain}: ${error.message}`);
    return errorResult;
  }
}
