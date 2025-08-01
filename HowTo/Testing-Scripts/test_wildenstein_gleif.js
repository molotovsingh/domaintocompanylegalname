/**
 * Test Wildenstein GLEIF Selection Algorithm
 * Direct test of enhanced geographic intelligence algorithm
 */

async function testWildensteinGLEIF() {
  console.log('🔍 Testing Enhanced GLEIF Selection Algorithm for wildenstein.com\n');
  
  // Direct GLEIF API search for "wildenstein"
  const searchUrl = 'https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=*wildenstein*';
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Domain-Intelligence-System/1.0'
      }
    });
    
    const data = await response.json();
    console.log(`📊 Found ${data.data?.length || 0} GLEIF entities for "wildenstein"`);
    
    if (!data.data || data.data.length === 0) {
      console.log('❌ No GLEIF entities found for wildenstein');
      return;
    }
    
    // Transform GLEIF API response to our format
    const entities = data.data.map(record => ({
      lei: record.id,
      legalName: record.attributes.entity.legalName.name,
      entityStatus: record.attributes.entity.status,
      registrationStatus: record.attributes.registration.status,
      jurisdiction: record.attributes.entity.jurisdiction,
      legalForm: record.attributes.entity.legalForm?.id || 'Unknown',
      entityCategory: record.attributes.entity.category || 'Unknown',
      headquarters: {
        country: record.attributes.entity.legalAddress?.country || 'Unknown'
      }
    }));
    
    console.log('\n📋 All Wildenstein Entities:');
    entities.forEach((entity, i) => {
      console.log(`${i + 1}. ${entity.legalName}`);
      console.log(`   LEI: ${entity.lei}`);
      console.log(`   Status: ${entity.entityStatus} / ${entity.registrationStatus}`);
      console.log(`   Jurisdiction: ${entity.jurisdiction}`);
      console.log(`   Legal Form: ${entity.legalForm}`);
      console.log('');
    });
    
    // Apply Enhanced Selection Algorithm
    console.log('🧠 Applying Enhanced Geographic Intelligence Algorithm:\n');
    
    const domain = 'wildenstein.com';
    const extractedName = 'Wildenstein';
    
    const scoredEntities = entities.map(entity => {
      const scores = calculateEnhancedScores(entity, domain, extractedName);
      return { ...entity, ...scores };
    }).sort((a, b) => b.totalScore - a.totalScore);
    
    console.log('🏆 Enhanced Selection Results:');
    scoredEntities.forEach((entity, i) => {
      console.log(`${i + 1}. ${entity.legalName} (Score: ${entity.totalScore})`);
      console.log(`   TLD Score: ${entity.domainTldScore} | Name Match: ${entity.nameMatchScore}`);
      console.log(`   Entity Type: ${entity.entityComplexityScore} | Status: ${entity.statusScore}`);
      console.log(`   Selection Logic: ${entity.selectionReason}`);
      console.log('');
    });
    
    const winner = scoredEntities[0];
    console.log(`\n✅ SELECTED: ${winner.legalName}`);
    console.log(`📍 LEI: ${winner.lei}`);
    console.log(`🎯 Total Score: ${winner.totalScore}`);
    console.log(`📝 Reason: ${winner.selectionReason}`);
    
    // Compare with old vs new algorithm
    const oldWinner = entities.find(e => e.lei === '984500DE0E9EEC086413'); // Austrian foundation
    const newWinner = entities.find(e => e.lei === '549300QL3ULKHN32OM67'); // US corporation
    
    console.log('\n🔄 Algorithm Comparison:');
    console.log(`❌ Old Selection: ${oldWinner?.legalName || 'Not found'} (Austrian Foundation)`);
    console.log(`✅ New Selection: ${winner.legalName} (${winner.jurisdiction})`);
    console.log(`🎉 Geographic Intelligence ${winner.lei === '549300QL3ULKHN32OM67' ? 'SUCCESS' : 'NEEDS TUNING'}`);
    
  } catch (error) {
    console.error('❌ Error testing GLEIF selection:', error.message);
  }
}

function calculateEnhancedScores(entity, domain, extractedName) {
  // Enhanced TLD Score with Geographic Intelligence
  const domainTldScore = calculateDomainTldScore(entity, domain);
  
  // Name Match Score
  const nameMatchScore = calculateNameMatchScore(entity, extractedName);
  
  // Entity Complexity Score (Commercial vs Foundation preference)
  const entityComplexityScore = calculateEntityComplexityScore(entity, domain);
  
  // Status Score (reduced LAPSED penalty for ACTIVE entities)
  const statusScore = calculateStatusScore(entity);
  
  // Weighted scoring: TLD (30%) + Name Match (30%) + Entity Type (25%) + Status (15%)
  const totalScore = Math.round(
    (domainTldScore * 0.30) + 
    (nameMatchScore * 0.30) + 
    (entityComplexityScore * 0.25) + 
    (statusScore * 0.15)
  );
  
  const selectionReason = generateSelectionReason(entity, domain, {
    domainTldScore,
    nameMatchScore, 
    entityComplexityScore,
    statusScore
  });
  
  return {
    domainTldScore,
    nameMatchScore,
    entityComplexityScore,
    statusScore,
    totalScore,
    selectionReason
  };
}

function calculateDomainTldScore(entity, domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const jurisdiction = entity.jurisdiction;
  
  // Enhanced .com domain logic - heavily favor US entities
  if (tld === 'com') {
    if (jurisdiction === 'US') return 95; // Strong US preference for .com
    if (['CA', 'GB', 'AU'].includes(jurisdiction)) return 60; // Commonwealth preference
    return 15; // Penalty for non-US entities on .com domains
  }
  
  // Country TLD matching
  const tldCountryMap = {
    'uk': 'GB', 'de': 'DE', 'fr': 'FR', 'jp': 'JP', 
    'au': 'AU', 'ca': 'CA', 'ch': 'CH', 'at': 'AT'
  };
  
  const expectedCountry = tldCountryMap[tld];
  if (expectedCountry && jurisdiction === expectedCountry) return 90;
  
  return 30; // Default score
}

function calculateNameMatchScore(entity, extractedName) {
  const legalName = entity.legalName.toLowerCase();
  const searchTerm = extractedName.toLowerCase();
  
  if (legalName.includes(searchTerm)) {
    // Exact match gets highest score
    if (legalName.startsWith(searchTerm)) return 95;
    return 80;
  }
  
  // Partial similarity
  if (searchTerm.includes(legalName.split(' ')[0])) return 60;
  return 30;
}

function calculateEntityComplexityScore(entity, domain) {
  const legalForm = entity.legalForm.toLowerCase();
  const legalName = entity.legalName.toLowerCase();
  
  // For .com domains, prefer commercial entities over foundations
  if (domain.endsWith('.com')) {
    // Commercial entity types get bonus
    if (legalForm.includes('inc') || legalForm.includes('corp') || 
        legalName.includes('inc.') || legalName.includes('corp')) {
      return 90;
    }
    
    // Foundation/charitable entities get penalty on commercial domains
    if (legalForm.includes('stiftung') || legalForm.includes('foundation') ||
        legalName.includes('stiftung') || legalName.includes('foundation')) {
      return 25;
    }
  }
  
  return 60; // Default score
}

function calculateStatusScore(entity) {
  if (entity.entityStatus === 'ACTIVE') {
    // Reduced penalty for LAPSED registration if entity is still ACTIVE
    if (entity.registrationStatus === 'LAPSED') return 70;
    if (entity.registrationStatus === 'ISSUED') return 95;
  }
  
  if (entity.entityStatus === 'INACTIVE') return 20;
  return 50; // Default
}

function generateSelectionReason(entity, domain, scores) {
  const reasons = [];
  
  if (domain.endsWith('.com') && entity.jurisdiction === 'US') {
    reasons.push('.com domain favors US entity (+95 TLD score)');
  }
  
  if (scores.entityComplexityScore >= 80) {
    reasons.push('Commercial entity preferred for business domain');
  } else if (scores.entityComplexityScore <= 30) {
    reasons.push('Foundation penalized on commercial domain');
  }
  
  if (entity.registrationStatus === 'LAPSED' && entity.entityStatus === 'ACTIVE') {
    reasons.push('LAPSED registration acceptable for ACTIVE entity');
  }
  
  if (scores.nameMatchScore >= 80) {
    reasons.push('Strong name match with extracted term');
  }
  
  return reasons.join('; ') || 'Standard scoring applied';
}

// Run the test
testWildensteinGLEIF().catch(console.error);