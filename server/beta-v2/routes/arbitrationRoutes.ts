import { Router } from 'express';
import { db } from '../arbitration/database-wrapper';
import { claimsGenerationService } from '../arbitration/claimsGenerationService';
import { DeepSeekArbitrationService } from '../arbitration/deepSeekArbitrationService';
import { perplexityAdapter } from '../arbitration/perplexityAdapter';

const router = Router();
const deepSeekArbitrationService = new DeepSeekArbitrationService();

/**
 * Process arbitration for a domain
 */
router.post('/process', async (req, res) => {
  try {
    const { domain, dumpId, collectionType, userBiasProfileId } = req.body;

    if (!domain || !dumpId || !collectionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: domain, dumpId, collectionType'
      });
    }

    console.log(`[Arbitration Routes] Starting arbitration for domain: ${domain}`);

    // Create arbitration request
    const requestResult = await db.query(
      `INSERT INTO arbitration_requests (domain, dump_id, collection_type, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [domain, dumpId, collectionType]
    );

    const requestId = requestResult.rows[0].id;

    // Process asynchronously
    processArbitrationAsync(requestId, domain, dumpId, collectionType, userBiasProfileId);

    res.json({
      success: true,
      requestId,
      status: 'processing',
      message: 'Arbitration started. Poll /results/:requestId for status.'
    });

  } catch (error) {
    console.error('[Arbitration Routes] Process error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start arbitration'
    });
  }
});

/**
 * Get arbitration results
 */
router.get('/results/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    // Get request status
    const requestResult = await db.query(
      'SELECT * FROM arbitration_requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const request = requestResult.rows[0];

    // If still processing, return status only
    if (request.status === 'processing' || request.status === 'pending') {
      return res.json({
        success: true,
        status: request.status,
        message: 'Arbitration in progress'
      });
    }

    // If failed, return error
    if (request.status === 'failed') {
      return res.json({
        success: false,
        status: 'failed',
        error: request.error_message || 'Arbitration failed'
      });
    }

    // Get claims
    const claimsResult = await db.query(
      `SELECT * FROM arbitration_claims 
       WHERE request_id = $1 
       ORDER BY claim_number`,
      [requestId]
    );

    // Get results
    const resultsResult = await db.query(
      'SELECT * FROM arbitration_results WHERE request_id = $1',
      [requestId]
    );

    const result = resultsResult.rows[0];

    res.json({
      success: true,
      status: 'completed',
      claims: claimsResult.rows,
      rankedEntities: result?.ranked_entities || [],
      reasoning: result?.arbitration_reasoning || '',
      citations: result?.perplexity_citations || [],
      processingTimeMs: result?.processing_time_ms || 0,
      arbitratorModel: result?.arbitrator_model || 'unknown'
    });

  } catch (error) {
    console.error('[Arbitration Routes] Results error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get results'
    });
  }
});

/**
 * Configure user bias profile
 */
router.post('/bias/configure', async (req, res) => {
  try {
    const {
      profileName,
      jurisdictionPrimary,
      jurisdictionSecondary,
      preferParent,
      parentWeight,
      jurisdictionWeight,
      entityStatusWeight,
      legalFormWeight,
      recencyWeight,
      industryFocus
    } = req.body;

    const result = await db.query(
      `INSERT INTO user_bias_profiles (
        profile_name, jurisdiction_primary, jurisdiction_secondary,
        prefer_parent, parent_weight, jurisdiction_weight,
        entity_status_weight, legal_form_weight, recency_weight,
        industry_focus
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id`,
      [
        profileName || 'Custom Profile',
        jurisdictionPrimary || 'US',
        jurisdictionSecondary || [],
        preferParent !== false,
        parentWeight || 0.4,
        jurisdictionWeight || 0.3,
        entityStatusWeight || 0.1,
        legalFormWeight || 0.05,
        recencyWeight || 0.05,
        JSON.stringify(industryFocus || {})
      ]
    );

    res.json({
      success: true,
      profileId: result.rows[0].id
    });

  } catch (error) {
    console.error('[Arbitration Routes] Bias configuration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure bias'
    });
  }
});

/**
 * Get user bias profiles
 */
router.get('/bias/profiles', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM user_bias_profiles ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      profiles: result.rows
    });

  } catch (error) {
    console.error('[Arbitration Routes] Get profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profiles'
    });
  }
});

/**
 * Test Perplexity connection
 */
router.get('/test-perplexity', async (req, res) => {
  try {
    const isConnected = await perplexityAdapter.testConnection();
    
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected 
        ? 'Perplexity API is connected and working'
        : 'Perplexity API is not available. Check API key.'
    });

  } catch (error) {
    console.error('[Arbitration Routes] Perplexity test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Perplexity connection'
    });
  }
});

/**
 * Process arbitration asynchronously
 */
async function processArbitrationAsync(
  requestId: number,
  domain: string,
  dumpId: number,
  collectionType: string,
  userBiasProfileId?: number
) {
  try {
    console.log(`[Arbitration] Processing request ${requestId}`);

    // Get the dump data
    const dump = {
      id: dumpId,
      domain,
      collectionType,
      cleanedData: await getCleanedData(dumpId, collectionType)
    };

    // Generate claims
    const claims = await claimsGenerationService.assembleClaims(dump);
    
    // Store claims
    await claimsGenerationService.storeClaims(requestId, claims);

    // Get user bias
    const userBias = await deepSeekArbitrationService.getDefaultUserBias();

    // Perform arbitration using DeepSeek R1 reasoning
    const arbitrationResult = await deepSeekArbitrationService.arbitrate(claims, userBias);

    // Store results
    await db.query(
      `INSERT INTO arbitration_results (
        request_id, ranked_entities, arbitrator_model,
        arbitration_reasoning, processing_time_ms, perplexity_citations
      ) VALUES ($1, $2::jsonb[], $3, $4, $5, $6::jsonb)`,
      [
        requestId,
        JSON.stringify(arbitrationResult.rankedEntities),
        'deepseek-r1-free',
        arbitrationResult.overallReasoning,
        arbitrationResult.processingTimeMs,
        JSON.stringify(arbitrationResult.citations)
      ]
    );

    // Update request status
    await db.query(
      `UPDATE arbitration_requests 
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    console.log(`[Arbitration] Request ${requestId} completed successfully`);

  } catch (error) {
    console.error(`[Arbitration] Request ${requestId} failed:`, error);
    
    // Update request status to failed
    await db.query(
      `UPDATE arbitration_requests 
       SET status = 'failed', 
           error_message = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [requestId, error instanceof Error ? error.message : 'Unknown error']
    );
  }
}

/**
 * Get cleaned data for a dump
 */
async function getCleanedData(dumpId: number, collectionType: string): Promise<any> {
  try {
    // Try to get from processing results first
    const result = await db.query(
      `SELECT cleaned_data FROM processing_results 
       WHERE collection_id = $1 AND collection_type = $2`,
      [dumpId, collectionType]
    );

    if (result.rows.length > 0 && result.rows[0].cleaned_data) {
      return result.rows[0].cleaned_data;
    }

    // Fallback to raw dump data
    let tableName = '';
    switch (collectionType) {
      case 'playwright_dump':
        tableName = 'playwright_dumps';
        break;
      case 'crawlee_dump':
        tableName = 'crawlee_dumps';
        break;
      case 'scrapy_crawl':
        tableName = 'scrapy_crawls';
        break;
      case 'axios_cheerio_dump':
        tableName = 'axios_cheerio_dumps';
        break;
      default:
        return null;
    }

    const dumpResult = await db.query(
      `SELECT pages FROM ${tableName} WHERE id = $1`,
      [dumpId]
    );

    if (dumpResult.rows.length > 0) {
      const pages = dumpResult.rows[0].pages;
      return {
        companyName: pages[0]?.title?.replace(/\s*\|.*$/, '').trim(),
        title: pages[0]?.title,
        metaTags: pages[0]?.metaTags
      };
    }

    return null;
  } catch (error) {
    console.error('[Arbitration] Error getting cleaned data:', error);
    return null;
  }
}

/**
 * Quick test endpoint for arbitration with sample data
 */
router.post('/test-sample', async (req, res) => {
  try {
    const { domain = 'apple.com', entityName = 'Apple' } = req.body;
    
    console.log(`[Arbitration] Testing with domain: ${domain}, entity: ${entityName}`);

    // Create a mock cleaned dump for testing
    const mockDump = {
      id: 999,
      domain,
      cleanedData: {
        primaryEntityName: entityName,
        companyName: entityName
      },
      collectionType: 'test'
    };

    // Generate claims
    console.log('[Arbitration] Generating claims...');
    const claims = await claimsGenerationService.assembleClaims(mockDump);
    console.log(`[Arbitration] Generated ${claims.length} claims`);
    
    // Get default user bias
    const userBias = await deepSeekArbitrationService.getDefaultUserBias();
    
    // Perform arbitration
    console.log('[Arbitration] Starting DeepSeek R1 reasoning arbitration...');
    const arbitrationResult = await deepSeekArbitrationService.arbitrate(claims, userBias);
    console.log('[Arbitration] DeepSeek arbitration complete');

    res.json({
      success: true,
      data: {
        domain,
        entityName,
        totalClaims: claims.length,
        claims: claims.map(c => ({
          claimNumber: c.claimNumber,
          entityName: c.entityName,
          leiCode: c.leiCode,
          confidence: c.confidence,
          source: c.source,
          type: c.claimType
        })),
        arbitrationResult: {
          rankedEntities: arbitrationResult.rankedEntities,
          reasoning: arbitrationResult.overallReasoning,
          citations: arbitrationResult.citations,
          processingTimeMs: arbitrationResult.processingTimeMs
        }
      }
    });
  } catch (error) {
    console.error('[Arbitration] Test sample failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test arbitration failed'
    });
  }
});

export default router;