
import { DomainExtractor } from './domainExtractor';
import puppeteer from 'puppeteer';

export interface SmokeTestResult {
  domain: string;
  method: 'axios_cheerio' | 'puppeteer' | 'playwright';
  companyName: string | null;
  confidence: number;
  processingTime: number;
  success: boolean;
  error?: string;
  extractionMethod?: string;
  connectivity?: string;
  failureCategory?: string;
  recommendation?: string;
  technicalDetails?: string;
}

export class SmokeTestService {
  private domainExtractor: DomainExtractor;
  private browser: any = null;

  constructor() {
    this.domainExtractor = new DomainExtractor();
  }

  async initializePuppeteer() {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        });
        console.log('Puppeteer browser launched successfully');
      } catch (error) {
        console.error('Failed to launch Puppeteer:', error);
        throw new Error('Puppeteer initialization failed');
      }
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Puppeteer browser closed');
    }
  }

  async testWithAxiosCheerio(domain: string): Promise<SmokeTestResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${domain} with Axios/Cheerio`);
      const result = await this.domainExtractor.extractCompanyName(domain);
      const processingTime = Date.now() - startTime;

      return {
        domain,
        method: 'axios_cheerio',
        companyName: result.companyName,
        confidence: result.confidence || 0,
        processingTime,
        success: !!result.companyName,
        extractionMethod: result.method,
        connectivity: result.connectivity,
        failureCategory: result.failureCategory,
        recommendation: result.recommendation,
        error: result.error
      };
    } catch (error) {
      return {
        domain,
        method: 'axios_cheerio',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testWithPuppeteer(domain: string): Promise<SmokeTestResult> {
    const startTime = Date.now();
    
    try {
      await this.initializePuppeteer();
      console.log(`Testing ${domain} with Puppeteer`);
      
      const page = await this.browser.newPage();
      
      // Set reasonable timeouts
      await page.setDefaultTimeout(15000);
      await page.setDefaultNavigationTimeout(15000);
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to the page
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);
      
      // Extract company information using multiple strategies
      const extractionResult = await page.evaluate(() => {
        // Strategy 1: Footer copyright extraction
        const footerSelectors = [
          'footer',
          '.footer',
          '#footer',
          '[class*="footer"]',
          '.copyright',
          '[class*="copyright"]'
        ];
        
        let footerText = '';
        for (const selector of footerSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            footerText += ' ' + el.textContent;
          });
        }
        
        // Look for copyright patterns
        const copyrightPatterns = [
          /©\s*\d{4}[^A-Za-z]*([A-Z][a-zA-Z\s&,.'-]+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL))/i,
          /copyright\s*©?\s*\d{4}[^A-Za-z]*([A-Z][a-zA-Z\s&,.'-]+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL))/i
        ];
        
        for (const pattern of copyrightPatterns) {
          const match = footerText.match(pattern);
          if (match && match[1]) {
            const companyName = match[1].trim()
              .replace(/^\s*-\s*/, '')
              .replace(/\s*all rights reserved.*$/i, '')
              .replace(/\s*\.\s*$/, '')
              .trim();
            
            if (companyName.length > 3 && companyName.length < 80) {
              return {
                companyName,
                method: 'puppeteer_footer_copyright',
                confidence: 85,
                source: 'footer'
              };
            }
          }
        }
        
        // Strategy 2: Title extraction
        const title = document.title;
        if (title) {
          const cleanTitle = title
            .replace(/\s*[-|–]\s*.*$/, '')
            .replace(/\s*\|\s*.*$/, '')
            .replace(/^\s*Welcome to\s*/i, '')
            .trim();
          
          if (cleanTitle.length > 3 && cleanTitle.length < 50) {
            return {
              companyName: cleanTitle,
              method: 'puppeteer_title',
              confidence: 60,
              source: 'title'
            };
          }
        }
        
        // Strategy 3: About us section
        const aboutSelectors = [
          'section[class*="about"]',
          '.about-section',
          '#about',
          '[class*="company-info"]'
        ];
        
        for (const selector of aboutSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent || '';
            const aboutPattern = /(?:we are|about)\s+([A-Z][a-zA-Z\s&,.'-]+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Limited|Company|Co\.?))/i;
            const match = text.match(aboutPattern);
            if (match && match[1]) {
              return {
                companyName: match[1].trim(),
                method: 'puppeteer_about',
                confidence: 75,
                source: 'about'
              };
            }
          }
        }
        
        // Strategy 4: Meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          const content = metaDesc.getAttribute('content') || '';
          const words = content.split(/\s+/).slice(0, 5);
          if (words.length >= 2) {
            const potential = words.join(' ').trim();
            if (potential.length > 3 && potential.length < 40) {
              return {
                companyName: potential,
                method: 'puppeteer_meta',
                confidence: 50,
                source: 'meta'
              };
            }
          }
        }
        
        return {
          companyName: null,
          method: 'puppeteer_failed',
          confidence: 0,
          source: 'none'
        };
      });
      
      await page.close();
      const processingTime = Date.now() - startTime;
      
      return {
        domain,
        method: 'puppeteer',
        companyName: extractionResult.companyName,
        confidence: extractionResult.confidence,
        processingTime,
        success: !!extractionResult.companyName,
        extractionMethod: extractionResult.method,
        technicalDetails: `Extracted from ${extractionResult.source}`
      };
      
    } catch (error) {
      console.error(`Puppeteer test failed for ${domain}:`, error);
      return {
        domain,
        method: 'puppeteer',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        technicalDetails: 'Puppeteer navigation or extraction failed'
      };
    }
  }

  async testWithPlaywright(domain: string): Promise<SmokeTestResult> {
    // Placeholder for Playwright implementation
    return {
      domain,
      method: 'playwright',
      companyName: null,
      confidence: 0,
      processingTime: 0,
      success: false,
      error: 'Playwright not implemented yet'
    };
  }

  async runSingleTest(domain: string, method: SmokeTestResult['method']): Promise<SmokeTestResult> {
    console.log(`Running smoke test: ${domain} with ${method}`);
    
    switch (method) {
      case 'axios_cheerio':
        return await this.testWithAxiosCheerio(domain);
      case 'puppeteer':
        return await this.testWithPuppeteer(domain);
      case 'playwright':
        return await this.testWithPlaywright(domain);
      default:
        throw new Error(`Unknown test method: ${method}`);
    }
  }

  async runComparison(domain: string): Promise<{
    axiosResult: SmokeTestResult;
    puppeteerResult: SmokeTestResult;
    winner: string;
    analysis: string;
  }> {
    console.log(`Running comparison test for ${domain}`);
    
    const [axiosResult, puppeteerResult] = await Promise.all([
      this.testWithAxiosCheerio(domain),
      this.testWithPuppeteer(domain)
    ]);
    
    // Determine winner
    let winner = 'Both Failed';
    if (axiosResult.success && !puppeteerResult.success) {
      winner = 'Axios/Cheerio';
    } else if (!axiosResult.success && puppeteerResult.success) {
      winner = 'Puppeteer';
    } else if (axiosResult.success && puppeteerResult.success) {
      const axiosScore = axiosResult.confidence + (axiosResult.processingTime < 2000 ? 20 : 0);
      const puppeteerScore = puppeteerResult.confidence + (puppeteerResult.processingTime < 5000 ? 10 : 0);
      
      if (axiosScore > puppeteerScore) {
        winner = 'Axios/Cheerio';
      } else if (puppeteerScore > axiosScore) {
        winner = 'Puppeteer';
      } else {
        winner = 'Tie';
      }
    }
    
    // Generate analysis
    const analyses: string[] = [];
    if (axiosResult.success && puppeteerResult.success) {
      analyses.push('Both methods succeeded');
      if (Math.abs(axiosResult.confidence - puppeteerResult.confidence) > 20) {
        analyses.push('Significant confidence difference');
      }
      if (puppeteerResult.processingTime > axiosResult.processingTime * 3) {
        analyses.push('Puppeteer significantly slower');
      }
    }
    
    if (!axiosResult.success && puppeteerResult.success) {
      analyses.push('Puppeteer bypassed protection/issues');
    }
    
    if (axiosResult.success && !puppeteerResult.success) {
      analyses.push('Axios sufficient for this domain');
    }
    
    if (axiosResult.connectivity === 'protected' || axiosResult.error?.includes('cloudflare')) {
      analyses.push('Anti-bot protection detected');
    }
    
    const analysis = analyses.length > 0 ? analyses.join('; ') : 'Standard extraction case';
    
    return {
      axiosResult,
      puppeteerResult,
      winner,
      analysis
    };
  }
}
