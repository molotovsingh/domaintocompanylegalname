
/**
 * Test script for GLEIF debug endpoint
 */

async function testGleifDebug() {
  try {
    console.log('🔍 Testing GLEIF Debug Endpoint...');
    
    const response = await fetch('http://0.0.0.0:3001/api/beta/gleif-debug', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    console.log('✅ Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ GLEIF Debug Test Successful');
      console.log('🔗 Basic Connection:', data.tests.basicConnection.success ? '✅' : '❌');
      console.log('🍎 Apple Search:', data.tests.appleSearch.success ? '✅' : '❌');
      
      if (data.tests.appleSearch.error) {
        console.log('❌ Apple Search Error:', data.tests.appleSearch.error);
      }
    } else {
      console.log('❌ GLEIF Debug Test Failed:', data.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

// Run the test
testGleifDebug();
