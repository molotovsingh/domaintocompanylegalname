import { PuppeteerExtractor } from './puppeteerExtractor';

interface PuppeteerResult {
  success: boolean;
  error: string | null;
  companyName: string | null;
  companyConfidence: number;
  companyExtractionMethod: string | null;
  processingTimeMs: number;
  extractionSteps: string;
}

export async function runPuppeteerExtraction(domain: string): Promise<PuppeteerResult> {
  const startTime = Date.now();
  let extractor: PuppeteerExtractor | null = null;

  try {
    console.log(`[Beta] [Puppeteer] Starting fresh extraction for ${domain}`);

    extractor = new PuppeteerExtractor();

    // Initialize browser
    console.log(`[Beta] [Puppeteer] Initializing browser...`);
    await extractor.initialize();

    // Extract data
    console.log(`[Beta] [Puppeteer] Extracting data from ${domain}...`);
    const result = await extractor.extractFromDomain(domain);

    console.log(`[Beta] [Puppeteer] Extraction completed for ${domain} in ${result.processingTimeMs}ms`);

    return {
      success: result.success,
      error: result.error,
      companyName: result.companyName,
      companyConfidence: result.companyConfidence,
      companyExtractionMethod: result.companyExtractionMethod,
      processingTimeMs: result.processingTimeMs,
      extractionSteps: result.extractionSteps
    };

  } catch (error: any) {
    console.error(`[Beta] [Puppeteer] Fatal error for ${domain}:`, error.message);

    return {
      success: false,
      error: error.message,
      companyName: null,
      companyConfidence: 0,
      companyExtractionMethod: null,
      processingTimeMs: Date.now() - startTime,
      extractionSteps: JSON.stringify([{
        step: 'fatal_error',
        success: false,
        details: error.message,
        timestamp: Date.now()
      }])
    };
  } finally {
    // Always cleanup
    if (extractor) {
      try {
        await extractor.cleanup();
        console.log(`[Beta] [Puppeteer] Browser cleaned up for ${domain}`);
      } catch (cleanupError) {
        console.error(`[Beta] [Puppeteer] Cleanup error for ${domain}:`, cleanupError);
      }
    }
  }
}