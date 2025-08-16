import { Router } from 'express';
import { db } from '../arbitration/database-wrapper';
import { betaV2Db } from '../database';
import { sql } from 'drizzle-orm';
import { claimsGenerationService } from '../arbitration/claimsGenerationService';
import { perplexityArbitrationService } from '../arbitration/perplexityArbitrationService';
import { perplexityAdapter } from '../arbitration/perplexityAdapter';
import { claimsNormalizer } from '../arbitration/claimsNormalizationService';

const router = Router();

/**
 * Create arbitration request for a domain
 */
router.post('/request', async (req, res) => {
  // Complex workflow management - ensure proper error propagation between stages
  // Single point of failure risk - if this route fails, the entire arbitration system is unavailable
  try {
    const { 
      domain, 
      dumpId, 
      collectionType, 
      existingClaims = null,
      muteRankingRules = undefined
    } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    console.log(`[Arbitration] Processing arbitration request for domain: ${domain}`);

    // Create arbitration request in database
    const requestResult = await db.query(
      `INSERT INTO arbitration_requests (domain, dump_id, collection_type, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [domain, dumpId, collectionType]
    );

    const requestId = requestResult.rows[0].id;
    console.log(`[Arbitration] Created request ${requestId} for ${domain}`);

    // Process asynchronously with existing claims if provided
    // Good UX design - immediate response with status tracking capability
    processArbitrationAsync(requestId, domain, dumpId, collectionType, undefined, existingClaims, muteRankingRules);

    res.json({
      success: true,
      requestId,
      status: 'processing',
      message: `Arbitration started for ${domain}. Processing will take about 2 minutes.`
    });

  } catch (error) {
    console.error('[Arbitration] Error processing arbitration request:', error);
    // Consider implementing different error codes for different failure types
    res.status(500).json({ 
      error: 'Failed to process arbitration request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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

    // PHASE 2 INTEGRATION: Normalize claims before sending to frontend
    console.log(`[Arbitration] Normalizing claims for frontend display`);
    const rawClaims = claimsResult.rows.map((row: any) => ({
      claim_number: row.claim_number,
      claim_type: row.claim_type,
      entity_name: row.entity_name,
      lei_code: row.lei_code,
      confidence_score: row.confidence_score,
      source: row.source,
      metadata: row.metadata
    }));

    const normalizationResult = await claimsNormalizer.normalizeClaims(rawClaims);
    const normalizedClaims = normalizationResult.normalizedClaims || rawClaims;

    res.json({
      success: true,
      status: 'completed',
      claims: normalizedClaims,  // Send normalized claims to frontend
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
      preferParent,
      parentWeight,
      entityStatusWeight,
      legalFormWeight,
      recencyWeight,
      industryFocus
    } = req.body;

    // Build the SQL query string properly without jurisdiction fields
    const result = await db.query(
      `INSERT INTO user_bias_profiles (
        profile_name, jurisdiction_primary, jurisdiction_secondary,
        prefer_parent, parent_weight, jurisdiction_weight,
        entity_status_weight, legal_form_weight, recency_weight,
        industry_focus
      ) VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id`,
      [
        profileName || 'Custom Profile',
        'AUTO',  // Default value to indicate auto-discovery
        [],      // Empty array for secondary jurisdictions
        preferParent !== false,
        parentWeight || 0.5,
        0,       // Zero weight for jurisdiction since it's auto-discovered
        entityStatusWeight || 0.2,
        legalFormWeight || 0.15,
        recencyWeight || 0.15,
        JSON.stringify(industryFocus || {})
      ]
    );

    console.log('[Arbitration Routes] Profile saved successfully:', result.rows[0]?.id);

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
  userBiasProfileId?: number,
  providedClaims?: any[],
  muteRankingRules?: boolean
) {
  try {
    console.log(`[Arbitration] Processing request ${requestId}`);

    // Get the dump data - need to fetch the full dump for website context
    const dumpData = await getDumpData(dumpId, collectionType);
    const cleanedData = await getCleanedData(dumpId, collectionType);

    // Debug log to check cleanedData contents
    console.log(`[Arbitration] cleanedData check:`, {
      hasCleanedData: !!cleanedData,
      hasEvidenceTrail: !!cleanedData?.evidenceTrail,
      entitiesFound: cleanedData?.evidenceTrail?.entitiesFound?.length || 0,
      primaryEntityName: cleanedData?.primaryEntityName
    });

    const dump = {
      id: dumpId,
      domain,
      collectionType,
      cleanedData: cleanedData,
      rawDumpData: dumpData  // Include raw dump for website context
    };

    // Check if claims were provided from frontend
    let claims;
    if (providedClaims && providedClaims.length > 0) {
      // Use claims provided from GLEIF generation
      // Frontend-provided claims bypass generation but still undergo normalization
      console.log(`[Arbitration] Using ${providedClaims.length} provided claims from frontend`);

      // Transform frontend claims to internal format and store them
      // Ensure claim 0 is always the cleaned dump entity
      claims = providedClaims.map((claim, index) => {
        // First claim (index 0) should be from cleaned dump with source 'cleaned_dump_primary'
        const isCleanedDumpClaim = claim.source === 'cleaned_dump_primary' || index === 0;

        return {
          claimNumber: index,
          claimType: (isCleanedDumpClaim ? 'llm_extracted' : 'gleif_candidate') as 'llm_extracted' | 'gleif_candidate',
          entityName: claim.entityName || claim.legalName,
          leiCode: claim.leiCode || claim.leiCode,
          confidence: typeof claim.confidence === 'string' ? 
                      (claim.confidence === 'high' ? 0.9 : claim.confidence === 'medium' ? 0.6 : 0.3) : 
                      claim.confidence || 0.5,
          source: claim.source || 'gleif_claims',
          metadata: claim.gleifData || claim.metadata || {}
        };
      });

      // Store provided claims
      await claimsGenerationService.storeClaims(requestId, claims);
    } else {
      // Check if claims already exist in database
      const existingClaimsResult = await db.query(
        `SELECT * FROM arbitration_claims WHERE request_id = $1`,
        [requestId]
      );

      if (existingClaimsResult.rows.length > 0) {
        // Use existing claims
        console.log(`[Arbitration] Using ${existingClaimsResult.rows.length} existing claims from database`);
        claims = existingClaimsResult.rows.map((row: any) => ({
          claimNumber: row.claim_number,
          claimType: row.claim_type,
          entityName: row.entity_name,
          leiCode: row.lei_code,
          confidence: row.confidence_score,
          source: row.source,
          metadata: row.metadata
        }));
      } else {
        // Generate new claims if none exist
        console.log(`[Arbitration] Generating new claims`);
        claims = await claimsGenerationService.assembleClaims(dump);
        // Store claims
        await claimsGenerationService.storeClaims(requestId, claims);
      }
    }

    // PHASE 2 INTEGRATION: Normalize claims before arbitration
    console.log(`[Arbitration] Normalizing ${claims.length} claims before arbitration`);
    const normalizationResult = await claimsNormalizer.normalizeClaims(claims);

    if (!normalizationResult.success) {
      console.error('[Arbitration] Claims normalization failed:', normalizationResult.errors);
      // Consider graceful degradation if normalization is non-critical
      throw new Error('Failed to normalize claims');
    }

    if (normalizationResult.warnings) {
      normalizationResult.warnings.forEach(warning => 
        console.warn('[Arbitration] Normalization warning:', warning)
      );
    }

    console.log(`[Arbitration] Normalization stats:`, normalizationResult.stats);

    // Use normalized claims for arbitration
    const normalizedClaims = normalizationResult.normalizedClaims || claims;

    // IMPORTANT: Attach dump data and evidence trail to claim 0's metadata for website context
    if (normalizedClaims.length > 0 && normalizedClaims[0].claimNumber === 0) {
      normalizedClaims[0].metadata = normalizedClaims[0].metadata || {};
      normalizedClaims[0].metadata.dumpData = dump.rawDumpData;
      normalizedClaims[0].metadata.domain = domain;
      // Consider moving large dump data to separate context parameter

      // Debug logging to see what's in cleanedData
      console.log(`[Arbitration] Checking cleanedData for evidence trail:`, {
        hasCleanedData: !!dump.cleanedData,
        hasEvidenceTrail: !!dump.cleanedData?.evidenceTrail,
        evidenceTrailType: typeof dump.cleanedData?.evidenceTrail,
        entitiesFoundCount: dump.cleanedData?.evidenceTrail?.entitiesFound?.length || 0
      });

      // Attach evidence trail from cleanedData if available
      if (dump.cleanedData?.evidenceTrail) {
        normalizedClaims[0].metadata.evidenceTrail = dump.cleanedData.evidenceTrail;
        console.log(`[Arbitration] Attached evidence trail with ${dump.cleanedData.evidenceTrail.entitiesFound?.length || 0} entities to claim 0`);
      } else {
        console.log(`[Arbitration] No evidence trail found in cleanedData`);
      }

      console.log(`[Arbitration] Attached dump data and evidence to claim 0 for website context`);
    }

    // Get user bias
    const userBias = await perplexityArbitrationService.getDefaultUserBias();

    // Apply mute ranking rules if specified
    if (muteRankingRules !== undefined) {
      userBias.muteRankingRules = muteRankingRules;
      console.log(`[Arbitration] Ranking rules ${muteRankingRules ? 'MUTED' : 'ACTIVE'} for testing`);
    }

    // Perform arbitration using Perplexity with normalized claims
    const arbitrationResult = await perplexityArbitrationService.arbitrate(normalizedClaims, userBias);

    // Store results
    console.log(`[Arbitration] Storing results for request ${requestId}`);
    console.log(`[Arbitration] Reasoning length: ${arbitrationResult.overallReasoning?.length || 0}`);
    console.log(`[Arbitration] Ranked entities: ${arbitrationResult.rankedEntities?.length || 0}`);

    try {
      // Use direct SQL execution for large JSONB data
      await betaV2Db.execute(sql`
        INSERT INTO arbitration_results (
          request_id, ranked_entities, arbitrator_model,
          arbitration_reasoning, processing_time_ms, perplexity_citations
        ) VALUES (
          ${requestId}, 
          ${JSON.stringify(arbitrationResult.rankedEntities || [])}::jsonb,
          ${'perplexity-sonar-pro'},
          ${arbitrationResult.overallReasoning || ''},
          ${arbitrationResult.processingTimeMs},
          ${JSON.stringify(arbitrationResult.citations || [])}::jsonb
        )`
      );
      console.log(`[Arbitration] Results stored successfully`);
    } catch (saveError) {
      console.error(`[Arbitration] Failed to save results:`, saveError);
      throw saveError;
    }

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
 * Get raw dump data for website context
 */
async function getDumpData(dumpId: number, collectionType: string): Promise<any> {
  try {
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

    // Special handling for axios_cheerio_dumps which doesn't have dump_data column
    if (collectionType === 'axios_cheerio_dump') {
      const result = await betaV2Db.execute(sql`
        SELECT id, domain, status, 
               JSONB_BUILD_OBJECT(
                 'html', raw_html,
                 'headers', headers,
                 'meta_tags', meta_tags,
                 'extraction_strategies', extraction_strategies,
                 'page_metadata', page_metadata
               ) AS dump_data, 
               created_at 
        FROM axios_cheerio_dumps 
        WHERE id = ${dumpId}
      `);

      if (result.rows.length > 0) {
        return result.rows[0].dump_data;
      }
    } else {
      const dumpResult = await db.query(
        `SELECT dump_data FROM ${tableName} WHERE id = $1`,
        [dumpId]
      );

      if (dumpResult.rows.length > 0) {
        return dumpResult.rows[0].dump_data;
      }
    }

    return null;
  } catch (error) {
    console.error('[Arbitration] Error getting dump data:', error);
    return null;
  }
}

/**
 * Get cleaned data for a dump
 */
async function getCleanedData(dumpId: number, collectionType: string): Promise<any> {
  try {
    // Try to get from beta_v2_processing_results first
    // Now also fetch stage3 data for evidence trail
    const result = await db.query(
      `SELECT stage2_extracted_data, stage3_entity_name, stage3_evidence_trail 
       FROM beta_v2_processing_results 
       WHERE source_id = $1 AND source_type = $2`,
      [dumpId, collectionType]
    );

    if (result.rows.length > 0 && result.rows[0].stage2_extracted_data) {
      const cleanedData = result.rows[0].stage2_extracted_data;
      // Attach stage3 data including evidence trail
      cleanedData.primaryEntityName = result.rows[0].stage3_entity_name;
      cleanedData.evidenceTrail = result.rows[0].stage3_evidence_trail;
      return cleanedData;
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
      `SELECT dump_data FROM ${tableName} WHERE id = $1`,
      [dumpId]
    );

    if (dumpResult.rows.length > 0) {
      const pages = dumpResult.rows[0].dump_data?.pages;
      if (pages && pages.length > 0) {
        return {
          companyName: pages[0]?.title?.replace(/\s*\|.*$/, '').trim() || pages[0]?.metaTags?.['og:site_name'],
          title: pages[0]?.title,
          metaTags: pages[0]?.metaTags
        };
      }
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
    const userBias = await perplexityArbitrationService.getDefaultUserBias();

    // Perform arbitration
    console.log('[Arbitration] Starting Perplexity arbitration...');
    const arbitrationResult = await perplexityArbitrationService.arbitrate(claims, userBias);
    console.log('[Arbitration] Perplexity arbitration complete');

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