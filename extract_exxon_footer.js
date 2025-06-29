import axios from 'axios';
import * as cheerio from 'cheerio';

async function extractExxonFooter() {
  try {
    const response = await axios.get('https://corporate.exxonmobil.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('=== EXXONMOBIL FOOTER CONTENT EXTRACTION ===\n');
    
    // Extract footer element
    const footer = $('footer');
    if (footer.length > 0) {
      console.log('FOOTER HTML STRUCTURE:');
      console.log(footer.html().substring(0, 1000) + '...\n');
      
      console.log('FOOTER TEXT CONTENT:');
      const footerText = footer.text().trim();
      console.log(footerText + '\n');
      
      // Look for copyright specifically
      const copyrightElements = footer.find('*:contains("©"), *:contains("Copyright")');
      console.log('COPYRIGHT ELEMENTS FOUND:', copyrightElements.length);
      
      copyrightElements.each((i, el) => {
        console.log(`Copyright Element ${i + 1}:`, $(el).text().trim());
      });
      
      // Check for specific patterns
      console.log('\nCOPYRIGHT PATTERN ANALYSIS:');
      
      const patterns = [
        /©\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi,
        /Copyright\s*\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi,
        /\d{4}[^A-Za-z]*([A-Z][\w\s&,.'-]+?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company))/gi,
        /©.*?(Exxon[^.]*?)(?:\.|$)/gi,
        /Copyright.*?(Exxon[^.]*?)(?:\.|$)/gi
      ];
      
      patterns.forEach((pattern, i) => {
        const matches = [...footerText.matchAll(pattern)];
        console.log(`Pattern ${i + 1} (${pattern.source}): ${matches.length} matches`);
        matches.forEach((match, j) => {
          console.log(`  Match ${j + 1}: "${match[0]}" -> Extract: "${match[1]?.trim()}"`);
        });
      });
      
      // Check the very last line of footer
      const footerLines = footerText.split('\n').filter(line => line.trim().length > 0);
      console.log('\nLAST LINE ANALYSIS:');
      console.log(`Total non-empty lines: ${footerLines.length}`);
      if (footerLines.length > 0) {
        console.log(`Last line: "${footerLines[footerLines.length - 1].trim()}"`);
        
        // Check if last line contains legal entity info
        const lastLine = footerLines[footerLines.length - 1].trim();
        const legalPatterns = [
          /Exxon[^.]*?(?:Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|LLC|Company)/gi,
          /©.*?(Exxon[^.]*?)(?:\.|$)/gi,
          /Copyright.*?(Exxon[^.]*?)(?:\.|$)/gi
        ];
        
        legalPatterns.forEach((pattern, i) => {
          const matches = [...lastLine.matchAll(pattern)];
          console.log(`Last line pattern ${i + 1}: ${matches.length} matches`);
          matches.forEach((match, j) => {
            console.log(`  Last line match ${j + 1}: "${match[0]}" -> Extract: "${match[1]?.trim() || match[0]}"`);
          });
        });
      }
    } else {
      console.log('No footer element found');
    }
    
    // Also check body for any copyright
    console.log('\n=== BODY COPYRIGHT SEARCH ===');
    const bodyText = $('body').text();
    const copyrightMatches = [...bodyText.matchAll(/©.*?Exxon[^.]*?(?:\.|$)/gi)];
    console.log('Body copyright matches:', copyrightMatches.length);
    copyrightMatches.forEach((match, i) => {
      console.log(`Body Match ${i + 1}: "${match[0]}"`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

extractExxonFooter();