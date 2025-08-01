// GLEIF Search Storage - Database operations
import { executeBetaV2Query } from '../database';
import { 
  GLEIFSearchRequest, 
  GLEIFCandidate, 
  GLEIFSearchResult 
} from './gleifSearchTypes';

export class GLEIFSearchStorage {

  /**
   * Create a new search request
   */
  async createSearchRequest(request: GLEIFSearchRequest): Promise<number> {
    const query = `
      INSERT INTO gleif_search_requests 
      (suspected_name, domain, search_method, jurisdiction, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [
      request.suspectedName,
      request.domain || null,
      request.searchMethod || 'exact',
      request.jurisdiction || null,
      'processing'
    ];

    const result = await executeBetaV2Query(query, values);
    return result.rows[0].id;
  }

  /**
   * Update search request status
   */
  async updateSearchRequest(
    id: number, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE gleif_search_requests 
      SET status = $1, error_message = $2, updated_at = NOW()
      WHERE id = $3
    `;

    await executeBetaV2Query(query, [status, errorMessage || null, id]);
  }

  /**
   * Store GLEIF candidates
   */
  async storeCandidates(searchId: number, candidates: GLEIFCandidate[]): Promise<void> {
    if (candidates.length === 0) return;

    // Build bulk insert query
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    candidates.forEach((candidate) => {
      const placeholder = `(
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++},
        $${paramIndex++}, $${paramIndex++}
      )`;
      placeholders.push(placeholder);

      values.push(
        searchId,
        candidate.leiCode,
        candidate.legalName,
        candidate.entityStatus,
        candidate.legalForm,
        candidate.legalFormCode,
        candidate.jurisdiction,
        candidate.entityCategory,
        candidate.entitySubCategory,
        
        // Headquarters
        candidate.headquarters.country,
        candidate.headquarters.city,
        candidate.headquarters.region,
        candidate.headquarters.postalCode,
        candidate.headquarters.addressLine,
        
        // Legal address
        candidate.legalAddress.country,
        candidate.legalAddress.city,
        candidate.legalAddress.region,
        candidate.legalAddress.postalCode,
        candidate.legalAddress.addressLine,
        
        // Registration
        candidate.registrationStatus,
        candidate.initialRegistrationDate,
        candidate.lastUpdateDate,
        candidate.nextRenewalDate,
        candidate.managingLou,
        
        // Scores
        candidate.nameMatchScore,
        candidate.fortune500Score,
        candidate.tldJurisdictionScore,
        candidate.entityComplexityScore,
        candidate.weightedTotalScore,
        candidate.selectionReason,
        
        // Metadata
        JSON.stringify(candidate.otherNames || []),
        candidate.validationSources,
        JSON.stringify(candidate.bicCodes || []),
        JSON.stringify(candidate.gleifRawData || {})
      );
    });

    const query = `
      INSERT INTO gleif_candidates_v2 (
        search_id, lei_code, legal_name, entity_status, legal_form, 
        legal_form_code, jurisdiction, entity_category, entity_sub_category,
        headquarters_country, headquarters_city, headquarters_region, 
        headquarters_postal_code, headquarters_address_line,
        legal_address_country, legal_address_city, legal_address_region,
        legal_address_postal_code, legal_address_line,
        registration_status, initial_registration_date, last_update_date,
        next_renewal_date, managing_lou,
        name_match_score, fortune500_score, tld_jurisdiction_score,
        entity_complexity_score, weighted_total_score, selection_reason,
        other_names, validation_sources, bic_codes, gleif_raw_data
      ) VALUES ${placeholders.join(', ')}
    `;

    await executeBetaV2Query(query, values);
  }

  /**
   * Get search request with candidates
   */
  async getSearchResult(searchId: number): Promise<GLEIFSearchResult | null> {
    // Get search request
    const requestQuery = `
      SELECT * FROM gleif_search_requests WHERE id = $1
    `;
    const requestResult = await executeBetaV2Query(requestQuery, [searchId]);
    
    if (requestResult.rows.length === 0) {
      return null;
    }

    const searchRequest = this.mapRowToSearchRequest(requestResult.rows[0]);

    // Get candidates
    const candidatesQuery = `
      SELECT * FROM gleif_candidates_v2 
      WHERE search_id = $1 
      ORDER BY weighted_total_score DESC
    `;
    const candidatesResult = await executeBetaV2Query(candidatesQuery, [searchId]);
    const candidates = candidatesResult.rows.map(row => this.mapRowToCandidate(row));

    return {
      searchRequest,
      candidates,
      totalMatches: candidates.length
    };
  }

  /**
   * Get all search requests
   */
  async getAllSearchRequests(limit: number = 50): Promise<GLEIFSearchRequest[]> {
    const query = `
      SELECT * FROM gleif_search_requests 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await executeBetaV2Query(query, [limit]);
    return result.rows.map(row => this.mapRowToSearchRequest(row));
  }

  /**
   * Delete old search requests and their candidates
   */
  async cleanupOldSearches(daysToKeep: number = 7): Promise<number> {
    const query = `
      DELETE FROM gleif_search_requests 
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
      RETURNING id
    `;
    const result = await executeBetaV2Query(query);
    return result.rowCount || 0;
  }

  /**
   * Map database row to search request
   */
  private mapRowToSearchRequest(row: Record<string, any>): GLEIFSearchRequest {
    return {
      id: row.id,
      suspectedName: row.suspected_name,
      domain: row.domain,
      searchMethod: row.search_method,
      jurisdiction: row.jurisdiction,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to candidate
   */
  private mapRowToCandidate(row: Record<string, any>): GLEIFCandidate {
    return {
      id: row.id,
      searchId: row.search_id,
      leiCode: row.lei_code,
      legalName: row.legal_name,
      entityStatus: row.entity_status,
      legalForm: row.legal_form,
      legalFormCode: row.legal_form_code,
      jurisdiction: row.jurisdiction,
      entityCategory: row.entity_category,
      entitySubCategory: row.entity_sub_category,
      
      headquarters: {
        country: row.headquarters_country,
        city: row.headquarters_city,
        region: row.headquarters_region,
        postalCode: row.headquarters_postal_code,
        addressLine: row.headquarters_address_line
      },
      
      legalAddress: {
        country: row.legal_address_country,
        city: row.legal_address_city,
        region: row.legal_address_region,
        postalCode: row.legal_address_postal_code,
        addressLine: row.legal_address_line
      },
      
      registrationStatus: row.registration_status,
      initialRegistrationDate: row.initial_registration_date,
      lastUpdateDate: row.last_update_date,
      nextRenewalDate: row.next_renewal_date,
      managingLou: row.managing_lou,
      
      nameMatchScore: row.name_match_score,
      fortune500Score: row.fortune500_score,
      tldJurisdictionScore: row.tld_jurisdiction_score,
      entityComplexityScore: row.entity_complexity_score,
      weightedTotalScore: row.weighted_total_score,
      selectionReason: row.selection_reason,
      
      otherNames: row.other_names || [],
      validationSources: row.validation_sources,
      bicCodes: row.bic_codes || [],
      gleifRawData: row.gleif_raw_data,
      
      createdAt: row.created_at
    };
  }
}