import { Router } from 'express';
import { storage } from './pgStorage';

const router = Router();

// Search entities and domains with intelligence
router.get('/api/intelligence/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ entities: [], domains: [] });
    }

    const searchTerm = q.toLowerCase();

    // Search entities by name or LEI
    const entities = await storage.query(`
      SELECT 
        lei_code,
        legal_name,
        entity_status,
        jurisdiction,
        discovery_frequency,
        last_seen_date
      FROM gleif_entities 
      WHERE LOWER(legal_name) LIKE $1 
         OR LOWER(lei_code) LIKE $1
      ORDER BY discovery_frequency DESC, legal_name
      LIMIT 10
    `, [`%${searchTerm}%`]);

    // Search domains
    const domains = await storage.query(`
      SELECT 
        domain,
        company_name,
        confidence_score,
        status
      FROM domains 
      WHERE LOWER(domain) LIKE $1 
         OR LOWER(company_name) LIKE $1
      ORDER BY confidence_score DESC, domain
      LIMIT 10
    `, [`%${searchTerm}%`]);

    res.json({
      entities: entities.rows || [],
      domains: domains.rows || []
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get comprehensive entity intelligence
router.get('/api/intelligence/entity/:leiCode', async (req, res) => {
  try {
    const { leiCode } = req.params;

    // Get entity details
    const entity = await storage.getGleifEntity?.(leiCode);
    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Get domain mappings
    const domainMappings = await storage.query(`
      SELECT 
        dem.*,
        d.domain,
        d.company_name,
        d.confidence_score
      FROM domain_entity_mappings dem
      JOIN domains d ON dem.domain = d.domain
      WHERE dem.lei_code = $1
      ORDER BY dem.mapping_confidence DESC
    `, [leiCode]);

    // Get relationships
    const relationships = await storage.query(`
      SELECT 
        er.*,
        ge1.legal_name as parent_name,
        ge2.legal_name as child_name
      FROM entity_relationships er
      LEFT JOIN gleif_entities ge1 ON er.parent_lei = ge1.lei_code
      LEFT JOIN gleif_entities ge2 ON er.child_lei = ge2.lei_code
      WHERE er.parent_lei = $1 OR er.child_lei = $1
      ORDER BY er.relationship_confidence DESC
    `, [leiCode]);

    // Discovery history
    const discoveryHistory = {
      firstDiscovered: entity.first_discovered_date,
      lastSeen: entity.last_seen_date,
      discoveryFrequency: entity.discovery_frequency,
      totalDomainMappings: domainMappings.rows?.length || 0
    };

    res.json({
      entity,
      domainMappings: domainMappings.rows || [],
      relationships: relationships.rows || [],
      discoveryHistory
    });
  } catch (error) {
    console.error('Entity intelligence error:', error);
    res.status(500).json({ error: 'Failed to get entity intelligence' });
  }
});

// Get knowledge graph statistics
router.get('/api/intelligence/stats', async (req, res) => {
  try {
    const stats = await storage.query(`
      SELECT 
        (SELECT COUNT(*) FROM gleif_entities) as total_entities,
        (SELECT COUNT(*) FROM domain_entity_mappings) as total_mappings,
        (SELECT COUNT(*) FROM entity_relationships) as total_relationships,
        (SELECT COUNT(DISTINCT jurisdiction) FROM gleif_entities) as jurisdictions,
        (SELECT AVG(discovery_frequency) FROM gleif_entities) as avg_discovery_frequency
    `);

    const topEntities = await storage.query(`
      SELECT legal_name, discovery_frequency, jurisdiction
      FROM gleif_entities
      ORDER BY discovery_frequency DESC
      LIMIT 10
    `);

    res.json({
      summary: stats.rows?.[0] || {},
      topEntities: topEntities.rows || []
    });
  } catch (error) {
    console.error('Intelligence stats error:', error);
    res.status(500).json({ error: 'Failed to get intelligence stats' });
  }
});

// GLEIF Data Completeness Diagnostic
router.get('/api/gleif/data-completeness/:domain', async (req, res) => {
  try {
    const { domain } = req.params;

    // Get domain intelligence
    const intelligence = await gleifKnowledgeBase.getDomainIntelligence(domain);

    if (intelligence.entities.length === 0) {
      return res.json({
        domain,
        status: 'no_entities',
        message: 'No GLEIF entities found for this domain'
      });
    }

    // Analyze data completeness for each entity
    const entityAnalysis = intelligence.entities.map(entity => {
      const rawData = entity.gleifFullData ? JSON.parse(entity.gleifFullData) : {};
      const enhancedData = rawData.enhancedData || {};

      return {
        lei: entity.leiCode,
        legalName: entity.legalName,
        dataCompleteness: enhancedData.dataCompleteness || {
          score: 0,
          availableFields: [],
          missingFields: [],
          qualityIndicators: {}
        },
        capturedFields: {
          coreEntityData: {
            lei: !!entity.leiCode,
            legalName: !!entity.legalName,
            entityStatus: !!entity.entityStatus,
            jurisdiction: !!entity.jurisdiction,
            legalForm: !!entity.legalForm,
            registrationStatus: !!entity.registrationStatus
          },
          addressIntelligence: {
            headquartersCountry: !!entity.headquartersCountry,
            headquartersCity: !!entity.headquartersCity,
            legalAddressCountry: !!entity.legalAddressCountry,
            legalAddressCity: !!entity.legalAddressCity
          },
          enhancedIntelligence: {
            legalFormDetails: !!enhancedData.legalFormDetails,
            registrationAuthority: !!enhancedData.registrationAuthority,
            entityLifecycle: !!enhancedData.entityLifecycle,
            businessClassification: !!enhancedData.businessClassification,
            financialCodes: !!enhancedData.financialCodes,
            corporateIntelligence: !!enhancedData.corporateIntelligence,
            extensionData: !!enhancedData.extensionData
          }
        },
        rawDataSize: JSON.stringify(rawData).length,
        lastUpdated: entity.lastGleifUpdate
      };
    });

    // Calculate overall statistics
    const avgCompleteness = Math.round(
      entityAnalysis.reduce((sum, e) => sum + e.dataCompleteness.score, 0) / entityAnalysis.length
    );

    const fieldAvailability = {
      coreData: entityAnalysis.filter(e => e.dataCompleteness.qualityIndicators?.hasCoreData).length,
      completeAddress: entityAnalysis.filter(e => e.dataCompleteness.qualityIndicators?.hasCompleteAddress).length,
      enhancedData: entityAnalysis.filter(e => e.dataCompleteness.qualityIndicators?.hasEnhancedData).length
    };

    res.json({
      domain,
      status: 'analysis_complete',
      summary: {
        totalEntities: entityAnalysis.length,
        averageCompleteness: avgCompleteness,
        fieldAvailability,
        dataQuality: avgCompleteness > 80 ? 'excellent' : avgCompleteness > 60 ? 'good' : 'basic'
      },
      entities: entityAnalysis,
      gleifCapabilities: {
        availableFields: [
          'LEI Code', 'Legal Name', 'Entity Status', 'Jurisdiction', 'Legal Form',
          'Registration Status', 'Headquarters Address', 'Legal Address',
          'Other Entity Names', 'Registration Date', 'Legal Form Details',
          'Registration Authority', 'Entity Lifecycle', 'Business Classification',
          'BIC Codes', 'Successor Entity', 'Extension Data'
        ],
        dataTypes: ['Core Entity', 'Address Intelligence', 'Corporate Relationships', 'Financial Codes', 'Regulatory Data']
      }
    });

  } catch (error) {
    console.error('GLEIF data completeness analysis failed:', error);
    res.status(500).json({ 
      error: 'Failed to analyze GLEIF data completeness',
      details: error.message 
    });
  }
});

export default router;