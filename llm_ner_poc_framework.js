/**
 * Small LLM NER POC Framework
 * Tests multiple small LLMs on diverse domain dataset for corporate entity extraction
 * Completely isolated from production pipeline
 */

import fs from 'fs';
import path from 'path';

class LLMNERFramework {
  constructor() {
    this.testDataset = this.generateDiverseDataset();
    this.results = {};
    this.modelConfigs = this.getModelConfigurations();
  }

  generateDiverseDataset() {
    // 100 diverse domains across different categories, jurisdictions, and complexity levels
    return [
      // Fortune 500 - Clear corporate entities
      { domain: 'merck.com', expected: 'Merck & Co., Inc.', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'corporate.exxonmobil.com', expected: 'Exxon Mobil Corporation', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'apple.com', expected: 'Apple Inc.', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'microsoft.com', expected: 'Microsoft Corporation', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'jnj.com', expected: 'Johnson & Johnson', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'ge.com', expected: 'General Electric Company', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'pfizer.com', expected: 'Pfizer Inc.', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'coca-cola.com', expected: 'The Coca-Cola Company', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'walmart.com', expected: 'Walmart Inc.', category: 'fortune500', jurisdiction: 'US' },
      { domain: 'amazon.com', expected: 'Amazon.com, Inc.', category: 'fortune500', jurisdiction: 'US' },

      // International corporations
      { domain: 'volkswagen.com', expected: 'Volkswagen AG', category: 'international', jurisdiction: 'DE' },
      { domain: 'siemens.com', expected: 'Siemens AG', category: 'international', jurisdiction: 'DE' },
      { domain: 'nestle.com', expected: 'Nestlé S.A.', category: 'international', jurisdiction: 'CH' },
      { domain: 'unilever.com', expected: 'Unilever PLC', category: 'international', jurisdiction: 'UK' },
      { domain: 'toyota.com', expected: 'Toyota Motor Corporation', category: 'international', jurisdiction: 'JP' },
      { domain: 'sony.com', expected: 'Sony Corporation', category: 'international', jurisdiction: 'JP' },
      { domain: 'samsung.com', expected: 'Samsung Electronics Co., Ltd.', category: 'international', jurisdiction: 'KR' },
      { domain: 'alibaba.com', expected: 'Alibaba Group Holding Limited', category: 'international', jurisdiction: 'CN' },
      { domain: 'tencent.com', expected: 'Tencent Holdings Limited', category: 'international', jurisdiction: 'CN' },
      { domain: 'asml.com', expected: 'ASML Holding N.V.', category: 'international', jurisdiction: 'NL' },

      // Banking & Financial
      { domain: 'jpmorgan.com', expected: 'JPMorgan Chase & Co.', category: 'financial', jurisdiction: 'US' },
      { domain: 'bankofamerica.com', expected: 'Bank of America Corporation', category: 'financial', jurisdiction: 'US' },
      { domain: 'goldmansachs.com', expected: 'The Goldman Sachs Group, Inc.', category: 'financial', jurisdiction: 'US' },
      { domain: 'db.com', expected: 'Deutsche Bank AG', category: 'financial', jurisdiction: 'DE' },
      { domain: 'credit-suisse.com', expected: 'Credit Suisse Group AG', category: 'financial', jurisdiction: 'CH' },
      { domain: 'ubs.com', expected: 'UBS Group AG', category: 'financial', jurisdiction: 'CH' },
      { domain: 'hsbc.com', expected: 'HSBC Holdings plc', category: 'financial', jurisdiction: 'UK' },
      { domain: 'barclays.com', expected: 'Barclays PLC', category: 'financial', jurisdiction: 'UK' },

      // Complex naming patterns
      { domain: 'berkshirehathaway.com', expected: 'Berkshire Hathaway Inc.', category: 'complex', jurisdiction: 'US' },
      { domain: '3m.com', expected: '3M Company', category: 'complex', jurisdiction: 'US' },
      { domain: 'at-t.com', expected: 'AT&T Inc.', category: 'complex', jurisdiction: 'US' },
      { domain: 'kpmg.com', expected: 'KPMG International Limited', category: 'complex', jurisdiction: 'UK' },
      { domain: 'pwc.com', expected: 'PricewaterhouseCoopers International Limited', category: 'complex', jurisdiction: 'UK' },
      { domain: 'mckinsey.com', expected: 'McKinsey & Company', category: 'complex', jurisdiction: 'US' },

      // Technology companies with modern naming
      { domain: 'meta.com', expected: 'Meta Platforms, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'alphabet.com', expected: 'Alphabet Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'netflix.com', expected: 'Netflix, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'spotify.com', expected: 'Spotify Technology S.A.', category: 'tech', jurisdiction: 'LU' },
      { domain: 'shopify.com', expected: 'Shopify Inc.', category: 'tech', jurisdiction: 'CA' },
      { domain: 'salesforce.com', expected: 'Salesforce, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'servicenow.com', expected: 'ServiceNow, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'workday.com', expected: 'Workday, Inc.', category: 'tech', jurisdiction: 'US' },

      // Pharmaceuticals with complex structures
      { domain: 'novartis.com', expected: 'Novartis AG', category: 'pharma', jurisdiction: 'CH' },
      { domain: 'roche.com', expected: 'F. Hoffmann-La Roche AG', category: 'pharma', jurisdiction: 'CH' },
      { domain: 'sanofi.com', expected: 'Sanofi S.A.', category: 'pharma', jurisdiction: 'FR' },
      { domain: 'gsk.com', expected: 'GSK plc', category: 'pharma', jurisdiction: 'UK' },
      { domain: 'astrazeneca.com', expected: 'AstraZeneca PLC', category: 'pharma', jurisdiction: 'UK' },
      { domain: 'abbvie.com', expected: 'AbbVie Inc.', category: 'pharma', jurisdiction: 'US' },
      { domain: 'gilead.com', expected: 'Gilead Sciences, Inc.', category: 'pharma', jurisdiction: 'US' },

      // Energy & Utilities
      { domain: 'chevron.com', expected: 'Chevron Corporation', category: 'energy', jurisdiction: 'US' },
      { domain: 'conocophillips.com', expected: 'ConocoPhillips', category: 'energy', jurisdiction: 'US' },
      { domain: 'shell.com', expected: 'Shell plc', category: 'energy', jurisdiction: 'UK' },
      { domain: 'bp.com', expected: 'BP p.l.c.', category: 'energy', jurisdiction: 'UK' },
      { domain: 'totalenergies.com', expected: 'TotalEnergies SE', category: 'energy', jurisdiction: 'FR' },
      { domain: 'equinor.com', expected: 'Equinor ASA', category: 'energy', jurisdiction: 'NO' },

      // Retail & Consumer
      { domain: 'nike.com', expected: 'NIKE, Inc.', category: 'retail', jurisdiction: 'US' },
      { domain: 'adidas.com', expected: 'adidas AG', category: 'retail', jurisdiction: 'DE' },
      { domain: 'zara.com', expected: 'Industria de Diseño Textil, S.A.', category: 'retail', jurisdiction: 'ES' },
      { domain: 'hm.com', expected: 'H & M Hennes & Mauritz AB', category: 'retail', jurisdiction: 'SE' },
      { domain: 'lvmh.com', expected: 'LVMH Moët Hennessy Louis Vuitton SE', category: 'retail', jurisdiction: 'FR' },
      { domain: 'loreal.com', expected: 'L\'Oréal S.A.', category: 'retail', jurisdiction: 'FR' },

      // Aerospace & Defense
      { domain: 'boeing.com', expected: 'The Boeing Company', category: 'aerospace', jurisdiction: 'US' },
      { domain: 'lockheedmartin.com', expected: 'Lockheed Martin Corporation', category: 'aerospace', jurisdiction: 'US' },
      { domain: 'airbus.com', expected: 'Airbus SE', category: 'aerospace', jurisdiction: 'NL' },
      { domain: 'rolls-royce.com', expected: 'Rolls-Royce Holdings plc', category: 'aerospace', jurisdiction: 'UK' },

      // Media & Entertainment
      { domain: 'disney.com', expected: 'The Walt Disney Company', category: 'media', jurisdiction: 'US' },
      { domain: 'comcast.com', expected: 'Comcast Corporation', category: 'media', jurisdiction: 'US' },
      { domain: 'timewarner.com', expected: 'Warner Bros. Discovery, Inc.', category: 'media', jurisdiction: 'US' },
      { domain: 'viacom.com', expected: 'Paramount Global', category: 'media', jurisdiction: 'US' },

      // Telecommunications
      { domain: 'verizon.com', expected: 'Verizon Communications Inc.', category: 'telecom', jurisdiction: 'US' },
      { domain: 't-mobile.com', expected: 'T-Mobile US, Inc.', category: 'telecom', jurisdiction: 'US' },
      { domain: 'vodafone.com', expected: 'Vodafone Group Plc', category: 'telecom', jurisdiction: 'UK' },
      { domain: 'orange.com', expected: 'Orange S.A.', category: 'telecom', jurisdiction: 'FR' },

      // Industrial & Manufacturing
      { domain: 'caterpillar.com', expected: 'Caterpillar Inc.', category: 'industrial', jurisdiction: 'US' },
      { domain: 'ge.com', expected: 'General Electric Company', category: 'industrial', jurisdiction: 'US' },
      { domain: 'honeywell.com', expected: 'Honeywell International Inc.', category: 'industrial', jurisdiction: 'US' },
      { domain: 'siemens.com', expected: 'Siemens AG', category: 'industrial', jurisdiction: 'DE' },

      // Challenging cases - ambiguous/marketing heavy
      { domain: 'red-bull.com', expected: 'Red Bull GmbH', category: 'challenging', jurisdiction: 'AT' },
      { domain: 'virgin.com', expected: 'Virgin Group Ltd', category: 'challenging', jurisdiction: 'UK' },
      { domain: 'berkshire.com', expected: 'Berkshire Hathaway Inc.', category: 'challenging', jurisdiction: 'US' },

      // Newer companies with modern structures
      { domain: 'stripe.com', expected: 'Stripe, Inc.', category: 'fintech', jurisdiction: 'US' },
      { domain: 'square.com', expected: 'Block, Inc.', category: 'fintech', jurisdiction: 'US' },
      { domain: 'paypal.com', expected: 'PayPal Holdings, Inc.', category: 'fintech', jurisdiction: 'US' },
      { domain: 'coinbase.com', expected: 'Coinbase Global, Inc.', category: 'fintech', jurisdiction: 'US' },

      // International variety
      { domain: 'mercadolibre.com', expected: 'MercadoLibre, Inc.', category: 'ecommerce', jurisdiction: 'AR' },
      { domain: 'shopee.com', expected: 'Sea Limited', category: 'ecommerce', jurisdiction: 'SG' },
      { domain: 'rakuten.com', expected: 'Rakuten Group, Inc.', category: 'ecommerce', jurisdiction: 'JP' },

      // Edge cases
      { domain: 'x.com', expected: 'X Corp.', category: 'edge', jurisdiction: 'US' },
      { domain: 'meta.com', expected: 'Meta Platforms, Inc.', category: 'edge', jurisdiction: 'US' },
      { domain: 'alphabet.com', expected: 'Alphabet Inc.', category: 'edge', jurisdiction: 'US' },

      // Test domains with complex footer content
      { domain: 'berkshirehathaway.com', expected: 'Berkshire Hathaway Inc.', category: 'complex_footer', jurisdiction: 'US' },
      { domain: 'mckinsey.com', expected: 'McKinsey & Company', category: 'complex_footer', jurisdiction: 'US' },
      { domain: 'kpmg.com', expected: 'KPMG International Limited', category: 'complex_footer', jurisdiction: 'UK' },

      // Additional domains to reach 100
      { domain: 'uber.com', expected: 'Uber Technologies, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'lyft.com', expected: 'Lyft, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'airbnb.com', expected: 'Airbnb, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'zoom.us', expected: 'Zoom Video Communications, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'slack.com', expected: 'Slack Technologies, LLC', category: 'tech', jurisdiction: 'US' },
      { domain: 'dropbox.com', expected: 'Dropbox, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'twilio.com', expected: 'Twilio Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'mongodb.com', expected: 'MongoDB, Inc.', category: 'tech', jurisdiction: 'US' },
      { domain: 'atlassian.com', expected: 'Atlassian Corporation', category: 'tech', jurisdiction: 'AU' },
      { domain: 'zendesk.com', expected: 'Zendesk, Inc.', category: 'tech', jurisdiction: 'US' }
    ];
  }

  getModelConfigurations() {
    return {
      'phi3-mini': {
        name: 'Microsoft Phi-3-mini (3.8B)',
        endpoint: 'ollama', // Will use Ollama for local inference
        model: 'phi3:mini',
        contextLength: 128000,
        estimatedRam: '4GB',
        prompt: this.createExtractionPrompt
      },
      'gemma-2b': {
        name: 'Google Gemma-2B',
        endpoint: 'ollama',
        model: 'gemma:2b',
        contextLength: 8192,
        estimatedRam: '2GB',
        prompt: this.createExtractionPrompt
      },
      'llama3.1-8b': {
        name: 'Meta Llama-3.1-8B',
        endpoint: 'ollama',
        model: 'llama3.1:8b',
        contextLength: 128000,
        estimatedRam: '8GB',
        prompt: this.createExtractionPrompt
      },
      'qwen2-1.5b': {
        name: 'Alibaba Qwen2-1.5B',
        endpoint: 'ollama',
        model: 'qwen2:1.5b',
        contextLength: 32768,
        estimatedRam: '1.5GB',
        prompt: this.createExtractionPrompt
      },
      'mistral-7b': {
        name: 'Mistral-7B-Instruct',
        endpoint: 'ollama',
        model: 'mistral:7b-instruct',
        contextLength: 32768,
        estimatedRam: '7GB',
        prompt: this.createExtractionPrompt
      }
    };
  }

  createExtractionPrompt(footerText, domain) {
    return `You are an expert at extracting legal corporate entity names from website footer text.

TASK: Extract the official legal corporate entity name from this footer text.

DOMAIN: ${domain}
FOOTER TEXT:
${footerText}

RULES:
1. Return ONLY the official corporate legal entity name (e.g., "Apple Inc.", "Microsoft Corporation")
2. Include legal suffixes (Inc., Corp., LLC, Ltd., AG, S.A., etc.)
3. Do NOT include marketing phrases, taglines, or descriptive text
4. If multiple companies are mentioned, return the primary/main company
5. If no clear corporate entity is found, return "NONE"

EXAMPLES:
- "© 2025 Apple Inc. All rights reserved." → "Apple Inc."
- "Copyright Microsoft Corporation 2025" → "Microsoft Corporation" 
- "© Volkswagen AG 2025. All rights reserved." → "Volkswagen AG"

RESPONSE FORMAT: Return only the corporate entity name, nothing else.

CORPORATE ENTITY:`;
  }

  async simulateLLMExtraction(modelConfig, domain, footerText) {
    // Simulate LLM API call with realistic processing times and results
    const startTime = Date.now();
    
    // Simulate network latency and processing time based on model size
    const processingTime = this.estimateProcessingTime(modelConfig.model);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // For POC, simulate realistic extraction results
    const mockResult = this.generateMockExtractionResult(domain, footerText, modelConfig);
    
    return {
      result: mockResult.entity,
      confidence: mockResult.confidence,
      processingTime: Date.now() - startTime,
      model: modelConfig.name,
      reasoning: mockResult.reasoning
    };
  }

  estimateProcessingTime(modelName) {
    const timeMap = {
      'phi3:mini': 1500 + Math.random() * 1000,      // 1.5-2.5s
      'gemma:2b': 800 + Math.random() * 700,         // 0.8-1.5s
      'llama3.1:8b': 2500 + Math.random() * 1500,   // 2.5-4s
      'qwen2:1.5b': 600 + Math.random() * 500,      // 0.6-1.1s
      'mistral:7b-instruct': 2000 + Math.random() * 1000 // 2-3s
    };
    return timeMap[modelName] || 1500;
  }

  generateMockExtractionResult(domain, footerText, modelConfig) {
    // Find expected result for this domain
    const testCase = this.testDataset.find(item => item.domain === domain);
    const expected = testCase?.expected || 'Unknown Corporation';
    
    // Simulate different model performance characteristics
    const modelPerformance = {
      'phi3:mini': { accuracy: 0.85, consistency: 0.90 },
      'gemma:2b': { accuracy: 0.75, consistency: 0.80 },
      'llama3.1:8b': { accuracy: 0.88, consistency: 0.92 },
      'qwen2:1.5b': { accuracy: 0.70, consistency: 0.75 },
      'mistral:7b-instruct': { accuracy: 0.82, consistency: 0.85 }
    };
    
    const perf = modelPerformance[modelConfig.model] || { accuracy: 0.80, consistency: 0.85 };
    const random = Math.random();
    
    // Simulate model outputs
    if (random < perf.accuracy) {
      // Correct extraction
      return {
        entity: expected,
        confidence: 0.85 + Math.random() * 0.1,
        reasoning: `Extracted corporate entity from copyright notice`
      };
    } else if (random < perf.accuracy + 0.1) {
      // Partial extraction (missing suffix)
      const baseName = expected.replace(/\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company|AG|S\.A\.|PLC)$/i, '');
      return {
        entity: baseName,
        confidence: 0.60 + Math.random() * 0.15,
        reasoning: `Extracted company name but may be missing legal suffix`
      };
    } else if (random < perf.accuracy + 0.15) {
      // Extraction with extra words
      return {
        entity: expected + ' Group',
        confidence: 0.70 + Math.random() * 0.10,
        reasoning: `Extracted entity but included additional descriptive terms`
      };
    } else {
      // Failed extraction
      return {
        entity: 'NONE',
        confidence: 0.20 + Math.random() * 0.30,
        reasoning: `Could not identify clear corporate entity in footer text`
      };
    }
  }

  async runComprehensiveBenchmark() {
    console.log('🚀 Starting Comprehensive Small LLM NER Benchmark');
    console.log(`📊 Testing ${this.testDataset.length} domains across ${Object.keys(this.modelConfigs).length} models\n`);
    
    const results = {};
    
    for (const [modelId, config] of Object.entries(this.modelConfigs)) {
      console.log(`\n🔬 Testing Model: ${config.name}`);
      console.log(`   RAM Required: ${config.estimatedRam}`);
      console.log(`   Context Length: ${config.contextLength.toLocaleString()}`);
      
      const modelResults = {
        config: config,
        extractions: [],
        metrics: {}
      };
      
      let successCount = 0;
      let partialCount = 0;
      let totalTime = 0;
      
      // Test on subset for POC (first 20 domains)
      const testSubset = this.testDataset.slice(0, 20);
      
      for (const testCase of testSubset) {
        // Simulate footer text (in real implementation, this would come from screenshots)
        const mockFooterText = this.generateMockFooterText(testCase);
        
        try {
          const result = await this.simulateLLMExtraction(config, testCase.domain, mockFooterText);
          
          // Evaluate result
          const evaluation = this.evaluateExtraction(result.result, testCase.expected);
          
          modelResults.extractions.push({
            domain: testCase.domain,
            expected: testCase.expected,
            extracted: result.result,
            confidence: result.confidence,
            processingTime: result.processingTime,
            evaluation: evaluation,
            category: testCase.category,
            jurisdiction: testCase.jurisdiction
          });
          
          if (evaluation.score >= 0.9) successCount++;
          else if (evaluation.score >= 0.5) partialCount++;
          
          totalTime += result.processingTime;
          
          console.log(`   ✓ ${testCase.domain}: "${result.result}" (${(result.confidence * 100).toFixed(1)}%, ${result.processingTime}ms)`);
          
        } catch (error) {
          console.log(`   ❌ ${testCase.domain}: Error - ${error.message}`);
          modelResults.extractions.push({
            domain: testCase.domain,
            expected: testCase.expected,
            extracted: 'ERROR',
            error: error.message
          });
        }
      }
      
      // Calculate metrics
      modelResults.metrics = {
        totalDomains: testSubset.length,
        successCount: successCount,
        partialCount: partialCount,
        failureCount: testSubset.length - successCount - partialCount,
        successRate: successCount / testSubset.length,
        partialRate: partialCount / testSubset.length,
        averageProcessingTime: totalTime / testSubset.length,
        totalProcessingTime: totalTime
      };
      
      results[modelId] = modelResults;
    }
    
    return results;
  }

  generateMockFooterText(testCase) {
    // Generate realistic footer text based on domain and expected entity
    const templates = [
      `© ${new Date().getFullYear()} ${testCase.expected}. All rights reserved.`,
      `Copyright ${new Date().getFullYear()} ${testCase.expected}`,
      `${testCase.expected} © ${new Date().getFullYear()}. All Rights Reserved.`,
      `Privacy Policy | Terms of Service | © ${testCase.expected} ${new Date().getFullYear()}`,
      `Contact Us | About | Careers | © ${new Date().getFullYear()} ${testCase.expected}. All rights reserved.`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  evaluateExtraction(extracted, expected) {
    if (!extracted || extracted === 'NONE' || extracted === 'ERROR') {
      return { score: 0, match: 'none', details: 'No entity extracted' };
    }
    
    // Normalize for comparison
    const normalizeEntity = (entity) => {
      return entity.toLowerCase()
        .replace(/[^\w\s&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedExtracted = normalizeEntity(extracted);
    const normalizedExpected = normalizeEntity(expected);
    
    if (normalizedExtracted === normalizedExpected) {
      return { score: 1.0, match: 'exact', details: 'Perfect match' };
    }
    
    // Check if extracted is contained in expected or vice versa
    if (normalizedExpected.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedExpected)) {
      return { score: 0.8, match: 'partial', details: 'Partial match - contains expected entity' };
    }
    
    // Calculate similarity score
    const similarity = this.calculateSimilarity(normalizedExtracted, normalizedExpected);
    if (similarity > 0.7) {
      return { score: 0.6, match: 'similar', details: `High similarity (${(similarity * 100).toFixed(1)}%)` };
    }
    
    return { score: 0.2, match: 'poor', details: 'Poor match with expected entity' };
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const levenshteinDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - levenshteinDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  generateComprehensiveReport(results) {
    console.log('\n\n📊 COMPREHENSIVE SMALL LLM NER BENCHMARK REPORT');
    console.log('='.repeat(80));
    
    // Overall comparison
    console.log('\n🏆 MODEL PERFORMANCE RANKING');
    console.log('-'.repeat(50));
    
    const modelRanking = Object.entries(results)
      .map(([modelId, data]) => ({
        modelId,
        name: data.config.name,
        successRate: data.metrics.successRate,
        avgTime: data.metrics.averageProcessingTime,
        efficiency: data.metrics.successRate / (data.metrics.averageProcessingTime / 1000) // Success per second
      }))
      .sort((a, b) => b.successRate - a.successRate);
    
    modelRanking.forEach((model, index) => {
      console.log(`${index + 1}. ${model.name}`);
      console.log(`   Success Rate: ${(model.successRate * 100).toFixed(1)}%`);
      console.log(`   Avg Time: ${model.avgTime.toFixed(0)}ms`);
      console.log(`   Efficiency: ${model.efficiency.toFixed(2)} success/sec`);
      console.log('');
    });
    
    // Detailed metrics per model
    console.log('\n📈 DETAILED MODEL METRICS');
    console.log('-'.repeat(50));
    
    for (const [modelId, data] of Object.entries(results)) {
      console.log(`\n${data.config.name}:`);
      console.log(`  📊 Performance:`);
      console.log(`     • Success Rate: ${(data.metrics.successRate * 100).toFixed(1)}% (${data.metrics.successCount}/${data.metrics.totalDomains})`);
      console.log(`     • Partial Match: ${(data.metrics.partialRate * 100).toFixed(1)}% (${data.metrics.partialCount}/${data.metrics.totalDomains})`);
      console.log(`     • Failure Rate: ${((1 - data.metrics.successRate - data.metrics.partialRate) * 100).toFixed(1)}%`);
      
      console.log(`  ⏱️  Speed:`);
      console.log(`     • Average Time: ${data.metrics.averageProcessingTime.toFixed(0)}ms`);
      console.log(`     • Total Time: ${(data.metrics.totalProcessingTime / 1000).toFixed(1)}s`);
      console.log(`     • Throughput: ${(data.metrics.totalDomains / (data.metrics.totalProcessingTime / 1000)).toFixed(1)} domains/sec`);
      
      console.log(`  💾 Resources:`);
      console.log(`     • RAM Required: ${data.config.estimatedRam}`);
      console.log(`     • Context Length: ${data.config.contextLength.toLocaleString()}`);
    }
    
    // Category analysis
    console.log('\n🎯 PERFORMANCE BY CATEGORY');
    console.log('-'.repeat(50));
    
    const categories = {};
    for (const [modelId, data] of Object.entries(results)) {
      for (const extraction of data.extractions) {
        if (!categories[extraction.category]) {
          categories[extraction.category] = {};
        }
        if (!categories[extraction.category][modelId]) {
          categories[extraction.category][modelId] = { total: 0, success: 0 };
        }
        categories[extraction.category][modelId].total++;
        if (extraction.evaluation?.score >= 0.9) {
          categories[extraction.category][modelId].success++;
        }
      }
    }
    
    for (const [category, models] of Object.entries(categories)) {
      console.log(`\n${category.toUpperCase()}:`);
      for (const [modelId, stats] of Object.entries(models)) {
        const rate = (stats.success / stats.total * 100).toFixed(1);
        console.log(`  ${results[modelId].config.name}: ${rate}% (${stats.success}/${stats.total})`);
      }
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(50));
    
    const topPerformer = modelRanking[0];
    const fastestModel = modelRanking.reduce((prev, curr) => prev.avgTime < curr.avgTime ? prev : curr);
    const mostEfficient = modelRanking.reduce((prev, curr) => prev.efficiency > curr.efficiency ? prev : curr);
    
    console.log(`🥇 Best Accuracy: ${topPerformer.name} (${(topPerformer.successRate * 100).toFixed(1)}%)`);
    console.log(`⚡ Fastest Processing: ${fastestModel.name} (${fastestModel.avgTime.toFixed(0)}ms avg)`);
    console.log(`⚖️  Most Efficient: ${mostEfficient.name} (${mostEfficient.efficiency.toFixed(2)} success/sec)`);
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Test top 2-3 models with real Ollama/API integration');
    console.log('2. Implement screenshot capture + OCR pipeline');
    console.log('3. Compare against current regex extraction results');
    console.log('4. Measure resource usage in production environment');
    console.log('5. Consider hybrid approach (LLM for failed regex cases)');
    
    return {
      ranking: modelRanking,
      categoryAnalysis: categories,
      recommendations: {
        topAccuracy: topPerformer,
        fastestSpeed: fastestModel,
        mostEfficient: mostEfficient
      }
    };
  }

  async saveBenchmarkResults(results, report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `llm_ner_benchmark_${timestamp}.json`;
    
    const fullReport = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalDomains: this.testDataset.length,
        testedDomains: 20,
        modelsEvaluated: Object.keys(this.modelConfigs).length
      },
      results: results,
      analysis: report,
      testDataset: this.testDataset.slice(0, 20) // Include tested subset
    };
    
    fs.writeFileSync(filename, JSON.stringify(fullReport, null, 2));
    console.log(`\n💾 Full benchmark results saved to: ${filename}`);
    
    return filename;
  }
}

// Run the comprehensive benchmark
async function runBenchmark() {
  console.log('🔬 Small LLM NER Extraction - Proof of Concept Framework');
  console.log('=' .repeat(60));
  console.log('⚠️  Note: This is a simulation using mock LLM responses');
  console.log('   Real implementation would require Ollama or API integration\n');
  
  const framework = new LLMNERFramework();
  
  try {
    const results = await framework.runComprehensiveBenchmark();
    const report = framework.generateComprehensiveReport(results);
    const savedFile = await framework.saveBenchmarkResults(results, report);
    
    console.log('\n✅ Benchmark completed successfully!');
    console.log(`📄 Detailed results: ${savedFile}`);
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  }
}

// Export for potential integration testing
export { LLMNERFramework, runBenchmark };

// Run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  runBenchmark();
}