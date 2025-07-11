
/**
 * Standalone GLEIF API Connection Test
 * Tests basic connectivity and response format from GLEIF API
 */

import https from 'https';

async function testGLEIFConnection() {
  console.log('🔍 GLEIF API Connection Test');
  console.log('Testing basic API connectivity and response format...\n');

  const tests = [
    {
      name: 'Basic API Health Check',
      url: 'https://api.gleif.org/api/v1/lei-records?page[size]=1',
      description: 'Test if GLEIF API is responding'
    },
    {
      name: 'Simple Company Search (Microsoft)',
      url: 'https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=Microsoft*&page[size]=1',
      description: 'Test search functionality with a reliable company'
    },
    {
      name: 'Apple Search Test',
      url: 'https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=apple*&page[size]=1',
      description: 'Test the problematic apple search'
    }
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log(`Description: ${test.description}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const result = await makeGLEIFRequest(test.url);
      console.log(`✅ Status: ${result.statusCode}`);
      console.log(`✅ Content-Type: ${result.headers['content-type']}`);
      
      // Check if response is HTML (error page)
      if (result.headers['content-type']?.includes('text/html')) {
        console.log('❌ ERROR: Received HTML response instead of JSON');
        console.log('Response preview:', result.data.substring(0, 200));
        continue;
      }

      // Try to parse JSON
      let jsonData;
      try {
        jsonData = JSON.parse(result.data);
        console.log(`✅ Valid JSON response received`);
      } catch (parseError) {
        console.log('❌ ERROR: Invalid JSON response');
        console.log('Response preview:', result.data.substring(0, 200));
        continue;
      }

      // Analyze response structure
      if (jsonData.data && Array.isArray(jsonData.data)) {
        console.log(`✅ Found ${jsonData.data.length} entities`);
        
        if (jsonData.data.length > 0) {
          const entity = jsonData.data[0];
          console.log(`✅ Sample entity:`);
          console.log(`   LEI: ${entity.id || 'N/A'}`);
          console.log(`   Name: ${entity.attributes?.entity?.legalName?.name || 'N/A'}`);
          console.log(`   Status: ${entity.attributes?.entity?.status || 'N/A'}`);
          console.log(`   Country: ${entity.attributes?.entity?.legalAddress?.country || 'N/A'}`);
        }
      } else {
        console.log('⚠️  Unexpected response structure');
        console.log('Response keys:', Object.keys(jsonData));
      }

      // Check for pagination info
      if (jsonData.meta?.pagination) {
        console.log(`✅ Pagination info available: ${jsonData.meta.pagination.total} total records`);
      }

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      
      if (error.code) {
        console.log(`   Error code: ${error.code}`);
      }
      
      if (error.statusCode) {
        console.log(`   HTTP status: ${error.statusCode}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Connection test complete');
  console.log(`${'='.repeat(60)}`);
}

function makeGLEIFRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'Accept': 'application/vnd.api+json',
        'User-Agent': 'GLEIF-Connection-Test/1.0'
      },
      timeout: 15000
    };

    const req = https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.setTimeout(15000);
  });
}

// Run the test
testGLEIFConnection().catch(console.error);

export { testGLEIFConnection };
