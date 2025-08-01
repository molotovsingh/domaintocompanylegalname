import axios from 'axios';
import * as cheerio from 'cheerio';

async function extractMerckFooter() {
  try {
    const response = await axios.get('https://merck.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('=== FOOTER CONTENT EXTRACTION ===\n');
    
    // Extract footer element
    const footer = $('footer');
    if (footer.length > 0) {
      console.log('FOOTER HTML STRUCTURE:');
      console.log(footer.html().substring(0, 1000) + '...\n');
      
      console.log('FOOTER TEXT CONTENT:');
      console.log(footer.text().trim() + '\n');
      
      // Look for copyright specifically
      const copyrightElements = footer.find('*:contains("©"), *:contains("Copyright")');
      console.log('COPYRIGHT ELEMENTS FOUND:', copyrightElements.length);
      
      copyrightElements.each((i, el) => {
        console.log(`Copyright Element ${i + 1}:`, $(el).text().trim());
      });
      
      // Check for specific patterns
      const footerText = footer.text();
      console.log('\nCOPYRIGHT PATTERN ANALYSIS:');
      
      const patterns = [
        /©\s*\d{4}[^.]*?([A-Z][^.]*?)(?:\.|$)/gi,
        /Copyright\s*\d{4}[^.]*?([A-Z][^.]*?)(?:\.|$)/gi,
        /©.*?(Merck[^.]*?)(?:\.|$)/gi,
        /Copyright.*?(Merck[^.]*?)(?:\.|$)/gi
      ];
      
      patterns.forEach((pattern, i) => {
        const matches = [...footerText.matchAll(pattern)];
        console.log(`Pattern ${i + 1} (${pattern.source}): ${matches.length} matches`);
        matches.forEach((match, j) => {
          console.log(`  Match ${j + 1}: "${match[0]}" -> Extract: "${match[1]?.trim()}"`);
        });
      });
    } else {
      console.log('No footer element found');
    }
    
    // Also check body for any copyright
    console.log('\n=== BODY COPYRIGHT SEARCH ===');
    const bodyText = $('body').text();
    const copyrightMatches = [...bodyText.matchAll(/©.*?Merck[^.]*?(?:\.|$)/gi)];
    console.log('Body copyright matches:', copyrightMatches.length);
    copyrightMatches.forEach((match, i) => {
      console.log(`Body Match ${i + 1}: "${match[0]}"`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

extractMerckFooter();