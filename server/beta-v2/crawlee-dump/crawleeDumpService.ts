import { CheerioCrawler, Dataset } from 'crawlee';
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
    const startUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    
    // Collected data
    const pages: PageData[] = [];
    const requests: NetworkRequest[] = [];
    const internalLinks = new Set<string>();
    const externalLinks = new Set<string>();
    
    let totalSizeBytes = 0;
    const errors: string[] = [];
    
    // Create crawler
    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: config.maxPages || 10,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 30,
      
      // Request options
      requestHandler: async ({ request, response, $, enqueueLinks }) => {
        try {
          const html = $.html();
          const text = $.text();
          
          // Collect page data
          const pageData: PageData = {
            url: request.url,
            html: html,
            text: text.substring(0, 50000), // Limit text size
            statusCode: response.statusCode || 200,
            headers: response.headers as Record<string, string>,
            cookies: [], // Crawlee doesn't expose cookies easily
            timestamp: Date.now()
          };
          
          pages.push(pageData);
          totalSizeBytes += Buffer.byteLength(html, 'utf8');
          
          // Collect links
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            const absoluteUrl = new URL(href, request.url).toString();
            const linkDomain = new URL(absoluteUrl).hostname;
            const currentDomain = new URL(request.url).hostname;
            
            if (linkDomain === currentDomain) {
              internalLinks.add(absoluteUrl);
            } else {
              externalLinks.add(absoluteUrl);
            }
          });
          
          // Enqueue more links based on config
          if (pages.length < (config.maxPages || 10)) {
            await enqueueLinks({
              strategy: 'same-domain',
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