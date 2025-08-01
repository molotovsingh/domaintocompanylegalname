// GLEIF Search Routes for Beta V2
import { Router, Request, Response } from 'express';
import { GLEIFSearchService } from './gleifSearchService';
import { GLEIFSearchStorage } from './gleifSearchStorage';
import { GLEIFSearchResponse } from './gleifSearchTypes';

const router = Router();
const gleifService = new GLEIFSearchService();
const gleifStorage = new GLEIFSearchStorage();

// Root endpoint - show API info or redirect to UI
router.get('/', (req: Request, res: Response) => {
  // If accessed from browser, redirect to frontend UI
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/beta-v2/gleif-search');
  }
  
  // Otherwise, return API info
  res.json({
    service: 'GLEIF Search',
    endpoints: [
      'POST /search - Search for GLEIF entities',
      'GET /search/:id - Get search result by ID',
      'GET /searches - List recent searches',
      'DELETE /cleanup - Clean up old searches',
      'GET /health - Health check'
    ]
  });
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'GLEIF Search',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Search GLEIF entities
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { suspectedName, domain } = req.body;

    // Validate input
    if (!suspectedName || typeof suspectedName !== 'string') {
      const response: GLEIFSearchResponse = {
        success: false,
        error: 'Suspected name is required',
        code: 'VALIDATION_ERROR'
      };
      return res.status(400).json(response);
    }

    console.log(`[Beta v2] [GLEIF] [Routes] Starting search for: ${suspectedName}`);

    // Create search request in database
    const searchId = await gleifStorage.createSearchRequest({
      suspectedName,
      domain,
      searchMethod: 'exact' // Will be updated based on actual search
    });

    try {
      // Perform GLEIF search
      const searchResult = await gleifService.searchGLEIF(suspectedName, domain);

      // Store candidates
      await gleifStorage.storeCandidates(searchId, searchResult.entities);

      // Update search request status
      await gleifStorage.updateSearchRequest(searchId, 'completed');

      // Get complete result
      const result = await gleifStorage.getSearchResult(searchId);

      // Return simplified response format for frontend
      res.json({
        success: true,
        searchId: searchId,
        totalMatches: result?.candidates.length || 0
      });
    } catch (searchError: any) {
      // Update search request with error
      await gleifStorage.updateSearchRequest(searchId, 'failed', searchError.message);
      throw searchError;
    }
  } catch (error: any) {
    console.error('[Beta v2] [GLEIF] [Routes] Search error:', error);
    
    const response: GLEIFSearchResponse = {
      success: false,
      error: error.message || 'Failed to search GLEIF entities',
      code: 'PROCESSING_ERROR'
    };
    
    res.status(500).json(response);
  }
});

// Get search result by ID
router.get('/search/:id', async (req: Request, res: Response) => {
  try {
    const searchId = parseInt(req.params.id);
    
    if (isNaN(searchId)) {
      const response: GLEIFSearchResponse = {
        success: false,
        error: 'Invalid search ID',
        code: 'INVALID_ID'
      };
      return res.status(400).json(response);
    }

    const result = await gleifStorage.getSearchResult(searchId);

    if (!result) {
      const response: GLEIFSearchResponse = {
        success: false,
        error: 'Search not found',
        code: 'NOT_FOUND'
      };
      return res.status(404).json(response);
    }

    const response: GLEIFSearchResponse = {
      success: true,
      data: result
    };

    res.json(response);
  } catch (error: any) {
    console.error('[Beta v2] [GLEIF] [Routes] Get search error:', error);
    
    const response: GLEIFSearchResponse = {
      success: false,
      error: error.message || 'Failed to retrieve search result',
      code: 'PROCESSING_ERROR'
    };
    
    res.status(500).json(response);
  }
});

// List recent searches
router.get('/searches', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const searches = await gleifStorage.getAllSearchRequests(limit);

    res.json({
      success: true,
      data: {
        searches,
        count: searches.length
      }
    });
  } catch (error: any) {
    console.error('[Beta v2] [GLEIF] [Routes] List searches error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list searches',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Cleanup old searches (admin endpoint)
router.delete('/cleanup', async (req: Request, res: Response) => {
  try {
    const daysToKeep = parseInt(req.query.days as string) || 7;
    const deletedCount = await gleifStorage.cleanupOldSearches(daysToKeep);

    res.json({
      success: true,
      data: {
        deletedCount,
        message: `Deleted ${deletedCount} searches older than ${daysToKeep} days`
      }
    });
  } catch (error: any) {
    console.error('[Beta v2] [GLEIF] [Routes] Cleanup error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cleanup searches',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Test UI page (when accessed via browser)
router.get('/', (req: Request, res: Response) => {
  if (req.headers.accept?.includes('text/html')) {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GLEIF Search - Beta V2</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          .subtitle {
            color: #666;
            margin-bottom: 30px;
          }
          .search-form {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
          }
          input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 16px;
          }
          button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
          }
          button:hover {
            background: #0056b3;
          }
          button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          .results {
            margin-top: 30px;
          }
          .candidate {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin-bottom: 15px;
            background: #fafafa;
          }
          .candidate-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .legal-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
          }
          .lei-code {
            font-family: monospace;
            color: #666;
          }
          .score-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
          }
          .high-score { background: #d4edda; color: #155724; }
          .medium-score { background: #fff3cd; color: #856404; }
          .low-score { background: #f8d7da; color: #721c24; }
          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
          }
          .detail-group {
            font-size: 14px;
          }
          .detail-label {
            color: #666;
            margin-bottom: 2px;
          }
          .detail-value {
            color: #333;
            font-weight: 500;
          }
          .scores {
            display: flex;
            gap: 15px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
          }
          .score-item {
            text-align: center;
          }
          .score-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
          }
          .score-label {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
          }
          .loading {
            text-align: center;
            padding: 40px;
            color: #666;
          }
          .error {
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
          }
          .recent-searches {
            margin-top: 40px;
            padding-top: 40px;
            border-top: 2px solid #eee;
          }
          .recent-search {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
          }
          .recent-search:hover {
            background: #f5f5f5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>GLEIF Search Service</h1>
          <p class="subtitle">Search for legal entities in the Global Legal Entity Identifier Foundation database</p>
          
          <div class="search-form">
            <input 
              type="text" 
              id="suspectedName" 
              placeholder="Enter suspected company name (e.g., Apple, Microsoft)"
            />
            <input 
              type="text" 
              id="domain" 
              placeholder="Domain (optional, e.g., apple.com)"
            />
            <button id="searchBtn" onclick="performSearch()">Search GLEIF</button>
          </div>
          
          <div id="results"></div>
          
          <div class="recent-searches">
            <h2>Recent Searches</h2>
            <div id="recentSearches"></div>
          </div>
        </div>

        <script>
          let currentSearchId = null;

          async function performSearch() {
            const suspectedName = document.getElementById('suspectedName').value.trim();
            const domain = document.getElementById('domain').value.trim();
            
            if (!suspectedName) {
              alert('Please enter a suspected company name');
              return;
            }

            const resultsDiv = document.getElementById('results');
            const searchBtn = document.getElementById('searchBtn');
            
            searchBtn.disabled = true;
            resultsDiv.innerHTML = '<div class="loading">Searching GLEIF database...</div>';

            try {
              const response = await fetch('/api/beta/gleif-search/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suspectedName, domain })
              });

              const result = await response.json();

              if (result.success) {
                currentSearchId = result.data.searchRequest.id;
                displayResults(result.data);
                loadRecentSearches();
              } else {
                resultsDiv.innerHTML = \`<div class="error">Error: \${result.error}</div>\`;
              }
            } catch (error) {
              resultsDiv.innerHTML = \`<div class="error">Network error: \${error.message}</div>\`;
            } finally {
              searchBtn.disabled = false;
            }
          }

          function displayResults(data) {
            const resultsDiv = document.getElementById('results');
            
            if (data.candidates.length === 0) {
              resultsDiv.innerHTML = '<div class="error">No GLEIF entities found</div>';
              return;
            }

            let html = \`<h2>Found \${data.candidates.length} GLEIF Entities</h2>\`;
            
            data.candidates.forEach((candidate, index) => {
              const scoreClass = candidate.weightedTotalScore >= 70 ? 'high-score' : 
                               candidate.weightedTotalScore >= 40 ? 'medium-score' : 'low-score';
              
              html += \`
                <div class="candidate">
                  <div class="candidate-header">
                    <div>
                      <div class="legal-name">\${candidate.legalName}</div>
                      <div class="lei-code">LEI: \${candidate.leiCode}</div>
                    </div>
                    <div class="score-badge \${scoreClass}">
                      Score: \${candidate.weightedTotalScore}
                    </div>
                  </div>
                  
                  <div class="details">
                    <div class="detail-group">
                      <div class="detail-label">Jurisdiction</div>
                      <div class="detail-value">\${candidate.jurisdiction || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                      <div class="detail-label">Entity Status</div>
                      <div class="detail-value">\${candidate.entityStatus || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                      <div class="detail-label">Legal Form</div>
                      <div class="detail-value">\${candidate.legalForm || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                      <div class="detail-label">Registration Status</div>
                      <div class="detail-value">\${candidate.registrationStatus || 'N/A'}</div>
                    </div>
                    <div class="detail-group">
                      <div class="detail-label">Headquarters</div>
                      <div class="detail-value">
                        \${[candidate.headquarters.city, candidate.headquarters.country].filter(Boolean).join(', ') || 'N/A'}
                      </div>
                    </div>
                    <div class="detail-group">
                      <div class="detail-label">Selection Reason</div>
                      <div class="detail-value">\${candidate.selectionReason || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div class="scores">
                    <div class="score-item">
                      <div class="score-value">\${candidate.nameMatchScore || 0}</div>
                      <div class="score-label">Name Match</div>
                    </div>
                    <div class="score-item">
                      <div class="score-value">\${candidate.fortune500Score || 0}</div>
                      <div class="score-label">Fortune 500</div>
                    </div>
                    <div class="score-item">
                      <div class="score-value">\${candidate.tldJurisdictionScore || 0}</div>
                      <div class="score-label">TLD Match</div>
                    </div>
                    <div class="score-item">
                      <div class="score-value">\${candidate.entityComplexityScore || 0}</div>
                      <div class="score-label">Complexity</div>
                    </div>
                  </div>
                </div>
              \`;
            });

            resultsDiv.innerHTML = html;
          }

          async function loadRecentSearches() {
            try {
              const response = await fetch('/api/beta/gleif-search/searches?limit=10');
              const result = await response.json();

              if (result.success) {
                const recentDiv = document.getElementById('recentSearches');
                
                if (result.data.searches.length === 0) {
                  recentDiv.innerHTML = '<p style="color: #666;">No recent searches</p>';
                  return;
                }

                let html = '';
                result.data.searches.forEach(search => {
                  const date = new Date(search.createdAt).toLocaleString();
                  html += \`
                    <div class="recent-search" onclick="loadSearch(\${search.id})">
                      <div>
                        <strong>\${search.suspectedName}</strong>
                        \${search.domain ? \`(\${search.domain})\` : ''}
                      </div>
                      <div style="color: #666; font-size: 14px;">\${date}</div>
                    </div>
                  \`;
                });
                
                recentDiv.innerHTML = html;
              }
            } catch (error) {
              console.error('Failed to load recent searches:', error);
            }
          }

          async function loadSearch(searchId) {
            const resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '<div class="loading">Loading search results...</div>';

            try {
              const response = await fetch(\`/api/beta/gleif-search/search/\${searchId}\`);
              const result = await response.json();

              if (result.success) {
                displayResults(result.data);
                
                // Update form fields
                document.getElementById('suspectedName').value = result.data.searchRequest.suspectedName;
                document.getElementById('domain').value = result.data.searchRequest.domain || '';
              } else {
                resultsDiv.innerHTML = \`<div class="error">Error: \${result.error}</div>\`;
              }
            } catch (error) {
              resultsDiv.innerHTML = \`<div class="error">Network error: \${error.message}</div>\`;
            }
          }

          // Load recent searches on page load
          loadRecentSearches();
        </script>
      </body>
      </html>
    `);
  } else {
    // Return API info for non-browser requests
    res.json({
      service: 'GLEIF Search',
      endpoints: [
        'POST /search - Search for GLEIF entities',
        'GET /search/:id - Get search result by ID',
        'GET /searches - List recent searches',
        'DELETE /cleanup - Clean up old searches',
        'GET /health - Health check'
      ]
    });
  }
});

export default router;