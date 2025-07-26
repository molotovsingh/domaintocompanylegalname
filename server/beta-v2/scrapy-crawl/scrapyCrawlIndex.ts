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
  const { domain, crawlDepth = 2, maxPages = 100 } = req.body;
  
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
    const crawlData = await performScrapyCrawl(domain, { crawlDepth, maxPages });
    
    const processingTime = Date.now() - startTime;
    
    // Update with results
    await updateScrapyCrawlStatus(crawlId, 'completed', crawlData, processingTime);
    
    res.json({
      success: true,
      crawlId,
      domain,
      processingTime,
      summary: {
        pagesDiscovered: crawlData.pages?.length || 0,
        totalSize: crawlData.pages?.reduce((sum: number, p: any) => sum + (p.htmlSize || 0), 0) || 0
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
  
  // Create a Python script for raw data dumping
  const pythonScript = `
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import json
import time
import base64

def crawl_site_raw(domain, max_depth=2, max_pages=100):
    base_url = f"https://{domain}"
    visited = set()
    to_visit = [(base_url, 0)]
    pages = []
    
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
            
            # Store raw HTML and metadata
            page_data = {
                'url': current_url,
                'depth': depth,
                'status_code': response.status_code,
                'content_type': response.headers.get('Content-Type', ''),
                'html': response.text,
                'htmlSize': len(response.text),
                'headers': dict(response.headers),
                'crawled_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            # Extract basic metadata without cleaning
            soup = BeautifulSoup(response.text, 'html.parser')
            page_data['title'] = soup.title.string if soup.title else ''
            
            # Extract all text content (raw, no cleaning)
            page_data['text_content'] = soup.get_text()
            
            # Extract all links for crawling
            links = []
            if depth < max_depth:
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    full_url = urljoin(current_url, href)
                    
                    # Only follow internal links
                    if urlparse(full_url).netloc == urlparse(base_url).netloc:
                        to_visit.append((full_url, depth + 1))
                        links.append({
                            'href': href,
                            'full_url': full_url,
                            'text': link.get_text(strip=True)
                        })
            
            page_data['links'] = links
            pages.append(page_data)
            
            time.sleep(0.5)  # Be polite
            
        except Exception as e:
            # Include error pages in the dump
            pages.append({
                'url': current_url,
                'depth': depth,
                'error': str(e),
                'crawled_at': time.strftime('%Y-%m-%d %H:%M:%S')
            })
            continue
    
    return {
        'domain': domain,
        'pages': pages,
        'crawl_stats': {
            'total_pages': len(pages),
            'successful_pages': len([p for p in pages if 'html' in p]),
            'failed_pages': len([p for p in pages if 'error' in p]),
            'total_size': sum(p.get('htmlSize', 0) for p in pages)
        }
    }

# Run the crawl and always return JSON
try:
    result = crawl_site_raw("${domain}", ${options.crawlDepth}, ${options.maxPages})
    print(json.dumps(result))
except Exception as e:
    error_result = {
        'domain': "${domain}",
        'error': str(e),
        'pages': [],
        'crawl_stats': {
            'total_pages': 0,
            'successful_pages': 0,
            'failed_pages': 0,
            'total_size': 0
        }
    }
    print(json.dumps(error_result))
`;

  // Write Python script to temp file
  const tempFile = `/tmp/scrapy_crawl_${Date.now()}.py`;
  await fs.writeFile(tempFile, pythonScript);
  
  try {
    // Execute Python script with UV environment
    const { stdout, stderr } = await execAsync(`cd ${process.cwd()} && uv run python ${tempFile}`, {
      env: { ...process.env }
    });
    
    console.log('[Beta v2] Python stdout length:', stdout.length);
    console.log('[Beta v2] Python stdout preview:', stdout.substring(0, 200));
    
    if (stderr) {
      console.error('[Beta v2] Python stderr:', stderr);
    }
    
    // Parse the result
    const result = JSON.parse(stdout.trim());
    
    // Clean up
    await fs.unlink(tempFile).catch(() => {});
    
    return result;
  } catch (error) {
    // Clean up
    await fs.unlink(tempFile).catch(() => {});
    console.error('[Beta v2] Python execution error:', error);
    
    // If UV fails, try direct python3
    try {
      console.log('[Beta v2] Retrying with direct python3...');
      const { stdout } = await execAsync(`python3 ${tempFile}`);
      return JSON.parse(stdout.trim());
    } catch (fallbackError) {
      console.error('[Beta v2] Fallback also failed:', fallbackError);
      throw error;
    }
  }
}

export default router;