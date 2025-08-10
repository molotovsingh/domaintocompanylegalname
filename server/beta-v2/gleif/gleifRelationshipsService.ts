import { db } from '../arbitration/database-wrapper';

interface EntityRelationships {
  parents?: Array<{
    lei: string;
    type: string;
    status: string;
    name?: string;
  }>;
  ultimateParent?: {
    lei: string;
    name?: string;
  };
  children?: Array<{
    lei: string;
    type: string;
    status: string;
    name?: string;
  }>;
}

type HierarchyLevel = 'ultimate_parent' | 'parent' | 'subsidiary' | 'standalone';

export class GleifRelationshipsService {
  private readonly baseUrl = 'https://api.gleif.org/api/v1';

  /**
   * Get all relationships for a given LEI
   */
  async getRelationships(leiCode: string): Promise<EntityRelationships | null> {
    if (!leiCode) return null;

    try {
      // Check cache first
      const cached = await this.getCachedRelationships(leiCode);
      if (cached) {
        console.log(`[GLEIF Relationships] Using cached data for ${leiCode}`);
        return cached;
      }

      console.log(`[GLEIF Relationships] Fetching relationships for ${leiCode}`);
      
      // Fetch from GLEIF API
      const url = `${this.baseUrl}/lei-records/${leiCode}/relationship-records`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.api+json'
        }
      });

      if (!response.ok) {
        console.error(`[GLEIF Relationships] API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const relationships = this.parseRelationships(data);
      
      // Cache the results
      await this.cacheRelationships(leiCode, relationships);
      
      return relationships;
    } catch (error) {
      console.error('[GLEIF Relationships] Error fetching relationships:', error);
      return null;
    }
  }

  /**
   * Determine the hierarchy level of an entity
   */
  async getHierarchyLevel(leiCode: string): Promise<HierarchyLevel> {
    const relationships = await this.getRelationships(leiCode);
    
    if (!relationships) {
      return 'standalone';
    }

    // If no parents, it's either ultimate parent or standalone
    if (!relationships.parents || relationships.parents.length === 0) {
      // Check if it has children (making it a parent)
      if (relationships.children && relationships.children.length > 0) {
        return 'ultimate_parent';
      }
      return 'standalone';
    }

    // If it has an ultimate parent relationship, it's a subsidiary
    if (relationships.ultimateParent) {
      return 'subsidiary';
    }

    // If it has parents but no ultimate parent, it's an intermediate parent
    return 'parent';
  }

  /**
   * Parse GLEIF API response into structured relationships
   */
  private parseRelationships(apiResponse: any): EntityRelationships {
    const relationships: EntityRelationships = {
      parents: [],
      children: []
    };

    if (!apiResponse?.data || !Array.isArray(apiResponse.data)) {
      return relationships;
    }

    for (const record of apiResponse.data) {
      const relationship = record.attributes?.relationship;
      const relatedLei = record.attributes?.related_lei;
      const status = relationship?.status;
      const type = relationship?.type;

      if (!relatedLei || !type) continue;

      // Determine if this is a parent or child relationship
      if (type === 'IS_DIRECTLY_CONSOLIDATED_BY' || type === 'IS_FUND_MANAGED_BY') {
        // This entity is consolidated by the related entity (related is parent)
        relationships.parents?.push({
          lei: relatedLei.lei,
          type,
          status: status || 'ACTIVE',
          name: relatedLei.name
        });
      } else if (type === 'IS_ULTIMATELY_CONSOLIDATED_BY') {
        // Ultimate parent relationship
        relationships.ultimateParent = {
          lei: relatedLei.lei,
          name: relatedLei.name
        };
        // Also add to parents list
        relationships.parents?.push({
          lei: relatedLei.lei,
          type,
          status: status || 'ACTIVE',
          name: relatedLei.name
        });
      } else if (type === 'DIRECTLY_CONSOLIDATES' || type === 'IS_FUND_MANAGED_BY') {
        // This entity consolidates the related entity (related is child)
        relationships.children?.push({
          lei: relatedLei.lei,
          type,
          status: status || 'ACTIVE',
          name: relatedLei.name
        });
      }
    }

    return relationships;
  }

  /**
   * Get cached relationships from database
   */
  private async getCachedRelationships(leiCode: string): Promise<EntityRelationships | null> {
    try {
      const result = await db.query(
        `SELECT * FROM gleif_relationships_cache 
         WHERE lei_code = $1 AND expires_at > NOW()`,
        [leiCode]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const cached = result.rows[0];
      return cached.relationship_data as EntityRelationships;
    } catch (error) {
      console.error('[GLEIF Relationships] Cache lookup error:', error);
      return null;
    }
  }

  /**
   * Cache relationships in database
   */
  private async cacheRelationships(leiCode: string, relationships: EntityRelationships): Promise<void> {
    try {
      const parentLei = relationships.parents?.[0]?.lei || null;
      const ultimateParentLei = relationships.ultimateParent?.lei || null;
      const relationshipType = relationships.parents?.[0]?.type || null;
      const relationshipStatus = relationships.parents?.[0]?.status || null;

      await db.query(
        `INSERT INTO gleif_relationships_cache 
         (lei_code, parent_lei, ultimate_parent_lei, relationship_type, 
          relationship_status, relationship_data, cached_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW() + INTERVAL '7 days')
         ON CONFLICT (lei_code) 
         DO UPDATE SET 
           parent_lei = EXCLUDED.parent_lei,
           ultimate_parent_lei = EXCLUDED.ultimate_parent_lei,
           relationship_type = EXCLUDED.relationship_type,
           relationship_status = EXCLUDED.relationship_status,
           relationship_data = EXCLUDED.relationship_data,
           cached_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'`,
        [
          leiCode,
          parentLei,
          ultimateParentLei,
          relationshipType,
          relationshipStatus,
          JSON.stringify(relationships)
        ]
      );

      console.log(`[GLEIF Relationships] Cached relationships for ${leiCode}`);
    } catch (error) {
      console.error('[GLEIF Relationships] Cache storage error:', error);
    }
  }

  /**
   * Find the ultimate parent in a chain of relationships
   */
  async findUltimateParent(leiCode: string, maxDepth: number = 5): Promise<string | null> {
    let currentLei = leiCode;
    let depth = 0;

    while (depth < maxDepth) {
      const relationships = await this.getRelationships(currentLei);
      
      if (!relationships) {
        return currentLei;
      }

      // If we found an ultimate parent, return it
      if (relationships.ultimateParent) {
        return relationships.ultimateParent.lei;
      }

      // If no parents, this is the top
      if (!relationships.parents || relationships.parents.length === 0) {
        return currentLei;
      }

      // Move up to the first parent
      currentLei = relationships.parents[0].lei;
      depth++;
    }

    // If we hit max depth, return what we have
    return currentLei;
  }

  /**
   * Get all entities in the same corporate family
   */
  async getCorporateFamily(leiCode: string): Promise<Set<string>> {
    const family = new Set<string>();
    
    // Find the ultimate parent
    const ultimateParent = await this.findUltimateParent(leiCode);
    if (ultimateParent) {
      family.add(ultimateParent);
      
      // Get all children of the ultimate parent (simplified version)
      const relationships = await this.getRelationships(ultimateParent);
      if (relationships?.children) {
        relationships.children.forEach(child => family.add(child.lei));
      }
    }
    
    family.add(leiCode); // Include the original entity
    
    return family;
  }
}

export const gleifRelationshipsService = new GleifRelationshipsService();