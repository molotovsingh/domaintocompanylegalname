import { storage } from '../pgStorage';
import { 
  Domain, 
  GleifEntity, 
  InsertGleifEntity,
  DomainEntityMapping,
  InsertDomainEntityMapping,
  EntityRelationship,
  InsertEntityRelationship
} from '../../shared/schema';

// GLEIF API Entity interface
interface GLEIFEntity {
  lei: string;
  legalName: string;
  entityStatus: string;
  jurisdiction: string;
  legalForm: string;
  entityCategory: string;
  registrationStatus: string;
  headquarters: {
    country: string;
    region: string;
    city: string;
    addressLines: string[];
    postalCode: string;
  };
  legalAddress: {
    country: string;
    region: string;
    city: string;
    addressLines: string[];
    postalCode: string;
  };
  otherNames: string[];
  registrationDate: string;
  lastUpdateDate: string;
}

/**
 * GLEIF Knowledge Base Service
 * Accumulates and manages comprehensive GLEIF entity intelligence
 */
export class GLEIFKnowledgeBase {
  
  /**
   * Store all GLEIF entities discovered during search (not just primary selection)
   * Accumulates intelligence over time with frequency tracking
   */
  async accumulateEntities(
    entities: GLEIFEntity[], 
    domain: Domain,
    searchMethod: string,
    primaryLeiCode?: string
  ): Promise<void> {
    console.log(`Accumulating ${entities.length} GLEIF entities for domain: ${domain.domain}`);
    
    for (const entity of entities) {
      await this.storeOrUpdateEntity(entity);
      await this.mapDomainToEntity(domain, entity, searchMethod, entity.lei === primaryLeiCode);
    }
    
    // Track potential corporate relationships
    if (entities.length > 1) {
      await this.discoverEntityRelationships(entities, 'gleif_search');
    }
  }

  /**
   * Store or update entity in master database with frequency tracking
   */
  private async storeOrUpdateEntity(entity: GLEIFEntity): Promise<void> {
    try {
      // Check if entity already exists
      const existingEntity = await storage.getGleifEntity?.(entity.lei);
      
      if (existingEntity) {
        // Update existing entity with frequency tracking
        await storage.updateGleifEntity?.(entity.lei, {
          discoveryFrequency: existingEntity.discoveryFrequency + 1,
          lastSeenDate: new Date().toISOString(),
          lastGleifUpdate: entity.lastUpdateDate,
          // Update any changed data
          legalName: entity.legalName,
          entityStatus: entity.entityStatus,
          registrationStatus: entity.registrationStatus,
          gleifFullData: JSON.stringify(entity)
        });
        console.log(`Updated entity frequency for ${entity.lei}: ${existingEntity.discoveryFrequency + 1}`);
      } else {
        // Create new entity record
        const newEntity: InsertGleifEntity = {
          leiCode: entity.lei,
          legalName: entity.legalName,
          entityStatus: entity.entityStatus,
          jurisdiction: entity.jurisdiction,
          legalForm: entity.legalForm,
          entityCategory: entity.entityCategory,
          registrationStatus: entity.registrationStatus,
          
          // Address Intelligence
          headquartersCountry: entity.headquarters.country,
          headquartersCity: entity.headquarters.city,
          headquartersRegion: entity.headquarters.region,
          headquartersPostalCode: entity.headquarters.postalCode,
          legalAddressCountry: entity.legalAddress.country,
          legalAddressCity: entity.legalAddress.city,
          legalAddressRegion: entity.legalAddress.region,
          legalAddressPostalCode: entity.legalAddress.postalCode,
          
          // Entity Intelligence
          otherNames: entity.otherNames,
          registrationDate: entity.registrationDate,
          lastGleifUpdate: entity.lastUpdateDate,
          
          // Full GLEIF Data Archive
          gleifFullData: JSON.stringify(entity)
        };
        
        await storage.createGleifEntity?.(newEntity);
        console.log(`Stored new entity: ${entity.lei} - ${entity.legalName}`);
      }
    } catch (error) {
      console.error(`Failed to store entity ${entity.lei}:`, error);
    }
  }

  /**
   * Map domain to entity relationship with confidence tracking
   */
  private async mapDomainToEntity(
    domain: Domain, 
    entity: GLEIFEntity, 
    searchMethod: string,
    isPrimary: boolean
  ): Promise<void> {
    try {
      // Check if mapping already exists
      const existingMapping = await storage.getDomainEntityMapping?.(domain.domain, entity.lei);
      
      if (existingMapping) {
        // Update mapping frequency and confidence
        await storage.updateDomainEntityMapping?.(existingMapping.id, {
          mappingFrequency: existingMapping.mappingFrequency + 1,
          lastConfirmedDate: new Date(),
          isPrimarySelection: isPrimary || existingMapping.isPrimarySelection
        });
      } else {
        // Create new domain-entity mapping
        const confidence = this.calculateMappingConfidence(domain, entity, searchMethod);
        
        const newMapping: InsertDomainEntityMapping = {
          domain: domain.domain,
          leiCode: entity.lei,
          mappingConfidence: confidence,
          discoveryMethod: searchMethod,
          isPrimarySelection: isPrimary,
          selectionReason: this.generateMappingReason(domain, entity, confidence)
        };
        
        await storage.createDomainEntityMapping?.(newMapping);
        console.log(`Mapped ${domain.domain} → ${entity.lei} (confidence: ${confidence}%)`);
      }
    } catch (error) {
      console.error(`Failed to map domain ${domain.domain} to entity ${entity.lei}:`, error);
    }
  }

  /**
   * Discover and store potential corporate relationships
   */
  private async discoverEntityRelationships(
    entities: GLEIFEntity[], 
    discoveryMethod: string
  ): Promise<void> {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Analyze potential relationships
        const relationship = this.analyzeEntityRelationship(entity1, entity2);
        
        if (relationship) {
          try {
            const newRelationship: InsertEntityRelationship = {
              parentLei: relationship.parentLei,
              childLei: relationship.childLei,
              relationshipType: relationship.type,
              relationshipConfidence: relationship.confidence,
              discoveryMethod
            };
            
            await storage.createEntityRelationship?.(newRelationship);
            console.log(`Discovered relationship: ${relationship.parentLei} → ${relationship.childLei} (${relationship.type})`);
          } catch (error) {
            // Relationship might already exist, ignore duplicates
            console.log(`Relationship already exists or failed to store: ${entity1.lei} ↔ ${entity2.lei}`);
          }
        }
      }
    }
  }

  /**
   * Calculate mapping confidence based on domain-entity match quality
   */
  private calculateMappingConfidence(domain: Domain, entity: GLEIFEntity, searchMethod: string): number {
    let confidence = 50; // Base confidence
    
    // Method-based confidence
    if (searchMethod === 'exact') confidence += 30;
    else if (searchMethod === 'fuzzy') confidence += 20;
    else if (searchMethod === 'geographic') confidence += 10;
    
    // Name match quality
    if (domain.companyName) {
      const nameLower = domain.companyName.toLowerCase();
      const entityLower = entity.legalName.toLowerCase();
      
      if (entityLower.includes(nameLower) || nameLower.includes(entityLower)) {
        confidence += 25;
      }
    }
    
    // Entity quality indicators
    if (entity.entityStatus === 'ACTIVE') confidence += 15;
    if (entity.registrationStatus === 'ISSUED') confidence += 10;
    
    return Math.min(confidence, 100);
  }

  /**
   * Generate human-readable mapping reason
   */
  private generateMappingReason(domain: Domain, entity: GLEIFEntity, confidence: number): string {
    const reasons = [];
    
    if (confidence >= 80) reasons.push('High confidence match');
    else if (confidence >= 60) reasons.push('Good match quality');
    else reasons.push('Potential match');
    
    if (entity.entityStatus === 'ACTIVE') reasons.push('Active entity');
    if (entity.headquarters.country) reasons.push('Complete address data');
    
    return reasons.join(', ');
  }

  /**
   * Analyze potential corporate relationships between entities
   */
  private analyzeEntityRelationship(entity1: GLEIFEntity, entity2: GLEIFEntity): {
    parentLei: string;
    childLei: string;
    type: string;
    confidence: number;
  } | null {
    // Same jurisdiction check
    if (entity1.jurisdiction !== entity2.jurisdiction) {
      // Potential parent-subsidiary across jurisdictions
      if (this.isLikelyParentEntity(entity1, entity2)) {
        return {
          parentLei: entity1.lei,
          childLei: entity2.lei,
          type: 'subsidiary',
          confidence: 70
        };
      }
      if (this.isLikelyParentEntity(entity2, entity1)) {
        return {
          parentLei: entity2.lei,
          childLei: entity1.lei,
          type: 'subsidiary',
          confidence: 70
        };
      }
    }
    
    // Similar names but different legal forms
    if (this.haveSimilarNames(entity1, entity2)) {
      return {
        parentLei: entity1.lei,
        childLei: entity2.lei,
        type: 'affiliate',
        confidence: 60
      };
    }
    
    return null;
  }

  /**
   * Determine if entity1 is likely parent of entity2
   */
  private isLikelyParentEntity(entity1: GLEIFEntity, entity2: GLEIFEntity): boolean {
    // Headquarters in different countries but similar names
    return entity1.headquarters.country !== entity2.headquarters.country &&
           this.haveSimilarNames(entity1, entity2);
  }

  /**
   * Check if entities have similar names (potential corporate family)
   */
  private haveSimilarNames(entity1: GLEIFEntity, entity2: GLEIFEntity): boolean {
    const name1 = entity1.legalName.toLowerCase().replace(/[^a-z\s]/g, '');
    const name2 = entity2.legalName.toLowerCase().replace(/[^a-z\s]/g, '');
    
    const words1 = name1.split(' ').filter(w => w.length > 2);
    const words2 = name2.split(' ').filter(w => w.length > 2);
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length >= 1 && commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
  }

  /**
   * Get accumulated intelligence for a domain
   */
  async getDomainIntelligence(domain: string): Promise<{
    entities: GleifEntity[];
    mappings: DomainEntityMapping[];
    relationships: EntityRelationship[];
  }> {
    const mappings = await storage.getDomainEntityMappings?.(domain) || [];
    const entities = [];
    const relationships = [];
    
    for (const mapping of mappings) {
      const entity = await storage.getGleifEntity?.(mapping.leiCode);
      if (entity) {
        entities.push(entity);
        
        // Get relationships for this entity
        const entityRelationships = await storage.getEntityRelationships?.(mapping.leiCode) || [];
        relationships.push(...entityRelationships);
      }
    }
    
    return { entities, mappings, relationships };
  }

  /**
   * Get comprehensive entity intelligence by LEI
   */
  async getEntityIntelligence(leiCode: string): Promise<{
    entity: GleifEntity | null;
    domainMappings: DomainEntityMapping[];
    relationships: EntityRelationship[];
    discoveryHistory: any;
  }> {
    const entity = await storage.getGleifEntity?.(leiCode) || null;
    const domainMappings = await storage.getEntityDomainMappings?.(leiCode) || [];
    const relationships = await storage.getEntityRelationships?.(leiCode) || [];
    
    const discoveryHistory = {
      firstDiscovered: entity?.firstDiscoveredDate,
      lastSeen: entity?.lastSeenDate,
      discoveryFrequency: entity?.discoveryFrequency,
      totalDomainMappings: domainMappings.length
    };
    
    return { entity, domainMappings, relationships, discoveryHistory };
  }
}

export const gleifKnowledgeBase = new GLEIFKnowledgeBase();