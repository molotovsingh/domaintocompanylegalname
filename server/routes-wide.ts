// Wide Database Approach - GLEIF data embedded in domains table
import type { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function addWideExportRoute(app: Express) {
  // Export using wide structure - all GLEIF data in domains table
  app.get("/api/export-wide/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { format = 'csv' } = req.query;
      
      // Simple SELECT - no JOINs needed since GLEIF data is embedded
      const result = await db.execute(sql`
        SELECT 
          domain,
          company_name,
          business_category,
          extraction_method,
          confidence_score,
          gleif_status,
          primary_lei_code,
          guessed_country,
          primary_gleif_name,
          gleif_candidate_count,
          all_lei_codes,
          all_legal_names,
          all_jurisdictions,
          all_entity_statuses,
          geographic_markers,
          legal_jurisdiction,
          recommendation,
          processing_time_ms,
          status,
          error_message,
          failure_category,
          technical_details,
          retry_count,
          created_at,
          processed_at
        FROM domains 
        WHERE batch_id = ${batchId}
        ORDER BY id
      `);

      const domains = result.rows;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="wide_${batchId}.json"`);
        res.json(domains);
      } else {
        const csvContent = generateWideCSV(domains);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="wide_${batchId}.csv"`);
        res.send(csvContent);
      }
    } catch (error: any) {
      console.error('Wide export error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update domain with GLEIF data (wide approach)
  app.post("/api/domains/:id/update-wide", async (req, res) => {
    try {
      const { id } = req.params;
      const { candidates } = req.body;
      
      // Aggregate GLEIF data into single fields
      const gleifData = {
        gleif_candidate_count: candidates.length,
        all_lei_codes: candidates.map((c: any) => c.leiCode).join('; '),
        all_legal_names: candidates.map((c: any) => c.legalName).join('; '),
        all_jurisdictions: candidates.map((c: any) => c.jurisdiction).join('; '),
        all_entity_statuses: candidates.map((c: any) => c.entityStatus).join('; '),
        gleif_candidates_json: JSON.stringify(candidates)
      };

      await db.execute(sql`
        UPDATE domains 
        SET 
          gleif_candidate_count = ${gleifData.gleif_candidate_count},
          all_lei_codes = ${gleifData.all_lei_codes},
          all_legal_names = ${gleifData.all_legal_names},
          all_jurisdictions = ${gleifData.all_jurisdictions},
          all_entity_statuses = ${gleifData.all_entity_statuses},
          gleif_candidates_json = ${gleifData.gleif_candidates_json}
        WHERE id = ${id}
      `);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Wide update error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

function generateWideCSV(domains: any[]): string {
  const headers = [
    'Domain', 'Company Name', 'Business Category', 'Extraction Method', 
    'Confidence Score', 'GLEIF Status', 'Primary LEI Code', 'Country',
    'Primary GLEIF Name', 'Total GLEIF Candidates', 'All LEI Codes',
    'All Legal Names', 'All Jurisdictions', 'All Entity Statuses',
    'Geographic Markers', 'Legal Jurisdiction', 'Recommendation',
    'Processing Time (ms)', 'Status', 'Error Message', 'Failure Category',
    'Technical Details', 'Retry Count', 'Created At', 'Processed At'
  ];
  
  const rows = domains.map((d: any) => [
    d.domain || '',
    d.company_name || '',
    d.business_category || '',
    d.extraction_method || '',
    d.confidence_score || '',
    d.gleif_status || '',
    d.primary_lei_code || '',
    d.guessed_country || '',
    d.primary_gleif_name || '',
    d.gleif_candidate_count || 0,
    d.all_lei_codes || '',
    d.all_legal_names || '',
    d.all_jurisdictions || '',
    d.all_entity_statuses || '',
    d.geographic_markers || '',
    d.legal_jurisdiction || '',
    d.recommendation || '',
    d.processing_time_ms || '',
    d.status || '',
    d.error_message || '',
    d.failure_category || '',
    d.technical_details || '',
    d.retry_count || 0,
    d.created_at ? new Date(d.created_at).toISOString() : '',
    d.processed_at ? new Date(d.processed_at).toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}