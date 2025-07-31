import { executeBetaV2Query } from '../server/beta-v2/database';

// Current stripHTML function
function stripHTML(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50000);
}

async function testNonEnglishCleaning() {
  // Get dumps from different languages
  const result = await executeBetaV2Query(`
    SELECT 
      id,
      domain,
      jsonb_array_element(dump_data->'pages', 0)->>'html' as html
    FROM crawlee_dumps 
    WHERE domain IN ('sakana.ai', 'deepseek.com', 'smarthr.co.jp')
    AND dump_data IS NOT NULL
    ORDER BY created_at DESC
  `);
  
  console.log(`Found ${result.rows.length} dumps to test\n`);
  
  for (const row of result.rows) {
    console.log(`\n=== Testing ${row.domain} ===`);
    const html = row.html;
    if (!html) {
      console.log('No HTML data');
      continue;
    }
    
    console.log('Original HTML length:', html.length);
    
    // Apply current regex cleaning
    const cleaned = stripHTML(html);
    console.log('Cleaned text length:', cleaned.length);
    
    // Show sample of cleaned text
    console.log('\nFirst 1000 characters:');
    console.log(cleaned.substring(0, 1000));
    
    // Check for non-English content
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleaned);
    const hasChinese = /[\u4E00-\u9FFF]/.test(cleaned);
    const hasKorean = /[\uAC00-\uD7AF]/.test(cleaned);
    
    console.log('\nLanguage detection:');
    console.log('Contains Japanese:', hasJapanese);
    console.log('Contains Chinese:', hasChinese);
    console.log('Contains Korean:', hasKorean);
  }
}

testNonEnglishCleaning().catch(console.error);
