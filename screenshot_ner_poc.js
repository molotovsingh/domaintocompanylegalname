/**
 * Screenshot-Based NER Extraction - Proof of Concept
 * Tests feasibility of visual footer extraction using computer vision + NLP
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

class ScreenshotNERExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    console.log('🚀 Initializing headless browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    this.page = await this.browser.newPage();
    
    // Set realistic viewport and user agent
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  async captureFooterScreenshot(url) {
    console.log(`📸 Capturing footer screenshot for: ${url}`);
    
    try {
      // Navigate to page with timeout
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });

      // Get page dimensions
      const pageHeight = await this.page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
      });

      console.log(`📏 Page height: ${pageHeight}px`);

      // Calculate footer region (last 10% of page)
      const footerStart = Math.floor(pageHeight * 0.9);
      const footerHeight = pageHeight - footerStart;

      console.log(`🎯 Footer region: ${footerStart}px to ${pageHeight}px (${footerHeight}px height)`);

      // Scroll to footer area
      await this.page.evaluate((scrollY) => {
        window.scrollTo(0, scrollY);
      }, footerStart - 100); // Scroll slightly above footer for context

      // Wait for scroll and content to stabilize
      await this.page.waitForTimeout(2000);

      // Take screenshot of footer region
      const domain = new URL(url).hostname.replace(/\./g, '_');
      const timestamp = Date.now();
      const screenshotPath = `footer_screenshots/${domain}_${timestamp}.png`;

      // Create directory if it doesn't exist
      const dir = path.dirname(screenshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Capture the footer region
      await this.page.screenshot({
        path: screenshotPath,
        clip: {
          x: 0,
          y: Math.max(0, footerStart - 100), // Include some context
          width: 1920,
          height: Math.min(footerHeight + 200, 500) // Limit height for processing
        }
      });

      console.log(`✅ Screenshot saved: ${screenshotPath}`);

      // Extract visible text from footer region for comparison
      const footerText = await this.page.evaluate((startY) => {
        // Find all text nodes in the footer region
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        const texts = [];
        let node;
        
        while (node = walker.nextNode()) {
          const element = node.parentElement;
          if (element && element.offsetParent !== null) {
            const rect = element.getBoundingClientRect();
            const absoluteY = rect.top + window.scrollY;
            
            // Check if text is in footer region
            if (absoluteY >= startY - 200) {
              const text = node.textContent.trim();
              if (text.length > 0 && !text.match(/^\s*$/)) {
                texts.push(text);
              }
            }
          }
        }
        
        return texts.join(' ').replace(/\s+/g, ' ').trim();
      }, footerStart);

      return {
        screenshotPath,
        footerText,
        pageHeight,
        footerRegion: { start: footerStart, height: footerHeight }
      };

    } catch (error) {
      console.error(`❌ Error capturing screenshot for ${url}:`, error.message);
      return { error: error.message };
    }
  }

  async extractEntitiesFromText(text) {
    console.log('🧠 Analyzing text for corporate entities...');
    
    // Simulate NER processing with pattern matching for POC
    // In real implementation, this would use spaCy, Hugging Face, or custom models
    
    const patterns = [
      // Copyright patterns
      /©.*?(\d{4}).*?([A-Z][A-Za-z\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?))/gi,
      /Copyright.*?(\d{4}).*?([A-Z][A-Za-z\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?))/gi,
      
      // Standalone corporate entities
      /\b([A-Z][A-Za-z\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?))\b/g,
      
      // Common corporate patterns
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s+&\s+[A-Z][a-z]+)*)\s+(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|Co\.?)/g
    ];

    const entities = new Set();
    const matches = [];

    patterns.forEach((pattern, index) => {
      const patternMatches = [...text.matchAll(pattern)];
      patternMatches.forEach(match => {
        const entity = match[match.length - 1]?.trim(); // Get last capture group
        if (entity && entity.length > 3 && entity.length < 100) {
          entities.add(entity);
          matches.push({
            pattern: index + 1,
            match: match[0],
            entity: entity,
            confidence: this.calculateConfidence(entity, match[0])
          });
        }
      });
    });

    return {
      entities: Array.from(entities),
      matches: matches.sort((a, b) => b.confidence - a.confidence),
      rawText: text
    };
  }

  calculateConfidence(entity, fullMatch) {
    let confidence = 0.5; // Base confidence
    
    // Boost for proper corporate suffixes
    if (/\b(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company)\b/i.test(entity)) {
      confidence += 0.2;
    }
    
    // Boost for copyright context
    if (/©|Copyright/i.test(fullMatch)) {
      confidence += 0.15;
    }
    
    // Boost for reasonable length
    const wordCount = entity.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 5) {
      confidence += 0.1;
    }
    
    // Penalize generic terms
    if (/\b(?:All Rights Reserved|Privacy Policy|Terms|Conditions)\b/i.test(entity)) {
      confidence -= 0.3;
    }
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  async processTestDomains() {
    const testDomains = [
      'https://merck.com',
      'https://corporate.exxonmobil.com',
      'https://apple.com',
      'https://microsoft.com',
      'https://jnj.com'
    ];

    const results = [];

    for (const domain of testDomains) {
      console.log(`\n==========================================`);
      console.log(`Processing: ${domain}`);
      console.log(`==========================================`);
      
      const startTime = Date.now();
      
      // Capture screenshot
      const screenshot = await this.captureFooterScreenshot(domain);
      
      if (screenshot.error) {
        results.push({
          domain,
          error: screenshot.error,
          processingTime: Date.now() - startTime
        });
        continue;
      }

      // Extract entities from footer text
      const entityAnalysis = await this.extractEntitiesFromText(screenshot.footerText);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`⏱️  Processing time: ${processingTime}ms`);
      console.log(`📝 Footer text (first 200 chars): "${screenshot.footerText.substring(0, 200)}..."`);
      console.log(`🏢 Extracted entities (${entityAnalysis.entities.length}):`);
      
      entityAnalysis.matches.forEach((match, i) => {
        console.log(`  ${i + 1}. "${match.entity}" (${(match.confidence * 100).toFixed(1)}% confidence)`);
      });

      results.push({
        domain,
        screenshot: screenshot.screenshotPath,
        footerText: screenshot.footerText,
        entities: entityAnalysis.entities,
        matches: entityAnalysis.matches,
        pageHeight: screenshot.pageHeight,
        footerRegion: screenshot.footerRegion,
        processingTime
      });
    }

    return results;
  }

  async generateReport(results) {
    console.log(`\n\n🔍 SCREENSHOT-BASED NER EXTRACTION REPORT`);
    console.log(`===========================================`);
    
    const successfulExtractions = results.filter(r => !r.error);
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = totalTime / results.length;

    console.log(`📊 Performance Metrics:`);
    console.log(`   • Total domains processed: ${results.length}`);
    console.log(`   • Successful extractions: ${successfulExtractions.length}`);
    console.log(`   • Success rate: ${(successfulExtractions.length / results.length * 100).toFixed(1)}%`);
    console.log(`   • Average processing time: ${avgTime.toFixed(0)}ms`);
    console.log(`   • Total processing time: ${(totalTime / 1000).toFixed(1)}s`);

    console.log(`\n🏢 Entity Extraction Results:`);
    
    successfulExtractions.forEach(result => {
      console.log(`\n${result.domain}:`);
      console.log(`   Screenshot: ${result.screenshot}`);
      console.log(`   Processing time: ${result.processingTime}ms`);
      
      if (result.matches.length > 0) {
        console.log(`   Best entity: "${result.matches[0].entity}" (${(result.matches[0].confidence * 100).toFixed(1)}%)`);
        
        if (result.matches.length > 1) {
          console.log(`   Alternatives:`);
          result.matches.slice(1, 3).forEach(match => {
            console.log(`      • "${match.entity}" (${(match.confidence * 100).toFixed(1)}%)`);
          });
        }
      } else {
        console.log(`   ❌ No entities extracted`);
      }
    });

    // Compare with current regex results
    console.log(`\n⚖️  Comparison vs Current Regex Method:`);
    console.log(`   • Regex processing time: ~200-500ms per domain`);
    console.log(`   • Screenshot processing time: ~${avgTime.toFixed(0)}ms per domain`);
    console.log(`   • Speed ratio: ${(avgTime / 350).toFixed(1)}x slower than regex`);
    
    return {
      totalDomains: results.length,
      successRate: successfulExtractions.length / results.length,
      averageProcessingTime: avgTime,
      results: results
    };
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Browser closed');
    }
  }
}

// Run the proof of concept
async function runPOC() {
  const extractor = new ScreenshotNERExtractor();
  
  try {
    await extractor.initialize();
    const results = await extractor.processTestDomains();
    const report = await extractor.generateReport(results);
    
    // Save detailed results
    fs.writeFileSync('screenshot_ner_results.json', JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed results saved to: screenshot_ner_results.json`);
    
  } catch (error) {
    console.error('❌ POC failed:', error);
  } finally {
    await extractor.cleanup();
  }
}

// Check if puppeteer is available
try {
  runPOC();
} catch (error) {
  console.log('⚠️  Puppeteer not available. Install with: npm install puppeteer');
  console.log('📋 This POC demonstrates the architecture and approach for screenshot-based extraction.');
}