// Normalized Database Approach - Fixed Export Implementation
import type { Express } from "express";
import { storage } from "./pgStorage";

export function addNormalizedExportRoute(app: Express) {
  // Export using normalized structure with proper aggregation
  app.get("/api/export-normalized/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { format = 'csv' } = req.query;
      
      // Get domains first
      const domains = await storage.getDomainsByBatch(batchId, 100000);
      
      // Process each domain individually to get GLEIF data
      const enhancedDomains = await Promise.all(
        domains.map(async (domain) => {
          const candidates = await storage.getGleifCandidates(domain.id);
          
          return {
            ...domain,
            gleifCandidateCount: candidates.length,
            allLeiCodes: candidates.map(c => c.leiCode).join('; '),
            allLegalNames: candidates.map(c => c.legalName).join('; '),
            allJurisdictions: candidates.map(c => c.jurisdiction || '').join('; '),
            allEntityStatuses: candidates.map(c => c.entityStatus || '').join('; ')
          };
        })
      );

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="normalized_${batchId}.json"`);
        res.json(enhancedDomains);
      } else {
        // CSV format
        const csvContent = generateCSV(enhancedDomains);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="normalized_${batchId}.csv"`);
        res.send(csvContent);
      }
    } catch (error: any) {
      console.error('Normalized export error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

function generateCSV(domains: any[]): string {
  const headers = [
    'Domain', 'Company Name', 'Business Category', 'Extraction Method', 
    'Confidence Score', 'GLEIF Status', 'Primary LEI Code', 'Country',
    'GLEIF Enhanced Name', 'Total GLEIF Candidates', 'All LEI Codes',
    'All Legal Names', 'All Jurisdictions', 'All Entity Statuses',
    'Status', 'Processing Time (ms)', 'Created At'
  ];
  
  const rows = domains.map(d => [
    d.domain || '',
    d.companyName || '',
    d.businessCategory || '',
    d.extractionMethod || '',
    d.confidenceScore || '',
    d.gleifStatus || '',
    d.primaryLeiCode || '',
    d.guessedCountry || '',
    d.primaryGleifName || '',
    d.gleifCandidateCount || 0,
    d.allLeiCodes || '',
    d.allLegalNames || '',
    d.allJurisdictions || '',
    d.allEntityStatuses || '',
    d.status || '',
    d.processingTimeMs || '',
    d.createdAt ? new Date(d.createdAt).toISOString() : ''
  ]);
  
  return [headers, ...rows].map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}