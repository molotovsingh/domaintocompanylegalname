/**
 * GLEIF Corporate Intelligence POC
 * Comprehensive exploration of GLEIF API capabilities for corporate intelligence gathering
 * Tests full breadth of available data while respecting API rate limits
 */

import https from 'https';
import fs from 'fs';

class GLEIFIntelligencePOC {
  constructor() {
    this.baseUrl = 'https://api.gleif.org/api/v1';
    this.requestDelay = 1000; // 1 second between requests to respect rate limits
    this.testResults = {
      entityData: [],
      relationshipData: [],
      fundData: [],
      corporateFlags: new Set(),
      businessClassifications: new Set(),
      legalForms: new Set(),
      jurisdictions: new Set(),
      entityStatuses: new Set(),
      registrationStatuses: new Set(),
      eventTypes: new Set(),
      crossReferences: {
        bic: new Set(),
        mic: new Set(),
        ocid: new Set(),
        qcc: new Set(),
        spglobal: new Set()
      }
    };
  }

  /**
   * Main POC execution
   */
  async runComprehensivePOC() {
    console.log('🔍 Starting GLEIF Corporate Intelligence POC');
    console.log('📊 Testing full breadth of GLEIF API capabilities\n');

    try {
      // Phase 1: Basic Entity Intelligence
      await this.testBasicEntityIntelligence();
      
      // Phase 2: Corporate Relationship Intelligence
      await this.testCorporateRelationships();
      
      // Phase 3: Fund and Investment Intelligence
      await this.testFundIntelligence();
      
      // Phase 4: Cross-Reference Intelligence
      await this.testCrossReferenceIntelligence();
      
      // Phase 5: Search Capabilities Testing
      await this.testSearchCapabilities();
      
      // Generate comprehensive report
      await this.generateIntelligenceReport();
      
    } catch (error) {
      console.error('❌ POC execution failed:', error.message);
    }
  }

  /**
   * Test basic entity data capture capabilities
   */
  async testBasicEntityIntelligence() {
    console.log('📋 Phase 1: Basic Entity Intelligence Testing');
    
    // Test different entity types and categories
    const testEndpoints = [
      { name: 'General Entities', url: '/lei-records?page[size]=10' },
      { name: 'Branch Entities', url: '/lei-records?filter[entity.category]=BRANCH&page[size]=5' },
      { name: 'Fund Entities', url: '/lei-records?filter[entity.category]=FUND&page[size]=5' },
    ];

    for (const endpoint of testEndpoints) {
      console.log(`  Testing: ${endpoint.name}`);
      const data = await this.makeAPIRequest(endpoint.url);
      
      if (data && data.data) {
        for (const record of data.data) {
          this.analyzeEntityRecord(record);
        }
        console.log(`    ✅ Analyzed ${data.data.length} records`);
      }
      
      await this.delay(this.requestDelay);
    }
    
    console.log(`  📊 Found ${this.testResults.entityData.length} unique entity patterns\n`);
  }

  /**
   * Test corporate relationship intelligence
   */
  async testCorporateRelationships() {
    console.log('🏢 Phase 2: Corporate Relationship Intelligence');
    
    // Note: GLEIF relationship API may require specific access
    try {
      const relationshipData = await this.makeAPIRequest('/relationship-records?page[size]=5');
      
      if (relationshipData && relationshipData.data) {
        for (const record of relationshipData.data) {
          this.analyzeRelationshipRecord(record);
        }
        console.log(`  ✅ Analyzed ${relationshipData.data.length} relationship records`);
      } else {
        console.log('  ⚠️  Relationship API may require special access or different endpoint');
      }
    } catch (error) {
      console.log('  ⚠️  Relationship API testing:', error.message);
    }
    
    await this.delay(this.requestDelay);
    console.log('');
  }

  /**
   * Test fund and investment intelligence
   */
  async testFundIntelligence() {
    console.log('💰 Phase 3: Fund and Investment Intelligence');
    
    try {
      const fundData = await this.makeAPIRequest('/lei-records?filter[entity.category]=FUND&page[size]=10');
      
      if (fundData && fundData.data) {
        for (const record of fundData.data) {
          this.analyzeFundRecord(record);
        }
        console.log(`  ✅ Analyzed ${fundData.data.length} fund records`);
      }
    } catch (error) {
      console.log('  ⚠️  Fund intelligence testing:', error.message);
    }
    
    await this.delay(this.requestDelay);
    console.log('');
  }

  /**
   * Test cross-reference intelligence capabilities
   */
  async testCrossReferenceIntelligence() {
    console.log('🔗 Phase 4: Cross-Reference Intelligence');
    
    // Test entities with various cross-reference identifiers
    const crossRefData = await this.makeAPIRequest('/lei-records?page[size]=20');
    
    if (crossRefData && crossRefData.data) {
      let crossRefCount = 0;
      for (const record of crossRefData.data) {
        if (this.analyzeCrossReferences(record)) {
          crossRefCount++;
        }
      }
      console.log(`  ✅ Found cross-references in ${crossRefCount} out of ${crossRefData.data.length} records`);
    }
    
    await this.delay(this.requestDelay);
    console.log('');
  }

  /**
   * Test search capabilities with different patterns
   */
  async testSearchCapabilities() {
    console.log('🔍 Phase 5: Search Capabilities Testing');
    
    const searchTests = [
      { name: 'Country Filter', url: '/lei-records?filter[entity.legalAddress.country]=US&page[size]=5' },
      { name: 'Active Status', url: '/lei-records?filter[entity.status]=ACTIVE&page[size]=5' },
      { name: 'Legal Form Filter', url: '/lei-records?filter[entity.legalForm.id]=XTIQ&page[size]=3' }, // Corporation
    ];

    for (const test of searchTests) {
      console.log(`  Testing: ${test.name}`);
      try {
        const data = await this.makeAPIRequest(test.url);
        if (data && data.data) {
          console.log(`    ✅ Retrieved ${data.data.length} records`);
          for (const record of data.data) {
            this.captureSearchPatterns(record, test.name);
          }
        }
      } catch (error) {
        console.log(`    ⚠️  ${test.name} failed:`, error.message);
      }
      
      await this.delay(this.requestDelay);
    }
    
    console.log('');
  }

  /**
   * Analyze individual entity records for corporate intelligence
   */
  analyzeEntityRecord(record) {
    if (!record.attributes) return;

    const entity = record.attributes.entity;
    const registration = record.attributes.registration;
    
    // Capture all available corporate flags
    const corporateIntelligence = {
      lei: record.attributes.lei,
      legalName: entity?.legalName?.name,
      category: entity?.category,
      subCategory: entity?.subCategory,
      legalForm: entity?.legalForm,
      status: entity?.status,
      jurisdiction: entity?.jurisdiction,
      associatedEntity: entity?.associatedEntity,
      successorEntity: entity?.successorEntity,
      successorEntities: entity?.successorEntities,
      eventGroups: entity?.eventGroups,
      otherNames: entity?.otherNames,
      transliteratedOtherNames: entity?.transliteratedOtherNames,
      registrationStatus: registration?.status,
      corroborationLevel: registration?.corroborationLevel,
      conformityFlag: record.attributes.conformityFlag,
      hasHeadquarters: !!entity?.headquartersAddress,
      hasLegalAddress: !!entity?.legalAddress,
      hasOtherAddresses: !!entity?.otherAddresses
    };

    this.testResults.entityData.push(corporateIntelligence);

    // Collect unique values for analysis
    if (entity?.category) this.testResults.businessClassifications.add(entity.category);
    if (entity?.subCategory) this.testResults.businessClassifications.add(entity.subCategory);
    if (entity?.legalForm?.id) this.testResults.legalForms.add(entity.legalForm.id);
    if (entity?.jurisdiction) this.testResults.jurisdictions.add(entity.jurisdiction);
    if (entity?.status) this.testResults.entityStatuses.add(entity.status);
    if (registration?.status) this.testResults.registrationStatuses.add(registration.status);

    // Capture corporate flags
    if (entity?.associatedEntity) this.testResults.corporateFlags.add('HAS_ASSOCIATED_ENTITY');
    if (entity?.successorEntity) this.testResults.corporateFlags.add('HAS_SUCCESSOR_ENTITY');
    if (entity?.eventGroups) this.testResults.corporateFlags.add('HAS_EVENT_GROUPS');
    if (record.attributes.conformityFlag) this.testResults.corporateFlags.add('CONFORMITY_FLAG_SET');
  }

  /**
   * Analyze relationship records for corporate hierarchy intelligence
   */
  analyzeRelationshipRecord(record) {
    if (record.attributes) {
      const relationship = {
        startNode: record.attributes.startNode,
        endNode: record.attributes.endNode,
        relationshipType: record.attributes.relationshipType,
        relationshipStatus: record.attributes.relationshipStatus,
        relationshipPeriods: record.attributes.relationshipPeriods
      };
      
      this.testResults.relationshipData.push(relationship);
      this.testResults.corporateFlags.add('RELATIONSHIP_DATA_AVAILABLE');
    }
  }

  /**
   * Analyze fund-specific records
   */
  analyzeFundRecord(record) {
    if (record.attributes?.entity?.category === 'FUND') {
      this.testResults.corporateFlags.add('FUND_ENTITY_TYPE');
      
      // Capture fund-specific intelligence
      if (record.attributes.entity.subCategory) {
        this.testResults.corporateFlags.add(`FUND_SUBCATEGORY_${record.attributes.entity.subCategory}`);
      }
    }
  }

  /**
   * Analyze cross-reference identifiers
   */
  analyzeCrossReferences(record) {
    let hasXRef = false;
    const attrs = record.attributes;
    
    if (attrs.bic) {
      this.testResults.crossReferences.bic.add(attrs.bic);
      hasXRef = true;
    }
    if (attrs.mic) {
      this.testResults.crossReferences.mic.add(attrs.mic);
      hasXRef = true;
    }
    if (attrs.ocid) {
      this.testResults.crossReferences.ocid.add(attrs.ocid);
      hasXRef = true;
    }
    if (attrs.qcc) {
      this.testResults.crossReferences.qcc.add(attrs.qcc);
      hasXRef = true;
    }
    if (attrs.spglobal) {
      this.testResults.crossReferences.spglobal.add(attrs.spglobal);
      hasXRef = true;
    }
    
    return hasXRef;
  }

  /**
   * Capture search pattern results
   */
  captureSearchPatterns(record, searchType) {
    // Track which search patterns yield results
    this.testResults.corporateFlags.add(`SEARCH_${searchType.toUpperCase()}_WORKS`);
  }

  /**
   * Make API request with error handling and rate limiting
   */
  async makeAPIRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      
      const req = https.get(url, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'GLEIF-Intelligence-POC/1.0'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              console.log(`    ⚠️  API returned ${res.statusCode}: ${res.statusMessage}`);
              resolve(null);
            }
          } catch (e) {
            console.log('    ⚠️  JSON parse error:', e.message);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.log('    ❌ Request failed:', e.message);
        resolve(null);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        console.log('    ⚠️  Request timeout');
        resolve(null);
      });
    });
  }

  /**
   * Generate comprehensive intelligence report
   */
  async generateIntelligenceReport() {
    console.log('📊 GLEIF Corporate Intelligence POC Results');
    console.log('=' .repeat(60));
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        entitiesAnalyzed: this.testResults.entityData.length,
        relationshipsFound: this.testResults.relationshipData.length,
        corporateFlagsDiscovered: this.testResults.corporateFlags.size,
        uniqueJurisdictions: this.testResults.jurisdictions.size,
        uniqueLegalForms: this.testResults.legalForms.size,
        businessClassifications: this.testResults.businessClassifications.size,
        crossReferenceSystems: Object.keys(this.testResults.crossReferences).filter(
          key => this.testResults.crossReferences[key].size > 0
        ).length
      },
      corporateIntelligenceCapabilities: {
        corporateFlags: Array.from(this.testResults.corporateFlags).sort(),
        businessClassifications: Array.from(this.testResults.businessClassifications).sort(),
        entityStatuses: Array.from(this.testResults.entityStatuses).sort(),
        registrationStatuses: Array.from(this.testResults.registrationStatuses).sort(),
        jurisdictions: Array.from(this.testResults.jurisdictions).sort(),
        legalForms: Array.from(this.testResults.legalForms).sort(),
        crossReferenceSystems: {
          bic: this.testResults.crossReferences.bic.size,
          mic: this.testResults.crossReferences.mic.size,
          ocid: this.testResults.crossReferences.ocid.size,
          qcc: this.testResults.crossReferences.qcc.size,
          spglobal: this.testResults.crossReferences.spglobal.size
        }
      },
      sampleData: {
        entities: this.testResults.entityData.slice(0, 3),
        relationships: this.testResults.relationshipData.slice(0, 2)
      },
      implementationRecommendations: this.generateImplementationRecommendations()
    };

    console.log(`📈 Entities Analyzed: ${report.summary.entitiesAnalyzed}`);
    console.log(`🔗 Relationships Found: ${report.summary.relationshipsFound}`);
    console.log(`🏷️  Corporate Flags Discovered: ${report.summary.corporateFlagsDiscovered}`);
    console.log(`🌍 Unique Jurisdictions: ${report.summary.uniqueJurisdictions}`);
    console.log(`📋 Legal Forms: ${report.summary.uniqueLegalForms}`);
    console.log(`🔗 Cross-Reference Systems: ${report.summary.crossReferenceSystems}`);

    console.log('\n🏷️  Corporate Intelligence Flags Discovered:');
    report.corporateIntelligenceCapabilities.corporateFlags.forEach(flag => {
      console.log(`  • ${flag}`);
    });

    console.log('\n💼 Business Classifications Available:');
    report.corporateIntelligenceCapabilities.businessClassifications.forEach(classification => {
      console.log(`  • ${classification}`);
    });

    console.log('\n🔗 Cross-Reference Systems:');
    Object.entries(report.corporateIntelligenceCapabilities.crossReferenceSystems).forEach(([system, count]) => {
      if (count > 0) {
        console.log(`  • ${system.toUpperCase()}: ${count} entities`);
      }
    });

    // Save detailed report
    fs.writeFileSync('gleif_intelligence_report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Detailed report saved to: gleif_intelligence_report.json');
    
    console.log('\n🎯 Implementation Recommendations:');
    report.implementationRecommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }

  /**
   * Generate implementation recommendations based on discovered capabilities
   */
  generateImplementationRecommendations() {
    const recommendations = [];
    
    if (this.testResults.corporateFlags.has('HAS_ASSOCIATED_ENTITY')) {
      recommendations.push('Implement corporate hierarchy mapping using associatedEntity field');
    }
    
    if (this.testResults.corporateFlags.has('HAS_SUCCESSOR_ENTITY')) {
      recommendations.push('Track M&A activity through successorEntity data');
    }
    
    if (this.testResults.crossReferences.bic.size > 0) {
      recommendations.push('Integrate BIC cross-referencing for banking entity verification');
    }
    
    if (this.testResults.businessClassifications.has('FUND')) {
      recommendations.push('Develop specialized fund entity processing pipeline');
    }
    
    if (this.testResults.jurisdictions.size > 10) {
      recommendations.push('Implement multi-jurisdictional entity classification system');
    }
    
    recommendations.push('Expand current GLEIFEntity interface to capture all discovered corporate flags');
    recommendations.push('Implement cross-reference storage for multi-system entity verification');
    recommendations.push('Create corporate relationship mapping service for hierarchy intelligence');
    
    return recommendations;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute POC
async function runPOC() {
  const poc = new GLEIFIntelligencePOC();
  await poc.runComprehensivePOC();
}

// Execute POC if run directly
runPOC().catch(console.error);