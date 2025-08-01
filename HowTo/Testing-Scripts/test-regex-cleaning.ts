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

async function testRegexCleaning() {
  // Get sample HTML from github.com dump
  const result = await executeBetaV2Query(`
    SELECT 
      jsonb_array_element(dump_data->'pages', 0)->>'html' as html
    FROM crawlee_dumps 
    WHERE id = 50 -- github.com
  `);
  
  if (result.rows.length === 0) {
    console.log('No data found');
    return;
  }
  
  const html = result.rows[0].html;
  console.log('Original HTML length:', html.length);
  
  // Apply current regex cleaning
  const cleaned = stripHTML(html);
  console.log('Cleaned text length:', cleaned.length);
  
  // Show first 2000 characters of cleaned text
  console.log('\n=== First 2000 characters of cleaned text ===');
  console.log(cleaned.substring(0, 2000));
  
  // Count common "garbage" patterns in cleaned text
  const patterns = {
    'Skip to content': (cleaned.match(/Skip to content/g) || []).length,
    'Sign in': (cleaned.match(/Sign in/g) || []).length,
    'Sign up': (cleaned.match(/Sign up/g) || []).length,
    'Product': (cleaned.match(/Product/g) || []).length,
    'Solutions': (cleaned.match(/Solutions/g) || []).length,
    'Open Source': (cleaned.match(/Open Source/g) || []).length,
    'aria-': (cleaned.match(/aria-/g) || []).length,
    'data-': (cleaned.match(/data-/g) || []).length,
    'class=': (cleaned.match(/class=/g) || []).length,
    'Cookie': (cleaned.match(/Cookie/g) || []).length,
    'Footer': (cleaned.match(/Footer/g) || []).length,
    'Navigation': (cleaned.match(/Navigation/g) || []).length
  };
  
  console.log('\n=== Common patterns found in cleaned text ===');
  Object.entries(patterns).forEach(([pattern, count]) => {
    if (count > 0) {
      console.log(`${pattern}: ${count} occurrences`);
    }
  });
  
  // Check for navigation/menu content
  const navKeywords = ['Home', 'About', 'Contact', 'Privacy', 'Terms', 'FAQ', 'Help', 'Support'];
  const foundNavKeywords = navKeywords.filter(keyword => 
    cleaned.toLowerCase().includes(keyword.toLowerCase())
  );
  console.log('\n=== Navigation keywords found ===');
  console.log(foundNavKeywords);
}

testRegexCleaning().catch(console.error);