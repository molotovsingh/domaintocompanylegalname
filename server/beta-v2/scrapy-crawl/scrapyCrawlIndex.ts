import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { insertScrapyCrawl, updateScrapyCrawlStatus, executeBetaV2Query } from '../database.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Serve the Scrapy crawl UI
router.get('/', async (req, res) => {
  try {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const html = await fs.readFile(htmlPath, 'utf-8');
    res.send(html);
  } catch (error) {
    console.error('[Beta v2] Error serving scrapy HTML:', error);
    res.status(500).send('Error loading scrapy crawl interface');
  }
});

// API endpoint to crawl a domain
router.post('/api/crawl', async (req, res) => {
  const { domain, crawlDepth = 2, maxPages = 100, focusAreas = ['about', 'legal', 'terms', 'privacy', 'contact', 'investor'] } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  console.log(`[Beta v2] Starting crawl for ${domain} using scrapy-crawl`);
  const startTime = Date.now();

  try {
    // Insert initial record
    const crawlId = await insertScrapyCrawl(domain);
    
    // For now, we'll simulate Scrapy crawl with a Python script
    // In production, this would run actual Scrapy spider
    const crawlData = await performScrapyCrawl(domain, { crawlDepth, maxPages, focusAreas });
    
    const processingTime = Date.now() - startTime;
    
    // Update with results
    await updateScrapyCrawlStatus(crawlId, 'completed', crawlData, processingTime);
    
    res.json({
      success: true,
      crawlId,
      domain,
      processingTime,
      summary: {
        pagesDiscovered: crawlData.siteMap?.length || 0,
        entitiesFound: crawlData.entities?.length || 0,
        legalDocsFound: crawlData.legalDocuments?.length || 0,
        geographicMarkers: crawlData.geographicPresence?.length || 0
      }
    });
    
  } catch (error) {
    console.error(`[Beta v2] Scrapy crawl error for ${domain}:`, error);
    
    try {
      const crawlId = await insertScrapyCrawl(domain);
      await updateScrapyCrawlStatus(crawlId, 'failed', null, Date.now() - startTime, (error as Error).message);
    } catch (dbError) {
      console.error('[Beta v2] Database error:', dbError);
    }
    
    res.status(500).json({
      success: false,
      error: (error as Error).message || 'Crawl failed'
    });
  }
});

// API endpoint to get raw data
router.get('/api/raw-data/:crawlId', async (req, res) => {
  const { crawlId } = req.params;
  
  try {
    const result = await executeBetaV2Query(
      'SELECT raw_data FROM scrapy_crawls WHERE id = $1',
      [parseInt(crawlId)]
    );
    
    if (result.rows.length > 0) {
      res.json({
        success: true,
        data: result.rows[0].raw_data
      });
    } else {
      res.status(404).json({ error: 'Crawl data not found' });
    }
  } catch (error) {
    console.error('[Beta v2] Error fetching raw data:', error);
    res.status(500).json({ error: 'Failed to fetch raw data' });
  }
});

// Simulated Scrapy crawl function
async function performScrapyCrawl(domain: string, options: any) {
  console.log(`[Beta v2] Performing Scrapy crawl for ${domain}`);
  
  // Create a Python script to do basic crawling
  const pythonScript = `
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json
import re
import time

def crawl_site(domain, max_depth=2, max_pages=100, focus_areas=None):
    if focus_areas is None:
        focus_areas = ['about', 'legal', 'terms', 'privacy', 'contact', 'investor']
    
    base_url = f"https://{domain}"
    visited = set()
    to_visit = [(base_url, 0)]
    site_map = []
    entities = []
    legal_documents = []
    geographic_presence = []
    
    # Common legal entity patterns
    entity_patterns = [
        r'\\b(?:Inc|LLC|Ltd|Corporation|Corp|Company|Co|GmbH|SA|SAS|SpA|Pty|PLC|LP|LLP)\\b\\.?',
        r'©\\s*\\d{4}\\s*([^\\n\\r.]+)',
        r'(?:Copyright|©).*?\\b(\\w+(?:\\s+\\w+)*(?:\\s+(?:Inc|LLC|Ltd|Corp|Company|Co))\\.?)\\b'
    ]
    
    # Geographic patterns
    geo_patterns = {
        'addresses': r'\\d+\\s+[A-Za-z\\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\\b',
        'phone': r'\\+?\\d{1,3}[-\\s.]?\\(?\\d{1,4}\\)?[-\\s.]?\\d{1,4}[-\\s.]?\\d{1,4}',
        'postal_codes': r'\\b\\d{5}(?:-\\d{4})?\\b|\\b[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d\\b',
        'countries': r'\\b(?:United States|USA|UK|United Kingdom|Canada|Germany|France|Japan|China|India|Brazil|Australia)\\b'
    }
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (compatible; ScrapyCrawl/1.0; +http://example.com/bot)'
    })
    
    while to_visit and len(visited) < max_pages:
        current_url, depth = to_visit.pop(0)
        
        if current_url in visited or depth > max_depth:
            continue
            
        try:
            response = session.get(current_url, timeout=10)
            if response.status_code != 200:
                continue
                
            visited.add(current_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract page info
            page_info = {
                'url': current_url,
                'title': soup.title.string if soup.title else '',
                'depth': depth,
                'is_focus_page': any(focus in current_url.lower() for focus in focus_areas)
            }
            
            # Extract text content for focus pages
            if page_info['is_focus_page']:
                text_content = soup.get_text(separator=' ', strip=True)
                page_info['content_preview'] = text_content[:1000]
                
                # Look for entities
                for pattern in entity_patterns:
                    matches = re.findall(pattern, text_content, re.IGNORECASE)
                    entities.extend([{'entity': m, 'source': current_url, 'pattern': pattern} for m in matches if isinstance(m, str)])
                
                # Look for geographic markers
                for marker_type, pattern in geo_patterns.items():
                    matches = re.findall(pattern, text_content)
                    if matches:
                        geographic_presence.append({
                            'type': marker_type,
                            'values': list(set(matches[:5])),  # Limit to 5 unique
                            'source': current_url
                        })
                
                # Check if it's a legal document
                if any(term in current_url.lower() for term in ['terms', 'privacy', 'legal', 'policy']):
                    legal_documents.append({
                        'url': current_url,
                        'type': 'legal',
                        'title': page_info['title']
                    })
            
            site_map.append(page_info)
            
            # Find links
            if depth < max_depth:
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(current_url, href)
                    
                    # Only follow internal links
                    if urlparse(full_url).netloc == urlparse(base_url).netloc:
                        to_visit.append((full_url, depth + 1))
            
            time.sleep(0.5)  # Be polite
            
        except Exception as e:
            print(f"Error crawling {current_url}: {e}")
            continue
    
    # Deduplicate entities
    unique_entities = []
    seen = set()
    for entity in entities:
        entity_text = entity['entity'].strip()
        if entity_text and entity_text not in seen:
            seen.add(entity_text)
            unique_entities.append(entity)
    
    return {
        'siteMap': site_map,
        'entities': unique_entities[:20],  # Top 20 entities
        'legalDocuments': legal_documents,
        'geographicPresence': geographic_presence,
        'crawlStats': {
            'pagesVisited': len(visited),
            'maxDepthReached': max(p['depth'] for p in site_map) if site_map else 0,
            'focusPagesFound': len([p for p in site_map if p.get('is_focus_page', False)])
        }
    }

# Run the crawl
result = crawl_site("${domain}", ${options.crawlDepth}, ${options.maxPages}, ${JSON.stringify(options.focusAreas)})
print(json.dumps(result))
`;

  // Write Python script to temp file
  const tempFile = `/tmp/scrapy_crawl_${Date.now()}.py`;
  await fs.writeFile(tempFile, pythonScript);
  
  try {
    // Execute Python script with better error handling
    const { stdout, stderr } = await execAsync(`python3 ${tempFile} 2>&1`);
    
    console.log('[Beta v2] Python output:', stdout.substring(0, 500));
    
    if (stderr) {
      console.error('[Beta v2] Python stderr:', stderr);
    }
    
    // Try to find JSON in the output
    let result;
    try {
      // Sometimes Python output includes warnings before JSON
      const jsonMatch = stdout.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(stdout);
      }
    } catch (parseError) {
      console.error('[Beta v2] Failed to parse Python output:', stdout);
      throw new Error('Python script did not return valid JSON');
    }
    
    // Clean up
    await fs.unlink(tempFile).catch(() => {});
    
    return result;
  } catch (error) {
    // Clean up
    await fs.unlink(tempFile).catch(() => {});
    console.error('[Beta v2] Python execution error:', error);
    throw error;
  }
}

export default router;