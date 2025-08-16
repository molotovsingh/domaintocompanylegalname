import { claimsNormalizer } from './claimsNormalizationService';

// Test data representing the problematic claims from netflix.com
const problematicClaims = [
  {
    // Claim 0 - Website extraction (snake_case format)
    claim_number: 0,
    claim_type: 'llm_extracted',
    entity_name: 'Netflix',
    confidence_score: 0.9,
    source: 'website_extraction'
  },
  {
    // GLEIF claim with missing entity name in main field
    claim_number: 1,
    claim_type: 'gleif_candidate',
    // entity_name is missing!
    lei_code: '549300Y7VHGU0I7CE873',
    confidence: 0.95,
    source: 'gleif_api',
    metadata: {
      legalName: 'NETFLIX, INC.',  // Entity name is in metadata
      jurisdiction: 'US-DE',
      entityStatus: 'ACTIVE'
    }
  },
  {
    // Mixed format claim
    claimNumber: 2,  // camelCase
    claim_type: 'gleif_candidate',  // snake_case
    entityName: 'netflix inc',  // Needs standardization
    LEICode: '98450076fe4a83a4f419',  // Needs uppercase
    confidence: 100,  // Needs normalization to 0-1
    source: 'gleif_api'
  }
];

async function testNormalization() {
  console.log('=== Testing Claims Normalization Service ===\n');
  console.log('Input claims (with issues):');
  console.log(JSON.stringify(problematicClaims, null, 2));
  
  console.log('\n--- Running Normalization ---\n');
  
  const result = await claimsNormalizer.normalizeClaims(problematicClaims);
  
  console.log('Normalization Result:');
  console.log('Success:', result.success);
  console.log('Stats:', result.stats);
  
  if (result.warnings) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log('  -', w));
  }
  
  if (result.errors) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log('  -', `Claim ${e.claimIndex}: ${e.field} - ${e.issue}`));
  }
  
  console.log('\nNormalized Claims:');
  result.normalizedClaims?.forEach(claim => {
    console.log(`\n  Claim ${claim.claimNumber}:`);
    console.log(`    Entity: ${claim.entityName}`);
    console.log(`    LEI: ${claim.leiCode || 'N/A'}`);
    console.log(`    Confidence: ${(claim.confidence * 100).toFixed(0)}%`);
    console.log(`    Type: ${claim.claimType}`);
    console.log(`    Source: ${claim.source}`);
  });
}

// Run the test
testNormalization().catch(console.error);