
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
          executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        });
        console.log('Puppeteer browser launched successfully');
      } catch (error) {
        console.error('Failed to launch Puppeteer:', error);
        // Fallback to system detection
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
              '--disable-gpu',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor'
            ]
          });
          console.log('Puppeteer browser launched with fallback configuration');
        } catch (fallbackError) {
          console.error('Fallback Puppeteer launch also failed:', fallbackError);
          throw new Error('Puppeteer initialization failed');
        }
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
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract company information focusing on footer and bottom 10% of page
      const extractionResult = await page.evaluate(() => {
        console.log('🎯 PUPPETEER: Starting footer-focused extraction');
        
        // Get page dimensions to focus on bottom 10%
        const pageHeight = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
        
        const bottom10PercentStart = pageHeight * 0.9;
        console.log(`📏 Page height: ${pageHeight}px, bottom 10% starts at: ${bottom10PercentStart}px`);
        
        // Strategy 1: Targeted footer element extraction
        const footerSelectors = [
          'footer',
          '.footer',
          '#footer',
          '[class*="footer"]',
          '.site-footer',
          '.page-footer',
          '.copyright',
          '[class*="copyright"]',
          '.legal',
          '[class*="legal"]'
        ];
        
        let footerText = '';
        let foundFooterElements = 0;
        
        for (const selector of footerSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const elementTop = rect.top + window.scrollY;
            
            // Only include elements in bottom portion of page
            if (elementTop >= bottom10PercentStart || rect.bottom >= window.innerHeight * 0.7) {
              footerText += ' ' + el.textContent;
              foundFooterElements++;
            }
          });
        }
        
        console.log(`🔍 Found ${foundFooterElements} footer elements in bottom region`);
        
        // Strategy 2: Bottom 10% text extraction (fallback)
        if (footerText.length < 100) {
          console.log('📄 Footer text insufficient, extracting from bottom 10% of all text');
          
          const allTextNodes = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          const bottomTexts = [];
          let node;
          while (node = allTextNodes.nextNode()) {
            const parent = node.parentElement;
            if (parent) {
              const rect = parent.getBoundingClientRect();
              const elementTop = rect.top + window.scrollY;
              
              if (elementTop >= bottom10PercentStart && node.textContent.trim().length > 10) {
                bottomTexts.push(node.textContent.trim());
              }
            }
          }
          
          footerText += ' ' + bottomTexts.join(' ');
          console.log(`📝 Added ${bottomTexts.length} text nodes from bottom 10%`);
        }
        
        console.log(`📊 Total footer text length: ${footerText.length} characters`);
        
        // Enhanced copyright patterns for legal entities
        const copyrightPatterns = [
          // Standard copyright with full legal entities
          /©\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?))/gi,
          
          // Copyright without symbol
          /copyright\s*©?\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?))/gi,
          
          // Year-first pattern
          /\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?))/gi,
          
          // All rights reserved pattern
          /([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?))[^A-Za-z]*all\s*rights\s*reserved/gi
        ];
        
        console.log('🔍 Testing copyright patterns...');
        
        for (let i = 0; i < copyrightPatterns.length; i++) {
          const pattern = copyrightPatterns[i];
          const matches = [...footerText.matchAll(pattern)];
          
          console.log(`Pattern ${i + 1}: Found ${matches.length} matches`);
          
          if (matches.length > 0) {
            for (const match of matches) {
              let companyName = match[1]?.trim();
              if (companyName) {
                // Clean up the company name
                companyName = companyName
                  .replace(/^\s*-\s*/, '')
                  .replace(/\s*all rights reserved.*$/i, '')
                  .replace(/\s*\.\s*$/, '')
                  .replace(/\s*,\s*$/, '')
                  .trim();
                
                // Validate company name
                if (companyName.length >= 3 && 
                    companyName.length <= 80 && 
                    !companyName.toLowerCase().includes('javascript') &&
                    !companyName.toLowerCase().includes('loading') &&
                    !companyName.toLowerCase().includes('menu') &&
                    !companyName.toLowerCase().includes('button')) {
                  
                  console.log(`✅ Found valid company: "${companyName}"`);
                  
                  return {
                    companyName,
                    method: 'puppeteer_footer_copyright',
                    confidence: 85,
                    source: 'footer_bottom10'
                  };
                }
              }
            }
          }
        }
        
        console.log('❌ No valid copyright matches found');
        
        // Strategy 3: Legal disclaimers in bottom region
        const legalPatterns = [
          /(?:operated|owned|managed)\s+by\s+([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?))/gi,
          /a\s+(?:subsidiary|division|brand)\s+of\s+([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?))/gi
        ];
        
        for (const pattern of legalPatterns) {
          const match = footerText.match(pattern);
          if (match && match[1]) {
            const companyName = match[1].trim();
            if (companyName.length >= 3 && companyName.length <= 60) {
              console.log(`✅ Found legal entity: "${companyName}"`);
              return {
                companyName,
                method: 'puppeteer_legal_disclaimer',
                confidence: 75,
                source: 'footer_legal'
              };
            }
          }
        }
        
        console.log('❌ No extraction successful');
        return {
          companyName: null,
          method: 'puppeteer_failed',
          confidence: 0,
          source: 'footer_focused_failed'
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
