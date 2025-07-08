
const axios = require('axios');

async function testSerializedExtractors() {
  console.log('🧪 Testing serialized extractor initialization...');
  
  try {
    // Wait for beta server to be ready
    console.log('⏳ Waiting for beta server...');
    let attempts = 0;
    while (attempts < 30) {
      try {
        const response = await axios.get('http://0.0.0.0:3001/api/beta/health-check', { timeout: 2000 });
        console.log('✅ Beta server health check:', response.data);
        
        // Check which extractors are working
        const extractors = response.data.extractors;
        console.log('\n📊 Extractor Status:');
        console.log(`  Axios/Cheerio: ${extractors.axios_cheerio ? '✅' : '❌'}`);
        console.log(`  Puppeteer: ${extractors.puppeteer ? '✅' : '❌'}`);
        console.log(`  Playwright: ${extractors.playwright ? '✅' : '❌'}`);
        console.log(`  Perplexity: ${extractors.perplexity ? '✅' : '❌'}`);
        
        const workingCount = Object.values(extractors).filter(Boolean).length;
        console.log(`\n🎯 ${workingCount}/4 extractors initialized successfully`);
        
        if (workingCount >= 2) {
          console.log('✅ Sufficient extractors available for testing');
        } else {
          console.log('⚠️ Limited extractors available');
        }
        
        return;
      } catch (error) {
        attempts++;
        if (attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    console.log('❌ Beta server not responding after 60 seconds');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSerializedExtractors().catch(console.error);
