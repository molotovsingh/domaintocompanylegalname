
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
    const startTime = Date.now();
    
    try {
      console.log(`Testing ${domain} with Playwright`);
      
      // Dynamic import for Playwright
      const { chromium } = await import('playwright');
      
      const browser = await chromium.launch({
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
      
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });
      
      const page = await context.newPage();
      
      // Set reasonable timeouts
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(15000);
      
      // Navigate to the page
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Wait for dynamic content and scroll to bottom to trigger lazy loading
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1000);
      
      // Enhanced extraction with multiple strategies
      const extractionResult = await page.evaluate(() => {
        console.log('🎭 PLAYWRIGHT: Starting multi-strategy extraction');
        
        // Strategy 1: Advanced footer analysis with structured data
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
          '[class*="legal"]',
          '.company-info',
          '[class*="company"]',
          '.about-us',
          '[class*="about"]'
        ];
        
        let footerTexts = [];
        for (const selector of footerSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 20) {
              footerTexts.push(text);
            }
          });
        }
        
        console.log(`📄 Found ${footerTexts.length} footer sections`);
        
        // Strategy 2: Structured data extraction (JSON-LD, microdata)
        const structuredData = [];
        
        // JSON-LD extraction
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
          try {
            const data = JSON.parse(script.textContent || '');
            if (data.name || data.legalName || data.organizationName) {
              structuredData.push({
                name: data.name || data.legalName || data.organizationName,
                type: 'json-ld',
                confidence: 90
              });
            }
          } catch (e) {
            // Ignore invalid JSON
          }
        });
        
        // Microdata extraction
        const microdataElements = document.querySelectorAll('[itemtype*="Organization"]');
        microdataElements.forEach(el => {
          const nameEl = el.querySelector('[itemprop="name"]');
          const legalNameEl = el.querySelector('[itemprop="legalName"]');
          if (nameEl || legalNameEl) {
            structuredData.push({
              name: nameEl?.textContent || legalNameEl?.textContent,
              type: 'microdata',
              confidence: 85
            });
          }
        });
        
        console.log(`🏗️ Found ${structuredData.length} structured data entries`);
        
        // Strategy 3: Meta tag analysis
        const metaCompany = document.querySelector('meta[name="author"]')?.getAttribute('content') ||
                           document.querySelector('meta[name="company"]')?.getAttribute('content') ||
                           document.querySelector('meta[name="organization"]')?.getAttribute('content') ||
                           document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
        
        if (metaCompany) {
          console.log(`🏷️ Found meta company: "${metaCompany}"`);
        }
        
        // Strategy 4: Enhanced copyright patterns with international support
        const allText = footerTexts.join(' ') + ' ' + document.body.textContent;
        
        const copyrightPatterns = [
          // Enhanced legal entity patterns with international support
          /©\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|PLC|plc|B\.V\.?|N\.V\.?|S\.L\.?|S\.R\.L\.?|Oy|AB|AS|ApS|KG|OHG|e\.V\.?|gGmbH|UG|SE|SCE))/gi,
          
          // Multi-language copyright patterns
          /(?:copyright|©|℗|copyrights?|tous droits réservés|alle rechte vorbehalten|todos los derechos reservados|tutti i diritti riservati|版权所有|著作権)\s*(?:©|℗)?\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|PLC|plc|B\.V\.?|N\.V\.?|S\.L\.?|S\.R\.L\.?|Oy|AB|AS|ApS|KG|OHG|e\.V\.?|gGmbH|UG|SE|SCE))/gi,
          
          // Trademark patterns
          /(?:™|®|℠)\s*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?|Group|Holdings|AG|GmbH|SA|SAS|SARL|Ltda\.?|S\.A\.?|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|PLC|plc|B\.V\.?|N\.V\.?|S\.L\.?|S\.R\.L\.?|Oy|AB|AS|ApS|KG|OHG|e\.V\.?|gGmbH|UG|SE|SCE))/gi
        ];
        
        // Check structured data first (highest confidence)
        for (const data of structuredData) {
          if (data.name && data.name.length >= 3 && data.name.length <= 80) {
            console.log(`✅ Found structured data: "${data.name}"`);
            return {
              companyName: data.name.trim(),
              method: `playwright_${data.type}`,
              confidence: data.confidence,
              source: 'structured_data'
            };
          }
        }
        
        // Check meta tags
        if (metaCompany && metaCompany.length >= 3 && metaCompany.length <= 80) {
          console.log(`✅ Found meta company: "${metaCompany}"`);
          return {
            companyName: metaCompany.trim(),
            method: 'playwright_meta',
            confidence: 80,
            source: 'meta_tags'
          };
        }
        
        // Check copyright patterns
        for (let i = 0; i < copyrightPatterns.length; i++) {
          const pattern = copyrightPatterns[i];
          const matches = [...allText.matchAll(pattern)];
          
          console.log(`🔍 Pattern ${i + 1}: Found ${matches.length} matches`);
          
          if (matches.length > 0) {
            for (const match of matches) {
              let companyName = match[1]?.trim();
              if (companyName) {
                // Clean up the company name
                companyName = companyName
                  .replace(/^\s*-\s*/, '')
                  .replace(/\s*all rights reserved.*$/i, '')
                  .replace(/\s*tous droits réservés.*$/i, '')
                  .replace(/\s*alle rechte vorbehalten.*$/i, '')
                  .replace(/\s*\.\s*$/, '')
                  .replace(/\s*,\s*$/, '')
                  .trim();
                
                // Enhanced validation
                if (companyName.length >= 3 && 
                    companyName.length <= 80 && 
                    !companyName.toLowerCase().includes('javascript') &&
                    !companyName.toLowerCase().includes('loading') &&
                    !companyName.toLowerCase().includes('menu') &&
                    !companyName.toLowerCase().includes('button') &&
                    !companyName.toLowerCase().includes('cookie') &&
                    !companyName.toLowerCase().includes('privacy') &&
                    !/^\d+$/.test(companyName)) {
                  
                  console.log(`✅ Found valid company: "${companyName}"`);
                  
                  return {
                    companyName,
                    method: `playwright_copyright_${i + 1}`,
                    confidence: 85 - (i * 5), // Slightly lower confidence for later patterns
                    source: 'copyright_extraction'
                  };
                }
              }
            }
          }
        }
        
        // Strategy 5: Advanced header analysis (company logos, nav branding)
        const headerSelectors = [
          'header .logo',
          '.header .logo',
          '.navbar .brand',
          '.navigation .brand',
          '.masthead .company',
          '[class*="logo"] img[alt]',
          '.brand-name',
          '.company-name',
          'h1.company',
          '.site-title'
        ];
        
        for (const selector of headerSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            const text = el.textContent?.trim() || el.getAttribute('alt')?.trim();
            if (text && text.length >= 3 && text.length <= 50 && 
                !text.toLowerCase().includes('logo') && 
                !text.toLowerCase().includes('image')) {
              console.log(`✅ Found header brand: "${text}"`);
              return {
                companyName: text,
                method: 'playwright_header_brand',
                confidence: 75,
                source: 'header_branding'
              };
            }
          });
        }
        
        console.log('❌ No extraction successful');
        return {
          companyName: null,
          method: 'playwright_failed',
          confidence: 0,
          source: 'extraction_failed'
        };
      });
      
      await browser.close();
      const processingTime = Date.now() - startTime;
      
      return {
        domain,
        method: 'playwright',
        companyName: extractionResult.companyName,
        confidence: extractionResult.confidence,
        processingTime,
        success: !!extractionResult.companyName,
        extractionMethod: extractionResult.method,
        technicalDetails: `Extracted from ${extractionResult.source}`
      };
      
    } catch (error) {
      console.error(`Playwright test failed for ${domain}:`, error);
      return {
        domain,
        method: 'playwright',
        companyName: null,
        confidence: 0,
        processingTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        technicalDetails: 'Playwright navigation or extraction failed'
      };
    }
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
    playwrightResult: SmokeTestResult;
    winner: string;
    analysis: string;
  }> {
    console.log(`Running comparison test for ${domain}`);
    
    const [axiosResult, puppeteerResult, playwrightResult] = await Promise.all([
      this.testWithAxiosCheerio(domain),
      this.testWithPuppeteer(domain),
      this.testWithPlaywright(domain)
    ]);
    
    // Determine winner with three-way comparison
    const results = [
      { name: 'Axios/Cheerio', result: axiosResult, speedBonus: axiosResult.processingTime < 2000 ? 20 : 0 },
      { name: 'Puppeteer', result: puppeteerResult, speedBonus: puppeteerResult.processingTime < 5000 ? 10 : 0 },
      { name: 'Playwright', result: playwrightResult, speedBonus: playwrightResult.processingTime < 5000 ? 10 : 0 }
    ];
    
    const successfulResults = results.filter(r => r.result.success);
    
    let winner = 'All Failed';
    if (successfulResults.length === 0) {
      winner = 'All Failed';
    } else if (successfulResults.length === 1) {
      winner = successfulResults[0].name;
    } else {
      // Multiple successful results - compare quality
      const scored = successfulResults.map(r => ({
        name: r.name,
        score: r.result.confidence + r.speedBonus
      }));
      
      scored.sort((a, b) => b.score - a.score);
      
      if (scored[0].score > scored[1].score) {
        winner = scored[0].name;
      } else {
        winner = 'Tie';
      }
    }
    
    // Generate analysis
    const analyses: string[] = [];
    const successCount = successfulResults.length;
    
    if (successCount === 3) {
      analyses.push('All three methods succeeded');
    } else if (successCount === 2) {
      analyses.push('Two methods succeeded');
    } else if (successCount === 1) {
      analyses.push('Only one method succeeded');
    }
    
    // Check for protection bypassing
    if (!axiosResult.success && (puppeteerResult.success || playwrightResult.success)) {
      analyses.push('Browser methods bypassed protection');
    }
    
    // Check for structured data advantages
    if (playwrightResult.extractionMethod?.includes('json-ld') || 
        playwrightResult.extractionMethod?.includes('microdata')) {
      analyses.push('Playwright found structured data');
    }
    
    // Performance analysis
    const times = [axiosResult.processingTime, puppeteerResult.processingTime, playwrightResult.processingTime];
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    if (maxTime > minTime * 5) {
      analyses.push('Significant performance difference');
    }
    
    if (axiosResult.connectivity === 'protected' || axiosResult.error?.includes('cloudflare')) {
      analyses.push('Anti-bot protection detected');
    }
    
    const analysis = analyses.length > 0 ? analyses.join('; ') : 'Standard extraction case';
    
    return {
      axiosResult,
      puppeteerResult,
      playwrightResult,
      winner,
      analysis
    };
  }
}
