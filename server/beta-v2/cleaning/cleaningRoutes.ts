// API routes for Beta V2 Cleaning Service

import { Router, Request, Response } from 'express';
import { CleaningService } from './cleaningService';
import { CleaningRequest } from './types';
import { executeBetaV2Query } from '../database';
import { CLEANING_MODELS } from './config';

export function createCleaningRoutes(): Router {
  const router = Router();
  const cleaningService = new CleaningService();

  /**
   * GET /api/beta/cleaning/available-data
   * Get list of raw dumps available for processing
   */
  router.get('/available-data', async (req: Request, res: Response) => {
    try {
      console.log('[CleaningRoutes] Getting available dumps');
      const dumps = await cleaningService.getAvailableDumps();

      res.json({
        dumps,
        totalCount: dumps.length
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error getting available dumps:', error);
      res.status(500).json({
        error: 'Failed to get available dumps',
        message: error.message
      });
    }
  });

  /**
   * POST /api/beta/cleaning/process
   * Process a dump with one or more models
   */
  router.post('/process', async (req: Request, res: Response) => {
    try {
      const { sourceType, sourceId, models } = req.body;

      // Validate request
      if (!sourceType || !sourceId) {
        return res.status(400).json({
          error: 'Missing required fields: sourceType and sourceId'
        });
      }

      // Default to single model if not array
      const modelList = Array.isArray(models) ? models : [models || 'deepseek-chat'];

      // Prepare cleaning request
      const cleaningRequest: CleaningRequest = {
        sourceType,
        sourceId: parseInt(sourceId),
        modelName: modelList[0],
        compareModels: modelList.slice(1)
      };

      console.log('[CleaningRoutes] Processing request:', {
        sourceType,
        sourceId,
        models: modelList
      });

      // Process with models
      const results = await cleaningService.processWithModels(cleaningRequest);

      res.json({
        success: true,
        sourceType,
        sourceId,
        results,
        modelsUsed: modelList
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error processing dump:', error);
      res.status(500).json({
        error: 'Failed to process dump',
        message: error.message
      });
    }
  });

  /**
   * GET /api/beta/cleaning/results/:sourceType/:sourceId
   * Get all cleaning results for a specific dump
   */
  router.get('/results/:sourceType/:sourceId', async (req: Request, res: Response) => {
    try {
      const { sourceType, sourceId } = req.params;

      if (!sourceType || !sourceId) {
        return res.status(400).json({
          error: 'Missing required parameters: sourceType and sourceId'
        });
      }

      const results = await cleaningService.getCleaningResults(
        sourceType,
        parseInt(sourceId)
      );

      res.json({
        sourceType,
        sourceId,
        results,
        totalResults: results.length
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error getting results:', error);
      res.status(500).json({
        error: 'Failed to get cleaning results',
        message: error.message
      });
    }
  });

  /**
   * GET /api/beta/cleaning/models
   * Get available models and their status
   */
  router.get('/models', async (req: Request, res: Response) => {
    try {
      const models = cleaningService.getAvailableModels();

      res.json({
        models,
        totalCount: models.length,
        freeModels: models.filter(m => m.isFree).length,
        paidModels: models.filter(m => !m.isFree).length
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error getting models:', error);
      res.status(500).json({
        error: 'Failed to get models',
        message: error.message
      });
    }
  });

  /**
   * GET /api/beta/cleaning/compare/:sessionId
   * Get comparison results for a multi-model session
   */
  router.get('/compare/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      // Query the session and associated results
      const sessionQuery = `
        SELECT cs.*, 
               json_agg(
                 json_build_object(
                   'model', cd.model_name,
                   'extractedData', cd.cleaned_data,
                   'metadata', json_build_object(
                     'processingTimeMs', cd.processing_time_ms,
                     'tokenCount', cd.token_count,
                     'costEstimate', cd.cost_estimate,
                     'confidenceScore', cd.confidence_score
                   )
                 )
               ) as results
        FROM cleaning_sessions cs
        LEFT JOIN cleaned_data cd 
          ON cs.source_type = cd.source_type 
          AND cs.source_id = cd.source_id
          AND cd.model_name = ANY(cs.models_used)
        WHERE cs.session_id = $1
        GROUP BY cs.id, cs.session_id, cs.source_type, cs.source_id, cs.models_used, cs.created_at
      `;

      const result = await executeBetaV2Query(sessionQuery, [sessionId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Session not found'
        });
      }

      const session = result.rows[0];

      res.json({
        sessionId: session.session_id,
        sourceType: session.source_type,
        sourceId: session.source_id,
        modelsUsed: session.models_used,
        createdAt: session.created_at,
        results: session.results || []
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error getting comparison:', error);
      res.status(500).json({
        error: 'Failed to get comparison results',
        message: error.message
      });
    }
  });

  // Get available cleaning models
  router.get('/models', (req, res) => {
    try {
      const models = Object.entries(CLEANING_MODELS)
        .filter(([_, config]) => config.enabled)
        .map(([key, config]) => ({
          id: key,
          name: config.modelId,
          provider: config.provider,
          isFree: config.isFree,
          maxTokens: config.maxTokens,
          temperature: config.temperature
        }));

      res.json({
        success: true,
        models
      });
    } catch (error: any) {
      console.error('[CleaningRoutes] Error fetching models:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}