import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface DumpResult {
  success: boolean;
  domain: string;
  data?: any;
  error?: string;
  processingTime: number;
}

export class PlaywrightDumper {
  private browser: Browser | null = null;

  async initialize() {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[Beta v2] Playwright browser initialized');
    } catch (error) {
      console.error('[Beta v2] Failed to initialize browser:', error);
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async dumpDomain(domain: string): Promise<DumpResult> {
    const startTime = Date.now();
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      if (!this.browser) {
        await this.initialize();
      }

      // Ensure domain has protocol
      const url = domain.startsWith('http') ? domain : `https://${domain}`;

      // Create context with user agent
      context = await this.browser!.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
      });

      page = await context.newPage();

      // Navigate and wait for load
      console.log(`[Beta v2] Navigating to ${url}`);
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Collect comprehensive data
      const rawData = {
        url,
        timestamp: new Date().toISOString(),
        
        // HTML content
        html: await page.content(),
        
        // Page title and metadata
        title: await page.title(),
        
        // Take screenshot
        screenshot: await page.screenshot({ 
          fullPage: true, 
          type: 'jpeg',
          quality: 80
        }).then(buffer => buffer.toString('base64')),
        
        // Get all text content
        textContent: await page.evaluate(() => document.body?.innerText || ''),
        
        // Collect links
        links: await page.evaluate(() => 
          Array.from(document.querySelectorAll('a[href]'))
            .map(a => ({ 
              text: a.textContent?.trim() || '', 
              href: a.getAttribute('href') || '' 
            }))
            .filter(link => link.href)
        ),
        
        // Collect images
        images: await page.evaluate(() =>
          Array.from(document.querySelectorAll('img'))
            .map(img => ({
              src: img.src,
              alt: img.alt || '',
              width: img.width,
              height: img.height
            }))
        ),
        
        // Meta tags
        metaTags: await page.evaluate(() => {
          const metas: any = {};
          document.querySelectorAll('meta').forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
            const content = meta.getAttribute('content') || '';
            if (name && content) {
              metas[name] = content;
            }
          });
          return metas;
        }),
        
        // Console logs
        consoleLogs: [] as any[]
      };

      // Collect console logs
      page.on('console', msg => {
        rawData.consoleLogs.push({
          type: msg.type(),
          text: msg.text()
        });
      });

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        domain,
        data: rawData,
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      console.error(`[Playwright Dump] Error dumping ${domain}:`, error);

      return {
        success: false,
        domain,
        error: error.message,
        processingTime
      };
    } finally {
      if (page) await page.close();
      if (context) await context.close();
    }
  }
}

// Singleton instance
const dumper = new PlaywrightDumper();

// Simple export function for federated architecture
export async function playwrightDump(domain: string): Promise<DumpResult> {
  return dumper.dumpDomain(domain);
}

// Export for cleanup on shutdown
export async function cleanupPlaywright() {
  return dumper.cleanup();
}