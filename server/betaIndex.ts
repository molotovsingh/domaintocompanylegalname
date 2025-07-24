import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { betaDb } from './betaDb';
import { betaExperiments, betaSmokeTests } from '../shared/betaSchema';
import { eq, desc } from 'drizzle-orm';
import { PerplexityExtractor } from './betaServices/perplexityExtractor';
import { AxiosCheerioExtractor } from './betaServices/axiosCheerioExtractor';
import { gleifExtractor } from './betaServices/gleifExtractor';
import { PuppeteerExtractor } from './betaServices/puppeteerExtractor';
import { PlaywrightExtractor } from './betaServices/playwrightExtractor';
import betaV2Routes from './beta-v2/routes';

const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

// Simple cleanup function
async function quickCleanup() {
  console.log('🔄 Starting beta server...');
}

// Middleware
app.use(cors());
app.use(express.json());

// Mount Beta v2 routes
app.use('/api/beta-v2', betaV2Routes);

// Health check
app.get('/api/beta/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Beta Testing Platform',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Get beta experiments
app.get('/api/beta/experiments', async (req, res) => {
  try {
    const experiments = await betaDb.select().from(betaExperiments);
    res.json({ success: true, experiments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test GLEIF API connection
app.get('/api/beta/gleif-connection-test', async (req, res) => {
  try {
    console.log('[Beta] Testing GLEIF API connection...');

    const isConnected = await gleifExtractor.testGLEIFConnection();

    res.json({
      success: isConnected,
      message: isConnected ? 'GLEIF API connection successful' : 'GLEIF API connection failed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Beta] GLEIF connection test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GLEIF API status and debugging endpoint
app.get('/api/beta/gleif-debug', async (req, res) => {
  try {
    console.log('[Beta] [GLEIF-DEBUG] Starting comprehensive GLEIF API debug...');
    
    // Test basic connection
    const connectionTest = await gleifExtractor.testGLEIFConnection();
    
    // Test with a known working entity
    let appleTest = null;
    try {
      appleTest = await gleifExtractor.extractRawGleifData('apple');
    } catch (error: any) {
      appleTest = { success: false, error: error.message };
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        basicConnection: {
          success: connectionTest,
          description: 'Basic GLEIF API connectivity test'
        },
        appleSearch: {
          success: appleTest?.success || false,
          error: appleTest?.error || null,
          entityCount: appleTest?.totalRecords || 0,
          description: 'Test search for "apple" - should find Apple Inc.'
        }
      },
      gleifApiInfo: {
        baseUrl: 'https://api.gleif.org/api/v1',
        documentation: 'https://documenter.getpostman.com/view/7679680/SVYrrxuU',
        status: connectionTest ? 'Available' : 'Unavailable'
      },
      troubleshooting: {
        htmlErrors: 'If getting HTML errors, try simpler search terms',
        networkErrors: 'Check internet connection and firewall settings',
        noResults: 'Try partial company names (e.g., "apple" instead of "apple inc")'
      }
    });
    
  } catch (error: any) {
    console.error('[Beta] [GLEIF-DEBUG] Debug test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Raw GLEIF JSON extraction endpoint - COMPLETE DATA PASSTHROUGH (like Perplexity approach)
app.post('/api/beta/gleif-raw', async (req, res) => {
  try {
    const { domain, searchTerm, leiCode } = req.body;

    if (!domain && !searchTerm && !leiCode) {
      return res.status(400).json({
        success: false,
        error: 'Either domain, searchTerm, or leiCode is required'
      });
    }

    const queryTerm = searchTerm || domain || leiCode;
    console.log(`[Beta] [GLEIF-RAW-COMPLETE] Complete raw extraction for: ${queryTerm}`);

    // Enhanced error handling with specific HTML error detection
    const rawResult = await gleifExtractor.extractRawGleifData(queryTerm);

    // Check if the result indicates an HTML error
    if (!rawResult.success && rawResult.error) {
      console.error(`[Beta] [GLEIF-RAW-COMPLETE] GLEIF API Error:`, rawResult.error);
      
      // Determine error type
      const isHtmlError = rawResult.error.includes('HTML') || 
                         rawResult.error.includes('DOCTYPE') ||
                         rawResult.error.includes('invalid response format');
      
      return res.status(502).json({
        success: false,
        domain: domain || queryTerm,
        method: 'gleif_raw_complete_api',
        processingTime: rawResult.processingTime,
        error: isHtmlError ? 'GLEIF API returned invalid HTML response instead of JSON' : rawResult.error,
        errorCode: isHtmlError ? 'API_HTML_ERROR' : 'API_ERROR',
        extractionMethod: 'gleif_complete_raw_json',
        rawApiResponse: null,
        fullGleifResponse: null,
        completeRawData: null,
        unprocessedEntities: null,
        httpHeaders: null,
        metaData: null,
        totalRecords: 0,
        entityCount: 0,
        technicalDetails: {
          apiUrl: 'https://api.gleif.org/api/v1',
          errorType: isHtmlError ? 'HTML_RESPONSE' : 'API_ERROR',
          troubleshooting: isHtmlError ? 
            'GLEIF API returned HTML error page instead of JSON. Try simplifying search term.' : 
            'General API error occurred.'
        }
      });
    }

    console.log(`[Beta] [GLEIF-RAW-COMPLETE] Raw result:`, {
      success: rawResult.success,
      entityCount: rawResult.totalRecords || 0,
      processingTime: rawResult.processingTime,
      responseSize: rawResult.responseSize,
      hasMetaData: !!rawResult.metaData,
      hasLinks: !!rawResult.includesLinks,
      gleifApiVersion: rawResult.gleifApiVersion
    });

    // Return successful response
    res.json({
      success: rawResult.success,
      domain: domain || queryTerm,
      method: 'gleif_raw_complete_api',
      processingTime: rawResult.processingTime,
      error: null,
      errorCode: null,
      extractionMethod: 'gleif_complete_raw_json',
      rawApiResponse: rawResult.rawApiResponse,
      fullGleifResponse: rawResult.fullGleifResponse,
      completeRawData: rawResult.completeRawData,
      unprocessedEntities: rawResult.unprocessedEntities,
      httpHeaders: rawResult.httpHeaders,
      metaData: rawResult.metaData,
      paginationInfo: rawResult.paginationInfo,
      includesLinks: rawResult.includesLinks,
      requestDetails: rawResult.requestDetails,
      totalRecords: rawResult.totalRecords || 0,
      entityCount: rawResult.totalRecords || 0,
      gleifApiVersion: rawResult.gleifApiVersion,
      responseSize: rawResult.responseSize,
      technicalDetails: {
        apiUrl: 'https://api.gleif.org/api/v1',
        searchType: rawResult.requestDetails?.fuzzySearch ? 'fuzzy' : 'exact',
        responseSize: rawResult.responseSize,
        gleifApiVersion: rawResult.gleifApiVersion,
        captureMethod: 'complete_passthrough',
        dataIntegrity: 'unmodified',
        includedSections: {
          data: !!rawResult.rawApiResponse?.data,
          meta: !!rawResult.metaData,
          links: !!rawResult.includesLinks,
          included: !!rawResult.rawApiResponse?.included,
          httpHeaders: !!rawResult.httpHeaders
        }
      }
    });

  } catch (error: any) {
    console.error(`[Beta] [GLEIF-RAW-COMPLETE] Unexpected Error:`, error.message);
    console.error(`[Beta] [GLEIF-RAW-COMPLETE] Error stack:`, error.stack);

    // Enhanced error categorization
    const isHtmlError = error.message.includes('HTML') || 
                       error.message.includes('DOCTYPE') ||
                       error.message.includes('Unexpected token');
    
    const isNetworkError = error.message.includes('ENOTFOUND') ||
                          error.message.includes('ECONNREFUSED') ||
                          error.message.includes('timeout');

    res.status(500).json({
      success: false,
      domain: req.body.domain || 'N/A',
      method: 'gleif_raw_complete_api',
      processingTime: 0,
      error: isHtmlError ? 'GLEIF API returned HTML instead of JSON - API may be temporarily unavailable' :
             isNetworkError ? 'Network error connecting to GLEIF API' :
             error.message,
      errorCode: isHtmlError ? 'HTML_PARSE_ERROR' : 
                isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
      extractionMethod: null,
      rawApiResponse: null,
      fullGleifResponse: null,
      completeRawData: null,
      unprocessedEntities: null,
      httpHeaders: null,
      metaData: null,
      totalRecords: 0,
      entityCount: 0,
      technicalDetails: {
        errorType: isHtmlError ? 'HTML_RESPONSE' : isNetworkError ? 'NETWORK' : 'UNKNOWN',
        troubleshooting: isHtmlError ? 
          'Try: 1) Use simpler search terms, 2) Check GLEIF API status, 3) Retry in a few minutes' :
          isNetworkError ?
          'Check internet connection and GLEIF API availability' :
          'Unexpected error occurred'
      }
    });
  }
});

// Test GLEIF API extraction endpoint
app.post('/api/beta/gleif-test', async (req, res) => {
  try {
    const { domain, searchTerm, leiCode, includeRawData } = req.body;

    if (!domain && !searchTerm && !leiCode) {
      return res.status(400).json({
        success: false,
        error: 'Either domain, searchTerm, or leiCode is required'
      });
    }

    const queryTerm = searchTerm || domain || leiCode;
    console.log(`[Beta] [GLEIF] Starting extraction for: ${queryTerm} (includeRaw: ${includeRawData})`);

    let result;
    if (leiCode && leiCode.length === 20) {
      result = await gleifExtractor.searchByLEI(leiCode);
    } else {
      result = await gleifExtractor.extractCompanyInfo(queryTerm, includeRawData);
    }

    console.log(`[Beta] [GLEIF] Result for ${searchTerm || `LEI: ${leiCode}`} (from domain: ${domain || 'N/A'})...`);

    console.log(`[Beta] [GLEIF] Result for ${searchTerm || leiCode}:`, {
      companyName: result.companyName,
      leiCode: result.leiCode,
      confidence: result.confidence,
      sources: result.sources.length
    });

    // Format response to match expected structure
    const confidenceValue = result.confidence === 'high' ? 95 : 
                           result.confidence === 'medium' ? 75 : 45;

    res.json({
      success: true,
      domain: domain || searchTerm || 'N/A',
      method: 'gleif_api',
      processingTime: Date.now(),
      companyName: result.companyName,
      legalEntityType: result.legalEntityType,
      country: result.country,
      confidence: confidenceValue,
      error: null,
      errorCode: null,
      extractionMethod: 'gleif_enhanced',
      technicalDetails: {
        leiCode: result.leiCode,
        entityStatus: result.entityStatus,
        registrationStatus: result.registrationStatus,
        jurisdiction: result.jurisdiction
      },
      sources: result.sources || [],
      llmResponse: null
    });

  } catch (error: any) {
    console.error(`[Beta] [GLEIF] Error:`, error.message);

    // Enhanced error categorization
    const isHtmlError = error.message.includes('HTML') || 
                       error.message.includes('DOCTYPE') ||
                       error.message.includes('Unexpected token');
    
    const isNetworkError = error.message.includes('ENOTFOUND') ||
                          error.message.includes('ECONNREFUSED') ||
                          error.message.includes('timeout');

    // Enhanced error response matching expected format
    res.status(500).json({
      success: false,
      domain: req.body.domain || 'N/A',
      method: 'gleif_api',
      processingTime: Date.now(),
      companyName: null,
      legalEntityType: null,
      country: null,
      confidence: 0,
      error: isHtmlError ? 'GLEIF API returned HTML instead of JSON - API may be temporarily unavailable' :
             isNetworkError ? 'Network error connecting to GLEIF API' :
             error.message,
      errorCode: isHtmlError ? 'HTML_PARSE_ERROR' : 
                isNetworkError ? 'NETWORK_ERROR' : 'API_ERROR',
      extractionMethod: null,
      technicalDetails: {
        errorType: isHtmlError ? 'HTML_RESPONSE' : isNetworkError ? 'NETWORK' : 'UNKNOWN',
        troubleshooting: isHtmlError ? 
          'Try simpler search terms or check GLEIF API status' :
          isNetworkError ?
          'Check internet connection and GLEIF API availability' :
          'General API error occurred'
      },
      sources: [],
      llmResponse: null
    });
  }
});

// Comprehensive GLEIF entity analysis endpoint (inspired by tested Python code)
app.post('/api/beta/gleif-analysis', async (req, res) => {
  try {
    const { searchTerm, isLEI } = req.body;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'searchTerm is required'
      });
    }

    console.log(`[Beta] [GLEIF] Comprehensive analysis for: ${searchTerm} (isLEI: ${isLEI || false})`);

    const analysis = await gleifExtractor.analyzeEntity(searchTerm, isLEI || false);

    console.log(`[Beta] [GLEIF] Analysis complete:`, {
      found: analysis.found,
      totalEntities: analysis.totalEntities || 0,
      searchTerm: analysis.searchTerm
    });

    res.json({
      success: true,
      data: analysis,
      method: 'gleif_comprehensive_analysis',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[Beta] [GLEIF] Analysis error:`, error.message);
    res.status(500).json({
      success: false,
      error: 'GLEIF comprehensive analysis failed',
      details: error.message
    });
  }
});

// Interactive company search endpoint (inspired by tested Python code)
app.post('/api/beta/interactive-search', async (req, res) => {
  try {
    const { companyName } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        error: 'companyName is required'
      });
    }

    console.log(`[Beta] [Interactive] Starting enhanced search for: ${companyName}`);

    // Perform comprehensive GLEIF search with detailed logging
    const result = await gleifExtractor.extractCompanyInfo(companyName);

    // Enhanced response with detailed analysis
    const response = {
      success: true,
      searchTerm: companyName,
      result: {
        companyName: result.companyName,
        leiCode: result.leiCode,
        entityStatus: result.entityStatus,
        registrationStatus: result.registrationStatus,
        jurisdiction: result.jurisdiction,
        legalForm: result.legalForm,
        confidence: result.confidence,
        addresses: result.addresses,
        otherNames: result.otherNames,
        registrationDate: result.registrationDate,
        lastUpdateDate: result.lastUpdateDate
      },
      sources: result.sources,
      timestamp: new Date().toISOString(),
      interactiveAnalysis: true
    };

    console.log(`[Beta] [Interactive] Search complete for ${companyName}:`, {
      found: !!result.leiCode,
      confidence: result.confidence,
      entityStatus: result.entityStatus
    });

    res.json(response);

  } catch (error: any) {
    console.error(`[Beta] [Interactive] Search failed:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Interactive search failed',
      details: error.message
    });
  }
});

// Enhanced smoke test endpoint with comprehensive error handling
app.post('/api/beta/smoke-test', async (req, res) => {
  const { domain, method } = req.body;

  if (!domain || !method) {
    return res.status(400).json({ error: 'Domain and method are required' });
  }

  try {
    let result: any = null;

    if (method === 'perplexity_llm') {
      const extractor = new PerplexityExtractor();
      console.log(`[Beta] Testing ${domain} with Perplexity LLM...`);
      result = await extractor.extractFromDomain(domain);
    } else if (method === 'axios_cheerio') {
      const extractor = new AxiosCheerioExtractor();
      console.log(`[Beta] Testing ${domain} with Axios/Cheerio...`);
      result = await extractor.extractFromDomain(domain);
    } else if (method === 'puppeteer') {
      const extractor = new PuppeteerExtractor();
      console.log(`[Beta] Testing ${domain} with Puppeteer...`);
      result = await extractor.extractFromDomain(domain);
      await extractor.close();
    } else if (method === 'playwright') {
      const extractor = new PlaywrightExtractor();
      console.log(`[Beta] Testing ${domain} with Playwright...`);
      result = await extractor.extractFromDomain(domain);
      await extractor.close();
    } else {
      return res.status(400).json({ error: 'Invalid method. Supported methods: perplexity_llm, axios_cheerio, puppeteer, playwright' });
    }

    // Store in beta database with experiment ID
    const dbResult = await betaDb.insert(betaSmokeTests).values({
      domain,
      method,
      experimentId: 1, // Smoke testing experiment
      ...result
    }).returning();

    // Include test ID and confidence in the response
    const responseData = {
      ...result,
      confidence: result.confidence || 0,
      testId: dbResult[0].id // Include the test ID
    };

    res.json({ success: true, data: responseData });

  } catch (error: any) {
    console.error('[Beta] Error in smoke test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get beta smoke test results
app.get('/api/beta/smoke-test/results', async (req, res) => {
  try {
    const results = await betaDb.select()
      .from(betaSmokeTests)
      .orderBy(desc(betaSmokeTests.createdAt))
      .limit(50);

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get raw extraction data by test ID
app.get('/api/beta/raw-data/:testId', async (req, res) => {
  const { testId } = req.params;
  
  try {
    const result = await betaDb.select()
      .from(betaSmokeTests)
      .where(eq(betaSmokeTests.id, parseInt(testId)))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Test not found' });
    }
    
    const test = result[0];
    
    // Return the raw extraction data
    res.json({ 
      success: true, 
      data: {
        testId: test.id,
        domain: test.domain,
        method: test.method,
        createdAt: test.createdAt,
        rawExtractionData: test.rawExtractionData || null,
        companyName: test.companyName,
        confidence: test.companyConfidence,
        extractionMethod: test.companyExtractionMethod,
        processingTimeMs: test.processingTimeMs,
        success: test.success,
        error: test.error
      }
    });
  } catch (error: any) {
    console.error('[Beta] Error fetching raw data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize beta experiments
async function initializeBetaExperiments() {
  try {
    // Check if smoke testing experiment exists
    const existing = await betaDb.select()
      .from(betaExperiments)
      .where(eq(betaExperiments.name, 'Smoke Testing'));

    if (existing.length === 0) {
      await betaDb.insert(betaExperiments).values({
        name: 'Smoke Testing',
        description: 'Compare extraction performance across different scraping libraries',
        status: 'beta',
        createdBy: 'system'
      });
      console.log('✅ Initialized Smoke Testing experiment');
    }
  } catch (error) {
    console.error('Failed to initialize beta experiments:', error);
  }
}

// Start the server directly
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🧪 Beta Testing Platform running on port ${PORT}`);
  console.log(`🔬 Complete database isolation from production`);
  console.log(`🚀 Ready for experimental features`);
  console.log(`🌐 Accessible at http://0.0.0.0:${PORT}`);

  try {
    // Test database connection first
    console.log('🔍 Testing beta database connection...');
    await betaDb.execute('SELECT 1 as test');
    console.log('✅ Beta database connection successful');

    // Initialize experiments
    await initializeBetaExperiments();
    console.log(`✅ Beta server fully initialized and ready`);
    console.log(`🎯 Health check available at: http://0.0.0.0:${PORT}/api/beta/health`);

    // Send ready signal to parent process if running from main server
    if (process.send) {
      process.send('ready');
    }
  } catch (error) {
    console.error('❌ Failed to initialize beta experiments:', error);
    console.error('💥 Error details:', error);
    process.exit(1);
  }
});

// Handle server startup errors
server.on('error', (error: any) => {
  console.error('❌ Beta server startup error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`💥 Port ${PORT} is already in use`);
    console.log('🔧 Try killing any existing beta processes first');
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Beta server shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Beta server interrupted, shutting down...');
  process.exit(0);
});