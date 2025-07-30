import { CheerioCrawler, PlaywrightCrawler, Dataset, RequestQueue } from 'crawlee';
import type { CrawlConfig, CrawleeDumpData, PageData, NetworkRequest } from './crawleeDumpTypes';
import { CrawleeDumpStorage } from './crawleeDumpStorage';

export class CrawleeDumpService {
  private storage: CrawleeDumpStorage;

  constructor() {
    this.storage = new CrawleeDumpStorage();
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
    
    // Create Cheerio crawler for basic crawling
    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: config.maxPages || 10,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 30,
      
      // Request options
      requestHandler: async ({ request, response, $, enqueueLinks }) => {
        try {
          const html = $.html();
          const text = $.text();
          
          // Get current URL depth
          const currentDepth = urlDepths.get(request.url) || 0;
          
          // Collect page data
          const pageData: PageData = {
            url: request.url,
            html: html,
            text: text.substring(0, 50000), // Limit text size
            statusCode: response.statusCode || 200,
            headers: response.headers as Record<string, string>,
            cookies: [], // Crawlee doesn't expose cookies easily
            timestamp: Date.now(),
            depth: currentDepth // Add depth to page data
          };
          
          pages.push(pageData);
          totalSizeBytes += Buffer.byteLength(html, 'utf8');
          
          // Collect all links
          const foundLinks: { url: string; text: string }[] = [];
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
              } else {
                externalLinks.add(absoluteUrl);
              }
            } catch (e) {
              // Invalid URL
            }
          });
          
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
      }
    };
    
    // Update database with results
    await this.storage.updateDumpData(dumpId, dumpData, processingTimeMs);
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
        try {
          
          // Wait for page to load
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          
          const html = await page.content();
          const text = await page.evaluate(() => document.body?.innerText || '');
          const currentDepth = urlDepths.get(request.url) || 0;
          
          // Collect cookies
          const cookies = await page.context().cookies();
          
          const pageData: PageData = {
            url: request.url,
            html: html,
            text: text.substring(0, 50000),
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
          
          pages.push(pageData);
          totalSizeBytes += Buffer.byteLength(html, 'utf8');
          
          // Collect links
          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors.map(a => ({
              url: (a as HTMLAnchorElement).href,
              text: (a as HTMLAnchorElement).textContent?.trim() || ''
            }));
          });
          
          const foundLinks: { url: string; text: string }[] = [];
          links.forEach(link => {
            try {
              const linkUrl = new URL(link.url);
              const currentDomain = new URL(request.url).hostname;
              
              if (linkUrl.hostname === currentDomain) {
                internalLinks.add(link.url);
                foundLinks.push(link);
              } else {
                externalLinks.add(link.url);
              }
            } catch (e) {
              // Invalid URL
            }
          });
          
          // Enqueue more links if within depth limit
          const maxDepth = config.maxDepth || 2;
          if (currentDepth < maxDepth && pages.length < (config.maxPages || 10)) {
            const priorityLinks = foundLinks.filter(link => {
              const url = link.url.toLowerCase();
              const text = link.text.toLowerCase();
              
              return url.includes('/about') || url.includes('/company') || 
                     url.includes('/legal') || url.includes('/terms') ||
                     url.includes('/contact') || url.includes('/team') ||
                     text.includes('about') || text.includes('company') ||
                     text.includes('legal') || text.includes('contact');
            });
            
            const linksToEnqueue = [...priorityLinks, ...foundLinks]
              .slice(0, 10)
              .map(link => link.url);
            
            for (const linkUrl of linksToEnqueue) {
              if (!urlDepths.has(linkUrl)) {
                urlDepths.set(linkUrl, currentDepth + 1);
              }
            }
            
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
}