/**
 * Test Geographic Marker Extraction System
 * Validates the enhanced GLEIF selection with geographic intelligence
 */

import { DomainExtractor } from './server/services/domainExtractor.js';

async function testGeographicExtraction() {
  console.log('Testing Geographic Marker Extraction System...\n');
  
  const extractor = new DomainExtractor();
  
  const testDomains = [
    'wildenstein.com', // US art dealer
    'deutsche-bank.de', // German bank
    'toyota.co.jp', // Japanese manufacturer
    'baidu.com', // Chinese tech
    'santander.com.br' // Brazilian bank
  ];
  
  for (const domain of testDomains) {
    console.log(`\n=== Testing ${domain} ===`);
    
    try {
      const result = await extractor.extractCompanyName(domain);
      
      console.log(`Company Name: ${result.companyName || 'N/A'}`);
      console.log(`Extraction Method: ${result.method}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Guessed Country: ${result.guessedCountry || 'N/A'}`);
      
      if (result.geographicMarkers) {
        console.log('Geographic Markers Found:');
        console.log(`- Detected Countries: ${result.geographicMarkers.detectedCountries.join(', ') || 'None'}`);
        console.log(`- Phone Country Codes: ${result.geographicMarkers.phoneCountryCodes.join(', ') || 'None'}`);
        console.log(`- Address Mentions: ${result.geographicMarkers.addressMentions.length} found`);
        console.log(`- Currency Symbols: ${result.geographicMarkers.currencySymbols.join(', ') || 'None'}`);
        console.log(`- Legal Jurisdictions: ${result.geographicMarkers.legalJurisdictions.join(', ') || 'None'}`);
        console.log(`- Language Indicators: ${result.geographicMarkers.languageIndicators.join(', ') || 'None'}`);
        console.log(`- Geographic Confidence: ${result.geographicMarkers.confidenceScore}%`);
      }
      
      console.log(`Status: ${result.companyName ? 'SUCCESS' : 'FAILED'}`);
      
    } catch (error) {
      console.log(`ERROR: ${error.message}`);
    }
  }
  
  console.log('\n=== Geographic Extraction Test Complete ===');
}

// Run the test
testGeographicExtraction().catch(console.error);