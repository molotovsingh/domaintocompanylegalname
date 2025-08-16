import { claimsNormalizer } from './claimsNormalizationService';

// This test suite addresses actual production issues encountered in Netflix domain analysis

// Test problematic claim data that mimics real-world Netflix.com analysis issues
const problematicClaims = [
  // Claim 0: Website extraction with proper snake_case format
  {
    claim_number: 0,
    claim_type: 'website_claim',
    entity_name: 'Netflix, Inc.',
    lei_code: null,
    confidence_score: 0.8,
    source: 'website_extraction',
    metadata: {
      legal_name: 'Netflix, Inc.',
      jurisdiction: 'US',
      entity_status: 'ACTIVE'
    }
  },
  // Claim 1: Missing entity_name but has data in metadata (real issue from Netflix analysis)
  // This scenario frequently occurs when GLEIF data lacks standardized entity_name field
  {
    claimNumber: 1,
    claimType: 'gleif_candidate',
    // entity_name: missing!
    leiCode: '549300DHLU0E2WR7M436',
    confidence: 0.95,
    source: 'gleif_search',
    metadata: {
      legalName: 'Netflix International Holdings B.V.',
      jurisdiction: 'NL',
      entityStatus: 'ACTIVE',
      legalForm: 'Besloten Vennootschap',
      headquarters: {
        city: 'Amsterdam',
        country: 'NL'
      }
    }
  },
  // Claim 2: Mixed camelCase and snake_case with confidence in percentage (another real issue)
  // This mixed-format scenario is common when integrating multiple data sources
  {
    claim_number: 2, // snake_case
    claimType: 'llm_extracted', // camelCase
    entityName: 'Netflix Entertainment Services, Inc.', // camelCase
    lei_code: null, // snake_case
    confidence_score: 85, // Percentage instead of 0-1 range
    source: 'llm_extraction',
    metadata: {
      legal_form: 'Corporation',
      jurisdiction: 'US',
      entityStatus: 'ACTIVE' // Mixed case in metadata too
    }
  }
];

// Consider converting to automated unit test framework for CI/CD integration
async function testNormalization() {
  console.log('🧪 Testing Claims Normalization Service with problematic data...\n');

  try {
    const result = await claimsNormalizer.normalizeClaims(problematicClaims);

    console.log('📊 Normalization Result:');
    console.log('Success:', result.success);
    console.log('Stats:', result.stats);

    if (result.errors) {
      console.log('\n❌ Validation Errors:');
      result.errors.forEach(error => {
        console.log(`  - Claim ${error.claimIndex}, field '${error.field}': ${error.issue}`);
      });
    }

    if (result.warnings) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }

    if (result.normalizedClaims) {
      console.log('\n✅ Normalized Claims:');
      result.normalizedClaims.forEach(claim => {
        console.log(`  Claim ${claim.claimNumber}: ${claim.entityName} (confidence: ${claim.confidence})`);
      });
    }

  } catch (error) {
    console.error('💥 Normalization test failed:', error);
  }
}

// Run the test
// Recommendation: Add command-line argument support for different test scenarios
testNormalization();