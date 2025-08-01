import { Router, Request, Response } from 'express';
import { processingPipelineService } from './processingPipelineService';
import { processingStorage } from './processingStorage';
import { 
  AvailableDumpsResponse, 
  StartProcessingRequest, 
  StartProcessingResponse,
  ProcessingListResponse,
  ProcessingDetailResponse 
} from './processingTypes';

const router = Router();

// Root endpoint - redirect to UI
router.get('/', (req: Request, res: Response) => {
  // If accessed from browser, redirect to frontend UI
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/beta-v2/data-processing');
  }
  
  // Otherwise, return API info
  res.json({
    service: 'Data Processing Stage 2',
    endpoints: [
      'GET /dumps - List available dumps',
      'POST /process - Start processing a dump',
      'GET /results - List processing results',
      'GET /result/:id - Get detailed result',
      'GET /health - Health check'
    ]
  });
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'Data Processing Stage 2',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get available dumps from all collection methods
router.get('/dumps', async (req: Request, res: Response) => {
  try {
    console.log('[Processing] Fetching available dumps');
    const dumps = await processingPipelineService.getAvailableDumps();
    
    const response: AvailableDumpsResponse = {
      success: true,
      data: dumps
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[Processing] Error fetching dumps:', error);
    const response: AvailableDumpsResponse = {
      success: false,
      error: error.message || 'Failed to fetch available dumps'
    };
    res.status(500).json(response);
  }
});

// Start processing a dump
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { sourceType, sourceId }: StartProcessingRequest = req.body;
    
    if (!sourceType || !sourceId) {
      const response: StartProcessingResponse = {
        success: false,
        error: 'sourceType and sourceId are required'
      };
      return res.status(400).json(response);
    }
    
    console.log(`[Processing] Starting processing for ${sourceType}:${sourceId}`);
    
    // Start processing asynchronously
    processingPipelineService.processDump(sourceType, sourceId)
      .then(result => {
        console.log(`[Processing] Completed processing for ${sourceType}:${sourceId}`);
      })
      .catch(error => {
        console.error(`[Processing] Error processing ${sourceType}:${sourceId}:`, error);
      });
    
    // Return immediately with processing ID
    const response: StartProcessingResponse = {
      success: true,
      processingId: sourceId // This would ideally be the processing result ID
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[Processing] Error starting processing:', error);
    const response: StartProcessingResponse = {
      success: false,
      error: error.message || 'Failed to start processing'
    };
    res.status(500).json(response);
  }
});

// Get all processing results
router.get('/results', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const results = await processingStorage.getAllProcessingResults(limit);
    
    const response: ProcessingListResponse = {
      success: true,
      data: results
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[Processing] Error fetching results:', error);
    const response: ProcessingListResponse = {
      success: false,
      error: error.message || 'Failed to fetch processing results'
    };
    res.status(500).json(response);
  }
});

// Get specific processing result
router.get('/result/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      const response: ProcessingDetailResponse = {
        success: false,
        error: 'Invalid result ID'
      };
      return res.status(400).json(response);
    }
    
    const result = await processingStorage.getProcessingResult(id);
    
    const response: ProcessingDetailResponse = {
      success: true,
      data: result
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('[Processing] Error fetching result:', error);
    const response: ProcessingDetailResponse = {
      success: false,
      error: error.message || 'Failed to fetch processing result'
    };
    res.status(500).json(response);
  }
});

export default router;