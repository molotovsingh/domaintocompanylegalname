/**
 * Level 1 Extraction Demo - Deep Dive into merck.com Processing
 * Shows raw HTML extraction, parsing methods, and confidence scoring
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

class Level1ExtractionDemo {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.domain = 'merck.com';
    this.extractionMethods = [
      'domain_mapping',
      'structured_data', 
      'footer_copyright',
      'meta_property',
      'about_page',
      'legal_page',
      'domain_parse'
    ];
  }

  async runFullExtraction() {
    console.log('='.repeat(80));
    console.log('LEVEL 1 EXTRACTION DEMO: merck.com');
    console.log('='.repeat(80));
    
    // Step 1: Domain Mapping Check
    console.log('\n1. DOMAIN MAPPING CHECK');
    console.log('-'.repeat(40));
    const domainMapping = this.checkDomainMapping();
    console.log('Known Fortune 500 mapping:', domainMapping);
    
    if (domainMapping.found) {
      console.log(`✓ SUCCESS: ${domainMapping.companyName} (95% confidence)`);
      return { method: 'domain_mapping', ...domainMapping };
    }
    
    // Step 2: Fetch Raw HTML
    console.log('\n2. FETCHING RAW HTML');
    console.log('-'.repeat(40));
    const htmlData = await this.fetchRawHTML();
    
    if (!htmlData.success) {
      console.log(`✗ FAILED: ${htmlData.error}`);
      return htmlData;
    }
    
    console.log(`✓ HTML fetched: ${htmlData.html.length} characters`);
    console.log(`Response headers: ${JSON.stringify(htmlData.headers, null, 2)}`);
    
    // Step 3: Parse HTML Structure
    console.log('\n3. HTML STRUCTURE ANALYSIS');
    console.log('-'.repeat(40));
    const $ = cheerio.load(htmlData.html);
    this.analyzeHTMLStructure($);
    
    // Step 4: Try Each Extraction Method
    console.log('\n4. EXTRACTION METHODS');
    console.log('-'.repeat(40));
    
    const results = {};
    
    // Method 1: Structured Data (JSON-LD)
    results.structured_data = this.extractStructuredData($);
    
    // Method 2: Footer Copyright
    results.footer_copyright = this.extractFooterCopyright($);
    
    // Method 3: Meta Properties
    results.meta_property = this.extractMetaProperties($);
    
    // Method 4: About Page
    results.about_page = await this.extractAboutPage();
    
    // Method 5: Legal Page
    results.legal_page = await this.extractLegalPage();
    
    // Method 6: Domain Parse (fallback)
    results.domain_parse = this.extractDomainParse();
    
    // Step 5: Calculate Final Result
    console.log('\n5. FINAL RESULT CALCULATION');
    console.log('-'.repeat(40));
    const finalResult = this.calculateFinalResult(results);
    
    console.log('\n' + '='.repeat(80));
    console.log('EXTRACTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`Final Company Name: ${finalResult.companyName}`);
    console.log(`Method Used: ${finalResult.method}`);
    console.log(`Confidence Score: ${finalResult.confidence}%`);
    console.log(`Business Category: ${finalResult.businessCategory}`);
    
    return finalResult;
  }

  checkDomainMapping() {
    // DEMO MODE: Skip domain mapping to show HTML extraction methods
    console.log('DEMO MODE: Skipping domain mapping to demonstrate raw HTML extraction');
    return { found: false };
  }

  async fetchRawHTML() {
    try {
      console.log(`Requesting: https://${this.domain}`);
      console.log(`User-Agent: ${this.userAgent}`);
      
      const response = await axios.get(`https://${this.domain}`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
        maxRedirects: 5
      });
      
      return {
        success: true,
        html: response.data,
        headers: response.headers,
        status: response.status,
        finalUrl: response.request.res.responseUrl || `https://${this.domain}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  analyzeHTMLStructure($) {
    console.log('Document title:', $('title').text().trim());
    console.log('Meta description:', $('meta[name="description"]').attr('content') || 'None');
    console.log('Language:', $('html').attr('lang') || 'Not specified');
    console.log('Footer elements:', $('footer').length);
    console.log('Copyright elements:', $('*:contains("©"), *:contains("Copyright")').length);
    console.log('JSON-LD scripts:', $('script[type="application/ld+json"]').length);
    console.log('Meta properties:', $('meta[property]').length);
  }

  extractStructuredData($) {
    console.log('\nTrying: Structured Data (JSON-LD)');
    
    const jsonLdScripts = $('script[type="application/ld+json"]');
    console.log(`Found ${jsonLdScripts.length} JSON-LD scripts`);
    
    if (jsonLdScripts.length === 0) {
      console.log('✗ No JSON-LD structured data found');
      return { success: false, reason: 'No JSON-LD scripts' };
    }
    
    jsonLdScripts.each((i, script) => {
      try {
        const jsonData = JSON.parse($(script).html());
        console.log(`Script ${i + 1}:`, JSON.stringify(jsonData, null, 2));
        
        if (jsonData['@type'] === 'Organization' && jsonData.name) {
          console.log(`✓ Found organization: ${jsonData.name}`);
          return {
            success: true,
            companyName: jsonData.name,
            confidence: 98,
            rawData: jsonData
          };
        }
      } catch (e) {
        console.log(`Script ${i + 1}: Invalid JSON - ${e.message}`);
      }
    });
    
    return { success: false, reason: 'No valid organization data in JSON-LD' };
  }

  extractFooterCopyright($) {
    console.log('\nTrying: Footer Copyright');
    
    const footerSelectors = [
      'footer',
      '.footer',
      '#footer',
      '.site-footer',
      '.page-footer'
    ];
    
    for (const selector of footerSelectors) {
      const footer = $(selector);
      if (footer.length > 0) {
        console.log(`Found footer with selector: ${selector}`);
        const footerText = footer.text().trim();
        console.log(`Footer text (first 200 chars): "${footerText.substring(0, 200)}..."`);
        
        // Look for copyright patterns (FIXED: capture complete legal entity including "Inc.")
        const copyrightPatterns = [
          /©\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi,
          /Copyright\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi,
          /\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi
        ];
        
        for (const pattern of copyrightPatterns) {
          const matches = [...footerText.matchAll(pattern)];
          console.log(`Pattern ${pattern.source} found ${matches.length} matches`);
          
          matches.forEach((match, i) => {
            console.log(`  Match ${i + 1}: "${match[1]?.trim()}"`);
          });
          
          if (matches.length > 0) {
            const companyName = matches[0][1]?.trim();
            if (companyName && companyName.length > 2) {
              console.log(`✓ Extracted: ${companyName}`);
              return {
                success: true,
                companyName,
                confidence: 75,
                method: 'footer_copyright',
                pattern: pattern.source
              };
            }
          }
        }
      }
    }
    
    console.log('✗ No copyright information found in footer');
    return { success: false, reason: 'No footer copyright found' };
  }

  extractMetaProperties($) {
    console.log('\nTrying: Meta Properties');
    
    const metaSelectors = [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]'
    ];
    
    for (const selector of metaSelectors) {
      const meta = $(selector);
      if (meta.length > 0) {
        const content = meta.attr('content')?.trim();
        console.log(`${selector}: "${content}"`);
        
        if (content && content.length > 2 && !this.isGenericContent(content)) {
          console.log(`✓ Extracted: ${content}`);
          return {
            success: true,
            companyName: content,
            confidence: 80,
            source: selector
          };
        }
      }
    }
    
    console.log('✗ No suitable meta properties found');
    return { success: false, reason: 'No meta properties' };
  }

  async extractAboutPage() {
    console.log('\nTrying: About Page');
    
    const aboutUrls = [
      `https://${this.domain}/about`,
      `https://${this.domain}/about-us`,
      `https://${this.domain}/company`,
      `https://${this.domain}/who-we-are`
    ];
    
    for (const url of aboutUrls) {
      try {
        console.log(`Trying: ${url}`);
        const response = await axios.get(url, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 5000
        });
        
        const $ = cheerio.load(response.data);
        const pageText = $('body').text();
        
        // Look for "About [Company]" or similar patterns
        const aboutPatterns = [
          /About\s+([A-Z][a-zA-Z\s&,\.]{2,40})/gi,
          /Welcome to\s+([A-Z][a-zA-Z\s&,\.]{2,40})/gi
        ];
        
        for (const pattern of aboutPatterns) {
          const matches = [...pageText.matchAll(pattern)];
          if (matches.length > 0) {
            const companyName = matches[0][1].trim();
            console.log(`✓ Found on about page: ${companyName}`);
            return {
              success: true,
              companyName,
              confidence: 85,
              source: url
            };
          }
        }
        
      } catch (error) {
        console.log(`  ${url}: ${error.message}`);
      }
    }
    
    console.log('✗ No about page accessible');
    return { success: false, reason: 'About pages not accessible' };
  }

  async extractLegalPage() {
    console.log('\nTrying: Legal Page');
    
    const legalUrls = [
      `https://${this.domain}/legal`,
      `https://${this.domain}/terms`,
      `https://${this.domain}/privacy`,
      `https://${this.domain}/terms-of-use`
    ];
    
    for (const url of legalUrls) {
      try {
        console.log(`Trying: ${url}`);
        const response = await axios.get(url, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 5000
        });
        
        const $ = cheerio.load(response.data);
        const pageText = $('body').text();
        
        // Look for legal entity mentions
        const legalPatterns = [
          /These terms.+?([A-Z][a-zA-Z\s&,\.]{2,40}(?:Inc\.|Corp\.|LLC|Ltd\.|Company))/gi,
          /operated by\s+([A-Z][a-zA-Z\s&,\.]{2,40}(?:Inc\.|Corp\.|LLC|Ltd\.|Company))/gi
        ];
        
        for (const pattern of legalPatterns) {
          const matches = [...pageText.matchAll(pattern)];
          if (matches.length > 0) {
            const companyName = matches[0][1].trim();
            console.log(`✓ Found on legal page: ${companyName}`);
            return {
              success: true,
              companyName,
              confidence: 90,
              source: url
            };
          }
        }
        
      } catch (error) {
        console.log(`  ${url}: ${error.message}`);
      }
    }
    
    console.log('✗ No legal page accessible');
    return { success: false, reason: 'Legal pages not accessible' };
  }

  extractDomainParse() {
    console.log('\nTrying: Domain Parse (Fallback)');
    
    const domain = this.domain.replace(/^www\./, '');
    const domainParts = domain.split('.');
    const mainPart = domainParts[0];
    
    // Generate expected company name
    const expectedName = mainPart
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    console.log(`Domain: ${domain}`);
    console.log(`Main part: ${mainPart}`);
    console.log(`Expected name: ${expectedName}`);
    
    return {
      success: true,
      companyName: expectedName,
      confidence: 30,
      method: 'domain_parse',
      note: 'Fallback method - low confidence'
    };
  }

  calculateFinalResult(results) {
    console.log('\nAll extraction results:');
    Object.entries(results).forEach(([method, result]) => {
      if (result.success) {
        console.log(`✓ ${method}: "${result.companyName}" (${result.confidence}%)`);
      } else {
        console.log(`✗ ${method}: ${result.reason}`);
      }
    });
    
    // Find highest confidence successful result
    const successfulResults = Object.entries(results)
      .filter(([_, result]) => result.success)
      .sort(([_, a], [__, b]) => b.confidence - a.confidence);
    
    if (successfulResults.length === 0) {
      return {
        companyName: null,
        method: 'none',
        confidence: 0,
        businessCategory: 'Failed - No Extraction',
        status: 'failed'
      };
    }
    
    const [bestMethod, bestResult] = successfulResults[0];
    
    // Determine business category
    let businessCategory = 'Success';
    if (bestResult.confidence < 50) {
      businessCategory = 'Incomplete - Low Priority';
    } else if (bestResult.confidence >= 95) {
      businessCategory = 'Success - High Confidence';
    }
    
    return {
      companyName: bestResult.companyName,
      method: bestMethod,
      confidence: bestResult.confidence,
      businessCategory,
      status: 'success',
      allResults: results
    };
  }

  isGenericContent(text) {
    const genericTerms = [
      'home', 'homepage', 'main page', 'index', 'welcome',
      'site', 'website', 'web', 'page', 'loading'
    ];
    
    return genericTerms.some(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
  }
}

// Run the demo
async function runDemo() {
  const demo = new Level1ExtractionDemo();
  await demo.runFullExtraction();
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}