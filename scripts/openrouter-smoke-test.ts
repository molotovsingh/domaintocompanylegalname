import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const API_KEY = process.env.openrouter; // Using Replit Secret name
const BASE_URL = 'https://openrouter.ai/api/v1';

// Color codes for console output
const colors = {
  success: '\x1b[32m',
  error: '\x1b[31m',
  info: '\x1b[36m',
  warning: '\x1b[33m',
  reset: '\x1b[0m'
};

// Helper function for colored console output
function log(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

// Test 1: Check API key is configured
async function testApiKeyConfiguration() {
  log('\n=== Test 1: API Key Configuration ===', 'info');
  
  if (!API_KEY) {
    log('❌ OPENROUTER_API_KEY not found in environment variables', 'error');
    log('Please add OPENROUTER_API_KEY to your .env file or Replit Secrets', 'warning');
    return false;
  }
  
  log('✅ API Key found', 'success');
  return true;
}

// Test 2: List available models
async function testListModels() {
  log('\n=== Test 2: List Available Models ===', 'info');
  
  try {
    const response = await axios.get(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const models = response.data.data;
    log(`✅ Found ${models.length} available models`, 'success');
    
    // Show some popular models
    const popularModels = [
      'openai/gpt-3.5-turbo',
      'openai/gpt-4',
      'anthropic/claude-3-haiku',
      'anthropic/claude-3-sonnet',
      'meta-llama/llama-3-8b-instruct'
    ];
    
    log('\nPopular models available:', 'info');
    popularModels.forEach(modelId => {
      const model = models.find((m: any) => m.id === modelId);
      if (model) {
        const pricing = model.pricing;
        log(`  - ${modelId}: $${pricing.prompt}/1M input, $${pricing.completion}/1M output`, 'info');
      }
    });
    
    return true;
  } catch (error: any) {
    log(`❌ Failed to list models: ${error.message}`, 'error');
    if (error.response?.status === 401) {
      log('Invalid API key - please check your OPENROUTER_API_KEY', 'error');
    }
    return false;
  }
}

// Test 3: Simple chat completion
async function testChatCompletion() {
  log('\n=== Test 3: Simple Chat Completion ===', 'info');
  
  try {
    const model = 'openai/gpt-3.5-turbo';
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Keep responses brief.'
      },
      {
        role: 'user',
        content: 'What is 2+2? Answer in one word.'
      }
    ];
    
    log(`Testing with model: ${model}`, 'info');
    log('Prompt: "What is 2+2? Answer in one word."', 'info');
    
    const response = await axios.post(`${BASE_URL}/chat/completions`, {
      model,
      messages,
      max_tokens: 10,
      temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const answer = response.data.choices[0].message.content;
    const usage = response.data.usage;
    
    log(`✅ Response: "${answer}"`, 'success');
    log(`Tokens used: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens})`, 'info');
    
    return true;
  } catch (error: any) {
    log(`❌ Chat completion failed: ${error.message}`, 'error');
    if (error.response?.data) {
      log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
    }
    return false;
  }
}

// Test 4: Entity extraction (domain-specific test)
async function testEntityExtraction() {
  log('\n=== Test 4: Entity Extraction Test ===', 'info');
  
  // Sample website data (similar to what you'd get from scraping)
  const sampleData = {
    domain: 'apple.com',
    title: 'Apple',
    metaDescription: 'Discover the innovative world of Apple and shop iPhone, iPad, Apple Watch, Mac, and Apple TV, plus explore accessories, entertainment, and expert device support.',
    h1: 'iPhone 15 Pro',
    footerText: '© 2024 Apple Inc. All rights reserved.',
    aboutPageText: 'Apple Inc. is an American multinational technology company headquartered in Cupertino, California.'
  };
  
  try {
    const model = 'anthropic/claude-3-haiku'; // Good balance of speed and quality
    const messages = [
      {
        role: 'system',
        content: `You are an expert at extracting legal entity names from website data. 
Extract the official legal entity name (company name with proper legal suffix like Inc., Corp., Ltd., etc.).
Respond with ONLY the legal entity name, nothing else.`
      },
      {
        role: 'user',
        content: `Extract the legal entity name from this website data:
Domain: ${sampleData.domain}
Title: ${sampleData.title}
Footer: ${sampleData.footerText}
About: ${sampleData.aboutPageText}`
      }
    ];
    
    log(`Testing entity extraction with model: ${model}`, 'info');
    log(`Sample domain: ${sampleData.domain}`, 'info');
    
    const response = await axios.post(`${BASE_URL}/chat/completions`, {
      model,
      messages,
      max_tokens: 50,
      temperature: 0
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const extractedEntity = response.data.choices[0].message.content.trim();
    const usage = response.data.usage;
    
    log(`✅ Extracted entity: "${extractedEntity}"`, 'success');
    log(`Tokens used: ${usage.total_tokens}`, 'info');
    
    // Estimate cost (rough calculation)
    const modelInfo = await getModelInfo(model);
    if (modelInfo) {
      const inputCost = (usage.prompt_tokens / 1_000_000) * parseFloat(modelInfo.pricing.prompt);
      const outputCost = (usage.completion_tokens / 1_000_000) * parseFloat(modelInfo.pricing.completion);
      const totalCost = inputCost + outputCost;
      log(`Estimated cost: $${totalCost.toFixed(6)}`, 'info');
    }
    
    return true;
  } catch (error: any) {
    log(`❌ Entity extraction failed: ${error.message}`, 'error');
    return false;
  }
}

// Helper: Get model information
async function getModelInfo(modelId: string) {
  try {
    const response = await axios.get(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data.find((m: any) => m.id === modelId);
  } catch {
    return null;
  }
}

// Test 5: Compare multiple models
async function testModelComparison() {
  log('\n=== Test 5: Model Comparison for Entity Extraction ===', 'info');
  
  const models = [
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3-haiku',
    'meta-llama/llama-3-8b-instruct'
  ];
  
  const testData = {
    domain: 'microsoft.com',
    footerText: 'Microsoft 2024 © Microsoft Corporation. All rights reserved.',
    aboutText: 'Microsoft Corporation is an American multinational technology corporation.'
  };
  
  const results: any[] = [];
  
  for (const model of models) {
    try {
      log(`\nTesting ${model}...`, 'info');
      
      const startTime = Date.now();
      
      const response = await axios.post(`${BASE_URL}/chat/completions`, {
        model,
        messages: [
          {
            role: 'system',
            content: 'Extract the legal entity name from the website data. Respond with ONLY the company name including legal suffix (Inc., Corp., etc.).'
          },
          {
            role: 'user',
            content: `Domain: ${testData.domain}\nFooter: ${testData.footerText}\nAbout: ${testData.aboutText}`
          }
        ],
        max_tokens: 30,
        temperature: 0
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const processingTime = Date.now() - startTime;
      const result = response.data.choices[0].message.content.trim();
      const usage = response.data.usage;
      
      results.push({
        model,
        result,
        processingTime,
        tokens: usage.total_tokens
      });
      
      log(`Result: "${result}"`, 'success');
      log(`Time: ${processingTime}ms, Tokens: ${usage.total_tokens}`, 'info');
      
    } catch (error: any) {
      log(`Failed: ${error.message}`, 'error');
      results.push({
        model,
        result: 'ERROR',
        error: error.message
      });
    }
  }
  
  log('\n=== Comparison Summary ===', 'info');
  results.forEach(r => {
    if (r.error) {
      log(`${r.model}: ERROR - ${r.error}`, 'error');
    } else {
      log(`${r.model}: "${r.result}" (${r.processingTime}ms, ${r.tokens} tokens)`, 'info');
    }
  });
  
  return true;
}

// Main test runner
async function runSmokeTests() {
  log('🚀 OpenRouter Smoke Test Starting...', 'info');
  log('=====================================', 'info');
  
  // Run all tests
  const tests = [
    testApiKeyConfiguration,
    testListModels,
    testChatCompletion,
    testEntityExtraction,
    testModelComparison
  ];
  
  let passedTests = 0;
  
  for (const test of tests) {
    const passed = await test();
    if (passed) passedTests++;
    
    // Stop if critical test fails
    if (!passed && test === testApiKeyConfiguration) {
      log('\n❌ Critical test failed. Please configure API key first.', 'error');
      break;
    }
  }
  
  log('\n=====================================', 'info');
  log(`✅ Passed ${passedTests}/${tests.length} tests`, passedTests === tests.length ? 'success' : 'warning');
  
  if (passedTests === tests.length) {
    log('\n🎉 All tests passed! OpenRouter is ready for integration.', 'success');
  } else {
    log('\n⚠️  Some tests failed. Please check the errors above.', 'warning');
  }
}

// Run the tests
runSmokeTests().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, 'error');
  process.exit(1);
});