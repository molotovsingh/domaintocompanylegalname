import { Router } from 'express';
import { GleifClaimsService } from './gleifClaimsService';
import { CleaningService } from '../cleaning/cleaningService';
import { ProcessingPipelineService } from '../processing/processingPipelineService';
import { executeBetaV2Query } from '../database';

const router = Router();
const gleifClaimsService = new GleifClaimsService();
const processingPipelineService = new ProcessingPipelineService();
let cleaningService: CleaningService;

try {
  cleaningService = new CleaningService();
} catch (error) {
  console.error('[Beta] [GleifClaimsRoutes] Error initializing CleaningService:', error);
  throw error;
}

// Helper functions for extracting data from raw content
function extractTitle(content: any): string {
  // Extract from scrapy/crawlee format
  if (content?.pages?.[0]?.title) {
    return content.pages[0].title;
  }
  
  // Handle old crawlee dumps with only HTML in pages array
  if (content?.pages?.[0]?.html && !content.pages[0].title) {
    const htmlContent = content.pages[0].html;
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
    }
  }
  
  // Extract from HTML string
  if (typeof content === 'string') {
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : '';
  }
  
  return '';
}

function extractMetaTags(content: any): Record<string, string> {
  const metaTags: Record<string, string> = {};
  
  // Extract from structured data
  if (content?.pages?.[0]?.metaTags) {
    return content.pages[0].metaTags;
  }
  
  // Handle old crawlee dumps with only HTML in pages array
  if (content?.pages?.[0]?.html && !content.pages[0].metaTags) {
    const htmlContent = content.pages[0].html;
    // Match both name and property attributes, and handle escaped quotes
    const metaRegex = /<meta\s+(?:name|property)=(?:["']([^"']+)["'])\s+content=(?:["']([^"']+)["'])/gi;
    let match;
    while ((match = metaRegex.exec(htmlContent)) !== null) {
      const name = match[1];
      const content = match[2]
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&#x27;/g, "'")
        .replace(/&#xfc;/g, 'ü')
        .replace(/&#x2713;/g, '✓')
        .replace(/&#x27a4;/g, '➤');
      metaTags[name] = content;
    }
  }
  
  // Extract from HTML string
  if (typeof content === 'string') {
    const metaRegex = /<meta\s+(?:name|property)=["']([^"']+)["']\s+content=["']([^"']+)["']/gi;
    let match;
    while ((match = metaRegex.exec(content)) !== null) {
      metaTags[match[1]] = match[2];
    }
  }
  
  return metaTags;
}

function extractStructuredData(content: any): any {
  // Extract from scrapy/crawlee format
  if (content?.pages?.[0]?.structuredData) {
    return content.pages[0].structuredData;
  }
  
  // Extract JSON-LD from HTML
  if (typeof content === 'string') {
    const jsonLdMatch = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i);
    if (jsonLdMatch) {
      try {
        return JSON.parse(jsonLdMatch[1]);
      } catch (e) {
        // Invalid JSON
      }
    }
  }
  
  return null;
}

function extractTextContent(content: any): string {
  // Extract from scrapy/crawlee format with text field
  if (content?.pages) {
    return content.pages.map((page: any) => {
      if (page.text) {
        return page.text;
      }
      // Handle old crawlee dumps - extract text from HTML
      if (page.html) {
        return page.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      return '';
    }).join('\n\n');
  }
  
  // Extract from HTML by removing tags
  if (typeof content === 'string') {
    return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  return '';
}

/**
 * Generate GLEIF claims from a specific dump
 */
router.post('/generate-claims', async (req, res) => {
  console.log('[Beta] [GleifClaimsRoutes] Generating claims from dump', req.body);
  
  // Set JSON content type explicitly
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { domain, dumpId, collectionType } = req.body;

    if (!domain || !dumpId || !collectionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: domain, dumpId, collectionType'
      });
    }

    // Step 1: Get the dump
    console.log(`[Beta] [GleifClaimsRoutes] Fetching ${collectionType} dump: ${dumpId}`);
    const dumps = await cleaningService.getAvailableDumps();
    const dump = dumps.find(d => d.id === parseInt(dumpId) && d.type === collectionType);

    if (!dump) {
      return res.status(404).json({
        success: false,
        error: 'Dump not found'
      });
    }

    // Step 2: Get raw dump data
    console.log('[Beta] [GleifClaimsRoutes] Getting raw dump content');
    const rawData = await cleaningService.getRawData(collectionType, parseInt(dumpId));
    
    if (!rawData) {
      return res.status(404).json({
        success: false,
        error: 'Failed to retrieve dump content'
      });
    }
    
    // Debug: Log raw data structure
    console.log('[Beta] [GleifClaimsRoutes] Raw data structure:', {
      domain: rawData.domain,
      contentType: typeof rawData.content,
      hasContent: !!rawData.content,
      contentKeys: rawData.content && typeof rawData.content === 'object' ? Object.keys(rawData.content) : [],
      contentSample: typeof rawData.content === 'string' ? 
        rawData.content.substring(0, 200) : 
        JSON.stringify(rawData.content).substring(0, 200)
    });
    
    // Pre-check: Extract and log what data we have BEFORE cleaning
    console.log('[Beta] [GleifClaimsRoutes] PRE-CHECK - Available data before extraction:');
    
    // Check for different dump types
    if (collectionType === 'crawlee_dump' && rawData.content?.pages) {
      console.log('  - Crawlee dump with pages:', rawData.content.pages.length);
      const firstPage = rawData.content.pages[0];
      if (firstPage) {
        console.log('  - First page has:', {
          title: firstPage.title || 'NO TITLE',
          metaTags: firstPage.metaTags ? Object.keys(firstPage.metaTags).length + ' tags' : 'NO META TAGS',
          structuredData: firstPage.structuredData ? 'YES' : 'NO',
          textLength: firstPage.text ? firstPage.text.length : 0
        });
      }
    } else if (collectionType === 'axios_cheerio_dump') {
      console.log('  - Axios+Cheerio dump');
      console.log('  - Raw HTML length:', rawData.content?.length || 0);
      console.log('  - Metadata:', {
        metaTags: rawData.metadata?.meta_tags ? Object.keys(rawData.metadata.meta_tags).length + ' tags' : 'NO META TAGS',
        pageMetadata: rawData.metadata?.page_metadata ? 'YES' : 'NO'
      });
      if (rawData.metadata?.meta_tags) {
        console.log('  - Sample meta tags:', Object.entries(rawData.metadata.meta_tags).slice(0, 3));
      }
    }
    
    // Check if we have LLM-cleaned data from the latest cleaning results
    let llmCleanedData = null;
    
    console.log('[Beta] [GleifClaimsRoutes] About to query processing_results table');
    
    // First try to get processing results from the processing_results table
    try {
      console.log('[Beta] [GleifClaimsRoutes] Querying processing_results for:', {
        collectionType,
        dumpId: parseInt(dumpId)
      });
      
      // Query the processing_results table directly for this dump
      const processingResult = await executeBetaV2Query(
        `SELECT * FROM processing_results 
         WHERE source_type = $1 AND source_id = $2 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [collectionType, parseInt(dumpId)]
      );
      
      console.log('[Beta] [GleifClaimsRoutes] Query result:', {
        hasResult: !!processingResult,
        length: processingResult?.length,
        firstResult: processingResult?.[0] ? {
          id: processingResult[0].id,
          stage3_entity_name: processingResult[0].stage3_entity_name,
          stage3EntityName: processingResult[0].stage3EntityName
        } : null
      });
      
      // executeBetaV2Query returns an array directly
      if (processingResult && processingResult.length > 0) {
        const result = processingResult[0];
        
        // Extract entity data from the processing pipeline results
        llmCleanedData = {
          primaryEntityName: result.stage3_entity_name || null,
          baseEntityName: result.stage3_entity_name || null,
          companyName: result.stage2_extracted_data?.companyName || null,
          entityCandidates: result.stage3_alternative_names || [],
          addresses: result.stage2_extracted_data?.addresses || [],
          emails: result.stage2_extracted_data?.emails || [],
          phones: result.stage2_extracted_data?.phones || [],
          excludeTerms: []
        };
        
        console.log('[Beta] [GleifClaimsRoutes] Found processing result with entity:', {
          primaryEntityName: llmCleanedData.primaryEntityName,
          companyName: llmCleanedData.companyName,
          confidence: result.stage3_entity_confidence
        });
      }
    } catch (error) {
      console.error('[Beta] [GleifClaimsRoutes] ERROR fetching processing results:', {
        error: error.message,
        stack: error.stack,
        collectionType,
        dumpId
      });
    }
    
    // Fallback to cleaning service results if no processing results found
    if (!llmCleanedData) {
      try {
        const cleaningResults = await cleaningService.getCleaningResults(collectionType, parseInt(dumpId));
        if (cleaningResults && cleaningResults.length > 0) {
          // Get the most recent result
          const latestResult = cleaningResults[cleaningResults.length - 1];
          llmCleanedData = latestResult.extractedData;
          console.log('[Beta] [GleifClaimsRoutes] Found latest cleaning result with entity data:', {
            primaryEntityName: llmCleanedData?.primaryEntityName,
            baseEntityName: llmCleanedData?.baseEntityName,
            entityCandidatesCount: llmCleanedData?.entityCandidates?.length || 0,
            excludeTermsCount: llmCleanedData?.excludeTerms?.length || 0
          });
        }
      } catch (error) {
        console.log('[Beta] [GleifClaimsRoutes] Could not fetch latest cleaning results:', error);
      }
    }
    
    // Fallback to old cleanedPages if no new results found
    if (!llmCleanedData && rawData.content?.cleanedPages && rawData.content.cleanedPages.length > 0) {
      llmCleanedData = rawData.content.cleanedPages[0];
      console.log('[Beta] [GleifClaimsRoutes] Falling back to old cleanedPages data');
    }
    
    // Combine raw extracted data with LLM-cleaned data
    const cleanedContent = {
      domain: rawData.domain,
      title: extractTitle(rawData.content),
      metaTags: extractMetaTags(rawData.content),
      structuredData: extractStructuredData(rawData.content),
      extractedText: extractTextContent(rawData.content),
      // Add new entity-focused fields if available
      primaryEntityName: llmCleanedData?.primaryEntityName || null,
      baseEntityName: llmCleanedData?.baseEntityName || null,
      entityCandidates: llmCleanedData?.entityCandidates || [],
      nameVariations: llmCleanedData?.nameVariations || [],
      excludeTerms: llmCleanedData?.excludeTerms || [],
      // Legacy company name field for backwards compatibility
      companyName: llmCleanedData?.companyName || null,
      // Include other LLM-extracted fields for future use
      addresses: llmCleanedData?.addresses || [],
      emails: llmCleanedData?.emails || [],
      phones: llmCleanedData?.phones || []
    };

    // Debug logging
    console.log('[Beta] [GleifClaimsRoutes] Cleaned content:', {
      domain: cleanedContent.domain,
      hasTitle: !!cleanedContent.title,
      title: cleanedContent.title?.substring(0, 100),
      hasMetaTags: !!cleanedContent.metaTags && Object.keys(cleanedContent.metaTags).length > 0,
      metaTagKeys: cleanedContent.metaTags ? Object.keys(cleanedContent.metaTags) : [],
      hasStructuredData: !!cleanedContent.structuredData,
      hasExtractedText: !!cleanedContent.extractedText,
      extractedTextLength: cleanedContent.extractedText?.length || 0,
      extractedTextSample: cleanedContent.extractedText?.substring(0, 200)
    });

    // Step 3: Generate GLEIF claims
    console.log('[Beta] [GleifClaimsRoutes] Generating GLEIF claims');
    const claims = await gleifClaimsService.generateClaims(domain, cleanedContent);

    console.log(`[Beta] [GleifClaimsRoutes] Generated ${claims.entityClaims.length} claims in ${claims.processingTime}ms`);
    
    const response = {
      success: true,
      claims: claims.entityClaims,
      processingTime: claims.processingTime
    };
    
    console.log('[Beta] [GleifClaimsRoutes] Sending response:', JSON.stringify(response, null, 2));
    
    res.json(response);

  } catch (error) {
    console.error('[Beta] [GleifClaimsRoutes] Error generating claims:', error);
    console.error('[Beta] [GleifClaimsRoutes] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Always return JSON, never let Express return HTML error pages
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate claims',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
});

/**
 * Process batch of domains for GLEIF claims
 */
router.post('/process-batch', async (req, res) => {
  console.log('[Beta] [GleifClaimsRoutes] Processing batch for GLEIF claims');
  
  try {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid domains array'
      });
    }

    const batchId = `gleif-claims-${Date.now()}`;
    const results = [];

    // Process each domain
    for (const domain of domains) {
      try {
        // Find best available dump for domain
        const dumps = await cleaningService.getAvailableDumps();
        const domainDumps = dumps.filter(d => d.domain === domain);
        
        if (domainDumps.length === 0) {
          results.push({
            domain,
            success: false,
            error: 'No dumps available for domain'
          });
          continue;
        }

        // Use the most recent dump
        const dump = domainDumps[0];
        
        // Get raw data and extract content
        const rawData = await cleaningService.getRawData(dump.type, dump.id);
        
        if (!rawData) {
          results.push({
            domain,
            success: false,
            error: 'Failed to retrieve dump content'
          });
          continue;
        }
        
        const cleanedContent = {
          domain: rawData.domain,
          title: extractTitle(rawData.content),
          metaTags: extractMetaTags(rawData.content),
          structuredData: extractStructuredData(rawData.content),
          extractedText: extractTextContent(rawData.content)
        };
        
        const claims = await gleifClaimsService.generateClaims(domain, cleanedContent);
        
        results.push({
          domain,
          success: true,
          claims: claims.entityClaims,
          claimCount: claims.entityClaims.length,
          processingTime: claims.processingTime
        });

      } catch (error) {
        console.error(`[Beta] [GleifClaimsRoutes] Error processing ${domain}:`, error);
        results.push({
          domain,
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        });
      }
    }

    res.json({
      success: true,
      batchId,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      results
    });

  } catch (error) {
    console.error('[Beta] [GleifClaimsRoutes] Batch processing error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Batch processing failed'
    });
  }
});

/**
 * Get GLEIF entity details with relationships
 */
router.get('/entity/:leiCode', async (req, res) => {
  console.log('[Beta] [GleifClaimsRoutes] Getting entity details');
  
  try {
    const { leiCode } = req.params;

    // This would query the gleifEntities and entityRelationships tables
    // For now, returning a placeholder response
    res.json({
      success: true,
      message: 'Entity lookup not yet implemented',
      leiCode
    });

  } catch (error) {
    console.error('[Beta] [GleifClaimsRoutes] Entity lookup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Entity lookup failed'
    });
  }
});

/**
 * Pre-check endpoint to verify data availability
 */
router.post('/pre-check', async (req, res) => {
  try {
    const { domain, dumpId, collectionType } = req.body;
    
    console.log('[Beta] [GleifClaimsRoutes] Pre-check request:', { domain, dumpId, collectionType });
    
    // Validate input
    if (!domain || !dumpId || !collectionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: domain, dumpId, and collectionType'
      });
    }
    
    // Get raw data from cleaning service
    const cleaningService = new CleaningService();
    const rawData = await cleaningService.getRawData(collectionType, parseInt(dumpId));
    
    if (!rawData) {
      return res.status(404).json({
        success: false,
        error: 'No data found for the specified dump'
      });
    }
    
    // Debug log the raw data structure
    console.log('[Beta] [GleifClaimsRoutes] Pre-check raw data:', {
      hasContent: !!rawData.content,
      contentType: typeof rawData.content,
      contentIsString: typeof rawData.content === 'string',
      contentKeys: rawData.content && typeof rawData.content === 'object' ? Object.keys(rawData.content) : [],
      contentSample: typeof rawData.content === 'string' ? 
        rawData.content.substring(0, 200) : 
        JSON.stringify(rawData.content).substring(0, 200)
    });
    
    // Analyze available data
    let availableData = {
      hasTitle: false,
      title: '',
      metaTagCount: 0,
      hasStructuredData: false,
      textLength: 0,
      hasHtml: false,
      sampleMetaTags: [] as string[]
    };
    
    // Handle crawlee dumps stored as strings (old format)
    if (collectionType === 'crawlee_dump' && typeof rawData.content === 'string') {
      console.log('[Beta] [GleifClaimsRoutes] Detected old crawlee dump format (string)');
      
      // Check if it's JSON or plain HTML
      const trimmedContent = rawData.content.trim();
      if (trimmedContent.startsWith('<') || trimmedContent.includes('<!DOCTYPE') || 
          trimmedContent.includes('<html') || trimmedContent.includes('<title')) {
        // It's HTML - convert to pages structure
        console.log('[Beta] [GleifClaimsRoutes] Converting plain HTML to pages structure');
        rawData.content = {
          pages: [{
            url: rawData.domain || '1und1.com',
            html: rawData.content
          }]
        };
      } else {
        // Try to parse as JSON
        try {
          const parsedContent = JSON.parse(rawData.content);
          if (parsedContent?.pages) {
            rawData.content = parsedContent;
          }
        } catch (e) {
          console.log('[Beta] [GleifClaimsRoutes] Failed to parse string content as JSON');
          // If JSON parsing fails, assume it's HTML anyway
          if (trimmedContent.length > 100) {
            console.log('[Beta] [GleifClaimsRoutes] Fallback: treating as HTML');
            rawData.content = {
              pages: [{
                url: rawData.domain || '1und1.com',
                html: rawData.content
              }]
            };
          }
        }
      }
    }
    
    if (collectionType === 'crawlee_dump' && rawData.content?.pages) {
      const firstPage = rawData.content.pages[0];
      if (firstPage) {
        // Handle newer dumps with extracted fields
        if (firstPage.title || firstPage.metaTags || firstPage.structuredData) {
          availableData.hasTitle = !!firstPage.title;
          availableData.title = firstPage.title || '';
          availableData.metaTagCount = firstPage.metaTags ? Object.keys(firstPage.metaTags).length : 0;
          availableData.hasStructuredData = !!firstPage.structuredData;
          availableData.textLength = firstPage.text ? firstPage.text.length : 0;
          if (firstPage.metaTags) {
            availableData.sampleMetaTags = Object.entries(firstPage.metaTags)
              .slice(0, 5)
              .map(([key, value]) => `${key}: ${value}`);
          }
        } 
        // Handle old dumps with only HTML
        else if (firstPage.html) {
          availableData.hasHtml = true;
          
          // Extract title from HTML
          const titleMatch = firstPage.html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            availableData.hasTitle = true;
            availableData.title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<');
          }
          
          // Extract meta tags from HTML
          const metaTags: Record<string, string> = {};
          const metaRegex = /<meta\s+(?:name|property)=(?:["']([^"']+)["'])\s+content=(?:["']([^"']+)["'])/gi;
          let match;
          while ((match = metaRegex.exec(firstPage.html)) !== null) {
            const content = match[2]
              .replace(/&amp;/g, '&')
              .replace(/&gt;/g, '>')
              .replace(/&lt;/g, '<')
              .replace(/&#x27;/g, "'");
            metaTags[match[1]] = content;
          }
          availableData.metaTagCount = Object.keys(metaTags).length;
          availableData.sampleMetaTags = Object.entries(metaTags)
            .slice(0, 5)
            .map(([key, value]) => `${key}: ${value.substring(0, 100)}`);
          
          // Extract text length
          const textContent = firstPage.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          availableData.textLength = textContent.length;
          
          // Check for structured data
          availableData.hasStructuredData = firstPage.html.includes('application/ld+json');
        }
      }
    } else if (collectionType === 'axios_cheerio_dump') {
      availableData.hasHtml = !!rawData.content;
      availableData.textLength = rawData.content?.length || 0;
      if (rawData.metadata?.meta_tags) {
        availableData.metaTagCount = Object.keys(rawData.metadata.meta_tags).length;
        availableData.sampleMetaTags = Object.entries(rawData.metadata.meta_tags)
          .slice(0, 5)
          .map(([key, value]) => `${key}: ${value}`);
      }
      if (rawData.metadata?.page_metadata?.title) {
        availableData.hasTitle = true;
        availableData.title = rawData.metadata.page_metadata.title;
      }
    }
    
    console.log('[Beta] [GleifClaimsRoutes] Pre-check analysis:', availableData);
    
    return res.json({
      success: true,
      availableData,
      recommendation: availableData.metaTagCount > 0 || availableData.hasTitle ? 
        'Data is available for entity extraction' : 
        'Limited data available, extraction may not yield results'
    });
    
  } catch (error) {
    console.error('[Beta] [GleifClaimsRoutes] Pre-check error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform pre-check'
    });
  }
});

// Get available dumps with data for claims generation
router.get('/available-dumps', async (req: Request, res: Response) => {
  try {
    console.log('[Beta] [GleifClaimsRoutes] Fetching dumps with valid data');
    
    // Get all dumps from processing service
    const allDumps = await processingPipelineService.getAvailableDumps();
    
    // Filter to only include dumps with data and successful status
    const validDumps = allDumps.filter(dump => {
      return dump.hasData && 
             (dump.status === 'completed' || dump.status === 'success' || !dump.status);
    });
    
    console.log(`[Beta] [GleifClaimsRoutes] Found ${validDumps.length} valid dumps out of ${allDumps.length} total`);
    
    res.json({
      success: true,
      data: validDumps
    });
  } catch (error: any) {
    console.error('[Beta] [GleifClaimsRoutes] Error fetching dumps:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch available dumps'
    });
  }
});

export default router;