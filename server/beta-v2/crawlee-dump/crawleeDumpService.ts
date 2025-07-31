import { CheerioCrawler, PlaywrightCrawler, Dataset, RequestQueue, Configuration } from 'crawlee';
import type { CrawlConfig, CrawleeDumpData, PageData, NetworkRequest, CleanedPageData } from './crawleeDumpTypes';
import { CrawleeDumpStorage } from './crawleeDumpStorage';
import { randomUUID } from 'crypto';
import { LLMCleaningService } from '../../services/llmCleaningService';

export class CrawleeDumpService {
  private storage: CrawleeDumpStorage;
  private cleaningService: LLMCleaningService;

  constructor() {
    this.storage = new CrawleeDumpStorage();
    this.cleaningService = new LLMCleaningService();
  }

  async startDump(domain: string, config: CrawlConfig): Promise<number> {
    // Create database entry
    const dumpId = await this.storage.createDump(domain, config);
    
    // Start crawling in background
    this.crawlSite(dumpId, domain, config)
      .catch(error => {
        console.error('[Crawlee] Crawl error:', error);
        this.storage.updateDumpStatus(dumpId, 'failed', error.message);
      });
    
    return dumpId;
  }

  private async crawlSite(dumpId: number, domain: string, config: CrawlConfig): Promise<void> {
    const startTime = Date.now();
    
    // Update status to processing
    await this.storage.updateDumpStatus(dumpId, 'processing');
    
    // Normalize domain to URL
    let normalizedDomain = domain.trim();
    if (!normalizedDomain.startsWith('http://') && !normalizedDomain.startsWith('https://')) {
      normalizedDomain = normalizedDomain.replace(/^www\./, '');
    }
    const startUrl = domain.startsWith('http') ? domain : `https://${normalizedDomain}`;
    
    // Collected data
    const pages: PageData[] = [];
    const requests: NetworkRequest[] = [];
    const internalLinks = new Set<string>();
    const externalLinks = new Set<string>();
    
    let totalSizeBytes = 0;
    const errors: string[] = [];
    
    // Track depth for each URL
    const urlDepths = new Map<string, number>();
    urlDepths.set(startUrl, 0);
    
    // Use Playwright crawler if network capture is needed
    console.log('[Crawlee] Config:', JSON.stringify(config));
    const usePlaywright = config.captureNetworkRequests === true;
    
    if (usePlaywright) {
      // Use Playwright for network capture
      console.log('[Crawlee] Using Playwright crawler for network capture');
      await this.crawlWithPlaywright(dumpId, startUrl, normalizedDomain, config, pages, requests, internalLinks, externalLinks, urlDepths, errors);
      return;
    }
    
    console.log('[Crawlee] Using Cheerio crawler (captureNetworkRequests:', config.captureNetworkRequests, ')');
    
    // Create unique configuration to isolate each crawl
    const crawlId = randomUUID();
    const crawlerConfig = Configuration.getGlobalConfig();
    crawlerConfig.set('defaultDatasetId', `dataset-${crawlId}`);
    crawlerConfig.set('defaultRequestQueueId', `queue-${crawlId}`);
    
    // Create Cheerio crawler for basic crawling
    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: config.maxPages || 10,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 30,
      
      // Request options
      requestHandler: async ({ request, response, $, enqueueLinks }) => {
        console.log(`[Crawlee] Processing ${request.url}`);
        try {
          const html = $.html();
          const text = $.text();
          
          // Get current URL depth
          const currentDepth = urlDepths.get(request.url) || 0;
          
          // Extract metadata (lightweight, using already-parsed DOM)
          const title = $('title').text().trim() || undefined;
          
          // Extract meta tags
          const metaTags: Record<string, string> = {};
          $('meta[name], meta[property]').each((_, el) => {
            const name = $(el).attr('name') || $(el).attr('property');
            const content = $(el).attr('content');
            if (name && content) {
              metaTags[name] = content;
            }
          });
          
          // Extract structured data (JSON-LD)
          const structuredData: any[] = [];
          $('script[type="application/ld+json"]').each((_, el) => {
            try {
              const jsonText = $(el).html();
              if (jsonText) {
                structuredData.push(JSON.parse(jsonText));
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          });
          
          // Collect page data
          const pageData: PageData = {
            url: request.url,
            html: html,
            text: text.substring(0, 50000), // Limit text size
            title,
            metaTags: Object.keys(metaTags).length > 0 ? metaTags : undefined,
            links: [], // Will be filled below
            structuredData: structuredData.length > 0 ? structuredData : undefined,
            statusCode: response.statusCode || 200,
            headers: response.headers as Record<string, string>,
            cookies: [], // Crawlee doesn't expose cookies easily
            timestamp: Date.now(),
            depth: currentDepth // Add depth to page data
          };
          
          // Collect all links
          const foundLinks: { url: string; text: string }[] = [];
          const pageLinks: Array<{ url: string; text: string; type: 'internal' | 'external' }> = [];
          
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const linkText = $(el).text().trim();
            if (!href) return;
            
            try {
              const absoluteUrl = new URL(href, request.url).toString();
              const linkDomain = new URL(absoluteUrl).hostname;
              const currentDomain = new URL(request.url).hostname;
              
              if (linkDomain === currentDomain) {
                internalLinks.add(absoluteUrl);
                foundLinks.push({ url: absoluteUrl, text: linkText });
                pageLinks.push({ url: absoluteUrl, text: linkText, type: 'internal' });
              } else {
                externalLinks.add(absoluteUrl);
                pageLinks.push({ url: absoluteUrl, text: linkText, type: 'external' });
              }
            } catch (e) {
              // Invalid URL
            }
          });
          
          // Update pageData with links
          pageData.links = pageLinks;
          
          pages.push(pageData);
          totalSizeBytes += Buffer.byteLength(html, 'utf8');
          
          // Enqueue more links if within depth limit
          const maxDepth = config.maxDepth || 2;
          if (currentDepth < maxDepth && pages.length < (config.maxPages || 10)) {
            // Prioritize interesting links
            const priorityLinks = foundLinks.filter(link => {
              const url = link.url.toLowerCase();
              const text = link.text.toLowerCase();
              
              // Priority patterns for company information
              return url.includes('/about') || url.includes('/company') || 
                     url.includes('/legal') || url.includes('/terms') ||
                     url.includes('/contact') || url.includes('/team') ||
                     text.includes('about') || text.includes('company') ||
                     text.includes('legal') || text.includes('contact');
            });
            
            // Enqueue prioritized links first, then others
            const linksToEnqueue = [...priorityLinks, ...foundLinks]
              .slice(0, 10) // Limit links per page
              .map(link => link.url);
            
            for (const linkUrl of linksToEnqueue) {
              // Track depth for new URLs
              if (!urlDepths.has(linkUrl)) {
                urlDepths.set(linkUrl, currentDepth + 1);
              }
            }
            
            await enqueueLinks({
              urls: linksToEnqueue,
              transformRequestFunction: (req) => {
                // Apply path filters
                if (config.includePaths?.length) {
                  const hasInclude = config.includePaths.some(path => 
                    req.url.includes(path)
                  );
                  if (!hasInclude) return false;
                }
                
                if (config.excludePaths?.length) {
                  const hasExclude = config.excludePaths.some(path => 
                    req.url.includes(path)
                  );
                  if (hasExclude) return false;
                }
                
                return req;
              }
            });
          }
        } catch (error) {
          errors.push(`${request.url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      
      failedRequestHandler: async ({ request, error }) => {
        errors.push(`${request.url}: ${error instanceof Error ? error.message : String(error)}`);
      },
      
      // Wait between requests
      minConcurrency: 1,
      maxConcurrency: 2,
      
      preNavigationHooks: [
        async (crawlingContext, requestAsBrowserOptions) => {
          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, config.waitTime || 1000));
        }
      ]
    });
    
    // Run the crawler
    await crawler.run([startUrl]);
    
    const processingTimeMs = Date.now() - startTime;
    
    // Clean pages with LLM service
    console.log('[Crawlee] Starting LLM cleaning for', pages.length, 'pages');
    const cleaningStartTime = Date.now();
    const cleanedPages = await this.cleanPages(pages);
    const totalCleaningTimeMs = Date.now() - cleaningStartTime;
    console.log('[Crawlee] LLM cleaning completed in', totalCleaningTimeMs, 'ms');
    
    // Prepare dump data
    const dumpData: CrawleeDumpData = {
      pages,
      requests, // Note: Cheerio crawler doesn't capture network requests
      siteMap: {
        internalLinks: Array.from(internalLinks),
        externalLinks: Array.from(externalLinks).slice(0, 100), // Limit external links
        sitemapXml: undefined,
        robotsTxt: undefined
      },
      crawlStats: {
        pagesCrawled: pages.length,
        totalSizeBytes,
        timeTakenMs: processingTimeMs,
        errors
      },
      cleanedPages,
      totalCleaningTimeMs
    };
    
    // Update database with results
    await this.storage.updateDumpData(dumpId, dumpData, processingTimeMs);
    
    // Clean up datasets and queues to prevent state pollution
    try {
      const dataset = await Dataset.open(`dataset-${crawlId}`);
      await dataset.drop();
      const queue = await RequestQueue.open(`queue-${crawlId}`);
      await queue.drop();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  private async crawlWithPlaywright(
    dumpId: number,
    startUrl: string,
    domain: string,
    config: CrawlConfig,
    pages: PageData[],
    requests: NetworkRequest[],
    internalLinks: Set<string>,
    externalLinks: Set<string>,
    urlDepths: Map<string, number>,
    errors: string[]
  ): Promise<void> {
    const startTime = Date.now();
    let totalSizeBytes = 0;
    
    console.log(`[Crawlee] Starting Playwright crawler for ${startUrl}`);
    
    const crawler = new PlaywrightCrawler({
      maxRequestsPerCrawl: config.maxPages || 10,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 30,
      launchContext: {
        launchOptions: {
          headless: true,
        },
      },
      
      preNavigationHooks: [
        async (crawlingContext, gotoOptions) => {
          const { page } = crawlingContext;
          
          // Set up network request capture before navigation
          page.on('response', async (res) => {
            try {
              const req = res.request();
              const responseBody = await res.body().catch(() => Buffer.from(''));
              const networkRequest: NetworkRequest = {
                url: res.url(),
                method: req.method(),
                statusCode: res.status(),
                headers: res.headers(),
                responseSize: responseBody.length,
                timestamp: Date.now()
              };
              requests.push(networkRequest);
              console.log(`[Crawlee] Captured network request: ${res.url()} (${res.status()})`);
            } catch (e) {
              // Ignore errors in network capture
              console.error(`[Crawlee] Error capturing network request:`, e);
            }
          });
        }
      ],
      
      requestHandler: async ({ request, response, page, enqueueLinks }) => {
        console.log(`[Crawlee] Processing ${request.url} with Playwright`);
        
        // Check if this is a duplicate based on normalized URL
        const currentUrlObj = new URL(request.url);
        const normalizedCurrentPath = currentUrlObj.pathname
          .replace(/\/$/, '')
          .replace(/\/index\.(html?|php)$/i, '');
        const normalizedCurrentUrl = `${currentUrlObj.protocol}//${currentUrlObj.host}${normalizedCurrentPath || '/'}`;
        
        // Skip if already processed a normalized version
        if (pages.some(p => {
          const pageUrl = new URL(p.url);
          const pageNormalized = `${pageUrl.protocol}//${pageUrl.host}${pageUrl.pathname.replace(/\/$/, '').replace(/\/index\.(html?|php)$/i, '') || '/'}`;
          return pageNormalized === normalizedCurrentUrl && p.url !== request.url;
        })) {
          console.log(`[Crawlee] Skipping duplicate: ${request.url} (normalized: ${normalizedCurrentUrl})`);
          return;
        }
        
        try {
          
          // Wait for page to load
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          const html = await page.content();
          const text = await page.evaluate(() => document.body?.innerText || '');
          const currentDepth = urlDepths.get(request.url) || 0;
          
          // Extract metadata using Playwright
          const metadata = await page.evaluate(() => {
            // Extract title
            const title = document.title?.trim() || undefined;
            
            // Extract meta tags
            const metaTags: Record<string, string> = {};
            document.querySelectorAll('meta[name], meta[property]').forEach(meta => {
              const name = meta.getAttribute('name') || meta.getAttribute('property');
              const content = meta.getAttribute('content');
              if (name && content) {
                metaTags[name] = content;
              }
            });
            
            // Extract structured data
            const structuredData: any[] = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
              try {
                const jsonText = script.textContent;
                if (jsonText) {
                  structuredData.push(JSON.parse(jsonText));
                }
              } catch (e) {
                // Ignore invalid JSON
              }
            });
            
            return {
              title,
              metaTags: Object.keys(metaTags).length > 0 ? metaTags : undefined,
              structuredData: structuredData.length > 0 ? structuredData : undefined
            };
          });
          
          // Collect cookies
          const cookies = await page.context().cookies();
          
          const pageData: PageData = {
            url: request.url,
            html: html,
            text: text.substring(0, 50000),
            title: metadata.title,
            metaTags: metadata.metaTags,
            links: [], // Will be filled below
            structuredData: metadata.structuredData,
            statusCode: response?.status() || 200,
            headers: response?.headers() || {},
            cookies: cookies.map(c => ({
              name: c.name,
              value: c.value,
              domain: c.domain,
              path: c.path || '/'
            })),
            timestamp: Date.now(),
            depth: currentDepth
          };
          
          // Collect links
          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors.map(a => ({
              url: (a as HTMLAnchorElement).href,
              text: (a as HTMLAnchorElement).textContent?.trim() || ''
            }));
          });
          
          const foundLinks: { url: string; text: string }[] = [];
          const pageLinks: Array<{ url: string; text: string; type: 'internal' | 'external' }> = [];
          
          links.forEach(link => {
            try {
              const linkUrl = new URL(link.url);
              const currentDomain = new URL(request.url).hostname;
              
              if (linkUrl.hostname === currentDomain) {
                internalLinks.add(link.url);
                foundLinks.push(link);
                pageLinks.push({ url: link.url, text: link.text, type: 'internal' });
              } else {
                externalLinks.add(link.url);
                pageLinks.push({ url: link.url, text: link.text, type: 'external' });
              }
            } catch (e) {
              // Invalid URL
            }
          });
          
          // Update pageData with links
          pageData.links = pageLinks;
          
          pages.push(pageData);
          totalSizeBytes += Buffer.byteLength(html, 'utf8');
          
          // Enqueue more links if within depth limit
          const maxDepth = config.maxDepth || 2;
          if (currentDepth < maxDepth && pages.length < (config.maxPages || 10)) {
            // Filter and normalize links
            const uniqueLinks = new Map<string, { url: string; text: string; priority: number }>();
            
            foundLinks.forEach(link => {
              try {
                const linkUrl = new URL(link.url);
                const currentUrl = new URL(request.url);
                
                // Skip if different domain
                if (linkUrl.hostname !== currentUrl.hostname) return;
                
                // Normalize URL
                let normalizedPath = linkUrl.pathname
                  .replace(/\/$/, '') // Remove trailing slash
                  .replace(/\/index\.(html?|php)$/i, ''); // Remove index files
                if (!normalizedPath) normalizedPath = '/';
                
                // Remove tracking parameters
                ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(param => {
                  linkUrl.searchParams.delete(param);
                });
                
                const normalizedUrl = `${linkUrl.protocol}//${linkUrl.host}${normalizedPath}${linkUrl.search}`;
                
                // Skip if already crawled
                if (pages.some(p => {
                  const pageUrl = new URL(p.url);
                  const pageNormalized = `${pageUrl.protocol}//${pageUrl.host}${pageUrl.pathname.replace(/\/$/, '').replace(/\/index\.(html?|php)$/i, '')}`;
                  return pageNormalized === normalizedUrl;
                })) {
                  return;
                }
                
                // Calculate priority
                let priority = 0;
                const urlLower = link.url.toLowerCase();
                const textLower = link.text.toLowerCase();
                
                // High priority patterns
                if (urlLower.includes('/about') || textLower.includes('about')) priority += 3;
                if (urlLower.includes('/company') || textLower.includes('company')) priority += 3;
                if (urlLower.includes('/contact') || textLower.includes('contact')) priority += 2;
                if (urlLower.includes('/products') || urlLower.includes('/services')) priority += 2;
                if (urlLower.includes('/blog') || urlLower.includes('/news')) priority += 1;
                
                // Deprioritize certain patterns
                if (urlLower.includes('#') || urlLower.includes('javascript:')) priority = -10;
                if (urlLower.includes('.pdf') || urlLower.includes('.doc')) priority = -5;
                
                // Store with highest priority
                const existing = uniqueLinks.get(normalizedUrl);
                if (!existing || existing.priority < priority) {
                  uniqueLinks.set(normalizedUrl, { url: link.url, text: link.text, priority });
                }
              } catch (e) {
                // Invalid URL
              }
            });
            
            // Sort by priority and take top links
            const sortedLinks = Array.from(uniqueLinks.values())
              .sort((a, b) => b.priority - a.priority)
              .slice(0, Math.min(10, (config.maxPages || 10) - pages.length));
            
            const linksToEnqueue = sortedLinks.map(link => link.url);
            
            for (const linkUrl of linksToEnqueue) {
              if (!urlDepths.has(linkUrl)) {
                urlDepths.set(linkUrl, currentDepth + 1);
              }
            }
            
            console.log(`[Crawlee] Found ${uniqueLinks.size} unique links, enqueueing ${linksToEnqueue.length}`);
            
            await enqueueLinks({
              urls: linksToEnqueue,
              transformRequestFunction: (req) => {
                if (config.includePaths?.length) {
                  const hasInclude = config.includePaths.some(path => 
                    req.url.includes(path)
                  );
                  if (!hasInclude) return false;
                }
                
                if (config.excludePaths?.length) {
                  const hasExclude = config.excludePaths.some(path => 
                    req.url.includes(path)
                  );
                  if (hasExclude) return false;
                }
                
                return req;
              }
            });
          }
          
          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, config.waitTime || 1000));
        } catch (error) {
          errors.push(`${request.url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      
      failedRequestHandler: async ({ request, error }) => {
        console.error(`[Crawlee] Failed to process ${request.url}:`, error);
        errors.push(`${request.url}: ${error instanceof Error ? error.message : String(error)}`);
      },
      
      minConcurrency: 1,
      maxConcurrency: 1, // Playwright is resource intensive
    });
    
    console.log(`[Crawlee] Running Playwright crawler with start URL: ${startUrl}`);
    console.log(`[Crawlee] Max pages: ${config.maxPages}, Max depth: ${config.maxDepth}`);
    
    try {
      await crawler.run([startUrl]);
    } catch (error) {
      console.error(`[Crawlee] Crawler error:`, error);
      errors.push(`Crawler error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log(`[Crawlee] Playwright crawler finished. Pages: ${pages.length}, Requests: ${requests.length}`);
    
    const processingTimeMs = Date.now() - startTime;
    
    const dumpData: CrawleeDumpData = {
      pages,
      requests,
      siteMap: {
        internalLinks: Array.from(internalLinks),
        externalLinks: Array.from(externalLinks).slice(0, 100),
        sitemapXml: undefined,
        robotsTxt: undefined
      },
      crawlStats: {
        pagesCrawled: pages.length,
        totalSizeBytes,
        timeTakenMs: processingTimeMs,
        errors
      }
    };
    
    await this.storage.updateDumpData(dumpId, dumpData, processingTimeMs);
  }
  
  async getDump(id: number) {
    return this.storage.getDump(id);
  }
  
  async listDumps(limit = 50, offset = 0) {
    return this.storage.listDumps(limit, offset);
  }
  
  async deleteDump(id: number) {
    return this.storage.deleteDump(id);
  }

  // Clean collected pages using LLM service
  private async cleanPages(pages: PageData[]): Promise<CleanedPageData[]> {
    const cleanedPages: CleanedPageData[] = [];
    
    // Process pages in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < pages.length; i += batchSize) {
      const batch = pages.slice(i, i + batchSize);
      
      // Process batch in parallel
      const cleanedBatch = await Promise.all(
        batch.map(async (page) => {
          try {
            const startTime = Date.now();
            const result = await this.cleaningService.cleanHtml({
              url: page.url,
              html: page.html,
              extractedText: page.text
            });
            
            if (result.success && result.cleanedData) {
              return {
                url: page.url,
                companyName: result.cleanedData.companyName,
                addresses: result.cleanedData.addresses || [],
                phones: result.cleanedData.phones || [],
                emails: result.cleanedData.emails || [],
                currencies: result.cleanedData.currencies || [],
                footerLegal: result.cleanedData.footerLegal,
                keyText: result.cleanedData.keyText,
                links: {
                  internal: page.links?.filter(link => link.type === 'internal').map(link => link.url) || [],
                  external: page.links?.filter(link => link.type === 'external').map(link => link.url) || []
                },
                cleaningTimeMs: Date.now() - startTime
              };
            } else {
              // Return minimal cleaned data on error
              return {
                url: page.url,
                addresses: [],
                phones: [],
                emails: [],
                currencies: [],
                links: {
                  internal: page.links?.filter(link => link.type === 'internal').map(link => link.url) || [],
                  external: page.links?.filter(link => link.type === 'external').map(link => link.url) || []
                },
                cleaningTimeMs: 0
              };
            }
          } catch (error) {
            console.error('[Crawlee] Error cleaning page', page.url, error);
            // Return minimal cleaned data on error
            return {
              url: page.url,
              addresses: [],
              phones: [],
              emails: [],
              currencies: [],
              links: {
                internal: [],
                external: []
              },
              cleaningTimeMs: 0
            };
          }
        })
      );
      
      cleanedPages.push(...cleanedBatch);
    }
    
    return cleanedPages;
  }
}