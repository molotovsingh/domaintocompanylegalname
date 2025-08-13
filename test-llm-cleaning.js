// Test LLM cleaning service independently
import axios from 'axios';

async function testLLMCleaning() {
  console.log('Testing LLM cleaning service independently...\n');
  
  // Simple HTML content for testing
  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Company Inc.</title>
      <meta name="description" content="Test Company provides innovative solutions">
    </head>
    <body>
      <h1>Welcome to Test Company Inc.</h1>
      <p>We are a leading provider of test services.</p>
      <footer>© 2025 Test Company Inc. All rights reserved.</footer>
    </body>
    </html>
  `;
  
  try {
    console.log('Sending test HTML to LLM cleaning service...');
    console.log('HTML length:', testHtml.length, 'characters\n');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3001/api/beta/crawlee-dump/test-cleaning', {
      html: testHtml,
      domain: 'test-company.com'  // Changed from url to domain
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✅ LLM cleaning completed successfully!');
    console.log('Duration:', duration, 'ms');
    console.log('\nCleaned content preview:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
    
  } catch (error) {
    console.error('❌ LLM cleaning failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Test with larger content
async function testLargerContent() {
  console.log('\n\n=== Testing with larger HTML content ===\n');
  
  // Generate larger HTML (about 10KB)
  const largeHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Big Corporation Ltd.</title>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Big Corporation Ltd.",
        "url": "https://bigcorp.com",
        "logo": "https://bigcorp.com/logo.png"
      }
      </script>
    </head>
    <body>
      <h1>Big Corporation Ltd.</h1>
      ${Array(50).fill(0).map((_, i) => `
        <div class="section">
          <h2>Section ${i + 1}</h2>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        </div>
      `).join('')}
      <footer>© 2025 Big Corporation Ltd. All rights reserved.</footer>
    </body>
    </html>
  `;
  
  try {
    console.log('Sending larger HTML to LLM cleaning service...');
    console.log('HTML length:', largeHtml.length, 'characters\n');
    
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3001/api/beta/crawlee-dump/test-cleaning', {
      html: largeHtml,
      domain: 'bigcorp.com'  // Changed from url to domain
    });
    
    const duration = Date.now() - startTime;
    
    console.log('✅ LLM cleaning completed successfully!');
    console.log('Duration:', duration, 'ms');
    console.log('\nExtracted entity:', response.data.companyName || 'Not found');
    
  } catch (error) {
    console.error('❌ LLM cleaning failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

async function main() {
  await testLLMCleaning();
  await testLargerContent();
}

main().catch(console.error);