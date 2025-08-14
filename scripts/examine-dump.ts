#!/usr/bin/env tsx
import { betaDb } from '../server/betaDb';
import { crawleeDumps } from '../shared/betaSchema';
import { sql } from 'drizzle-orm';

async function examineDump() {
  try {
    // Get the indiatoday.in dump (ID 121 from the logs)
    const dump = await betaDb.select()
      .from(crawleeDumps)
      .where(sql`${crawleeDumps.id} = 121`)
      .limit(1);

    if (!dump[0]) {
      console.log('Dump not found');
      return;
    }

    const dumpData = dump[0].dumpData as any;
    const htmlContent = dumpData?.pages?.[0]?.html || '';
    const textContent = dumpData?.pages?.[0]?.text || '';
    
    console.log('\n=== DUMP EXAMINATION FOR INDIATODAY.IN ===\n');
    console.log('Domain:', dump[0].domain);
    console.log('Dump ID:', dump[0].id);
    console.log('Created:', dump[0].createdAt);
    
    // Search for common legal entity suffixes
    const suffixes = [
      'Inc.', 'Inc', 'Incorporated',
      'Ltd.', 'Ltd', 'Limited',
      'LLC', 'L.L.C.',
      'Corp.', 'Corp', 'Corporation',
      'Co.', 'Company',
      'PLC', 'Plc',
      'Pvt.', 'Pvt', 'Private',
      'GmbH', 'S.A.', 'S.p.A.', 'B.V.',
      'AG', 'AB', 'AS', 'A/S'
    ];
    
    console.log('\n=== SEARCHING FOR ENTITIES WITH SUFFIXES ===\n');
    
    // Search in HTML content
    const foundEntities = new Set<string>();
    
    // Look for entities in text content
    for (const suffix of suffixes) {
      const regex = new RegExp(`\\b([A-Za-z0-9\\s&\\.\\-]+\\s+${suffix.replace('.', '\\.')}(?:\\s|,|\\.|;|$))`, 'gi');
      const matches = textContent.match(regex) || [];
      matches.forEach(match => foundEntities.add(match.trim()));
      
      // Also search in HTML
      const htmlMatches = htmlContent.match(regex) || [];
      htmlMatches.forEach(match => foundEntities.add(match.trim()));
    }
    
    if (foundEntities.size > 0) {
      console.log('✅ FOUND ENTITIES WITH LEGAL SUFFIXES:');
      Array.from(foundEntities).forEach(entity => {
        console.log(`  - "${entity}"`);
      });
    } else {
      console.log('❌ NO ENTITIES WITH LEGAL SUFFIXES FOUND');
    }
    
    // Check meta tags and structured data
    console.log('\n=== CHECKING META TAGS ===\n');
    
    // Extract meta tags
    const ogSiteName = htmlContent.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1];
    const metaPublisher = htmlContent.match(/<meta[^>]*name=["']publisher["'][^>]*content=["']([^"']+)["']/i)?.[1];
    const metaAuthor = htmlContent.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["']/i)?.[1];
    
    if (ogSiteName) console.log(`og:site_name: "${ogSiteName}"`);
    if (metaPublisher) console.log(`publisher: "${metaPublisher}"`);
    if (metaAuthor) console.log(`author: "${metaAuthor}"`);
    
    // Check for JSON-LD structured data
    console.log('\n=== CHECKING STRUCTURED DATA (JSON-LD) ===\n');
    
    const jsonLdMatches = htmlContent.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis) || [];
    
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const data = JSON.parse(jsonContent);
        
        if (data.publisher?.name) {
          console.log(`Publisher name in JSON-LD: "${data.publisher.name}"`);
        }
        if (data.organization?.name) {
          console.log(`Organization name in JSON-LD: "${data.organization.name}"`);
        }
        if (data.author?.name) {
          console.log(`Author name in JSON-LD: "${data.author.name}"`);
        }
        if (data.name && typeof data.name === 'string') {
          console.log(`Entity name in JSON-LD: "${data.name}"`);
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
    
    // Check copyright notices
    console.log('\n=== CHECKING COPYRIGHT NOTICES ===\n');
    
    const copyrightRegex = /(?:©|copyright|Copyright)\s+(?:\d{4}\s+)?([A-Za-z0-9\s&\.\-]+(?:Inc\.|Ltd\.|LLC|Corp\.|Limited|Corporation|Company))/gi;
    const copyrightMatches = textContent.match(copyrightRegex) || [];
    
    if (copyrightMatches.length > 0) {
      console.log('Found copyright notices:');
      copyrightMatches.forEach(match => {
        console.log(`  - "${match}"`);
      });
    } else {
      console.log('No copyright notices with legal suffixes found');
    }
    
    // Show a sample of text content for manual inspection
    console.log('\n=== SAMPLE OF TEXT CONTENT (first 1000 chars) ===\n');
    console.log(textContent.substring(0, 1000));
    
    console.log('\n=== ANALYSIS COMPLETE ===\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error examining dump:', error);
    process.exit(1);
  }
}

examineDump();