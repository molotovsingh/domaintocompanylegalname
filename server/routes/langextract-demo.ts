
import express from 'express';
import { betaDb } from '../betaDb';
import { axiosCheerioV2Dumps, crawleeDumps, scrapyCrawls } from '../../shared/betaSchema';
import { desc, sql } from 'drizzle-orm';

const router = express.Router();

// Mock LangExtract functionality for demo purposes
// In real implementation, this would interface with the actual Python library
class MockLangExtract {
  static async extract(htmlContent: string, schema: any): Promise<any> {
    // Simulate processing time
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
    const processingTime = Date.now() - startTime;

    // Mock entity extraction based on schema fields
    const entities = [];
    const tokensProcessed = Math.floor(htmlContent.length / 4); // Rough token estimate
    
    // Extract based on schema
    for (const [fieldName, fieldType] of Object.entries(schema)) {
      const mockEntities = this.extractEntitiesForField(htmlContent, fieldName, fieldType as string);
      entities.push(...mockEntities);
    }

    // Mock source mapping
    const sourceMapping = entities.map((entity, index) => ({
      text: entity.text,
      originalPosition: Math.floor(Math.random() * htmlContent.length),
      extractedPosition: index
    }));

    return {
      entities,
      processingTime,
      tokensProcessed,
      sourceMapping,
      metadata: {
        language: 'en',
        documentLength: htmlContent.length,
        chunkCount: Math.ceil(htmlContent.length / 2000)
      }
    };
  }

  private static extractEntitiesForField(content: string, fieldName: string, fieldType: string): any[] {
    const entities = [];
    
    // Mock extraction logic based on field name
    if (fieldName.toLowerCase().includes('company') || fieldName.toLowerCase().includes('name')) {
      const companyPatterns = [
        /([A-Z][a-zA-Z\s&]+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Company|Co\.?))/g,
        /©\s*\d{4}[^A-Za-z]*([A-Z][a-zA-Z\s&]+)/g
      ];
      
      for (const pattern of companyPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          matches.slice(0, 3).forEach(match => {
            const cleanMatch = match.replace(/©\s*\d{4}[^A-Za-z]*/, '').trim();
            if (cleanMatch.length > 2) {
              entities.push({
                text: cleanMatch,
                type: fieldName,
                confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
                sourceLocation: {
                  start: content.indexOf(match),
                  end: content.indexOf(match) + match.length,
                  context: this.getContext(content, content.indexOf(match), 100)
                }
              });
            }
          });
        }
      }
    }
    
    if (fieldName.toLowerCase().includes('email')) {
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailPattern) || [];
      matches.slice(0, 5).forEach(email => {
        entities.push({
          text: email,
          type: fieldName,
          confidence: Math.random() * 0.2 + 0.8,
          sourceLocation: {
            start: content.indexOf(email),
            end: content.indexOf(email) + email.length,
            context: this.getContext(content, content.indexOf(email), 50)
          }
        });
      });
    }
    
    if (fieldName.toLowerCase().includes('phone')) {
      const phonePattern = /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g;
      const matches = content.match(phonePattern) || [];
      matches.slice(0, 3).forEach(phone => {
        entities.push({
          text: phone,
          type: fieldName,
          confidence: Math.random() * 0.2 + 0.75,
          sourceLocation: {
            start: content.indexOf(phone),
            end: content.indexOf(phone) + phone.length,
            context: this.getContext(content, content.indexOf(phone), 50)
          }
        });
      });
    }
    
    if (fieldName.toLowerCase().includes('address')) {
      const addressPattern = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)/gi;
      const matches = content.match(addressPattern) || [];
      matches.slice(0, 2).forEach(address => {
        entities.push({
          text: address,
          type: fieldName,
          confidence: Math.random() * 0.25 + 0.65,
          sourceLocation: {
            start: content.indexOf(address),
            end: content.indexOf(address) + address.length,
            context: this.getContext(content, content.indexOf(address), 80)
          }
        });
      });
    }
    
    return entities;
  }
  
  private static getContext(content: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength / 2);
    const end = Math.min(content.length, position + contextLength / 2);
    return content.slice(start, end);
  }
}

// Get available dumps for testing
router.get('/dumps', async (req, res) => {
  try {
    // Get samples from different dump sources
    const axiosDumps = await betaDb.select({
      id: axiosCheerioV2Dumps.id,
      domain: axiosCheerioV2Dumps.domain,
      html: axiosCheerioV2Dumps.html,
      createdAt: axiosCheerioV2Dumps.createdAt
    })
    .from(axiosCheerioV2Dumps)
    .orderBy(desc(axiosCheerioV2Dumps.createdAt))
    .limit(10);

    const crawleeDumpsData = await betaDb.select({
      id: crawleeDumps.id,
      domain: crawleeDumps.domain,
      html: crawleeDumps.html,
      createdAt: crawleeDumps.createdAt
    })
    .from(crawleeDumps)
    .orderBy(desc(crawleeDumps.createdAt))
    .limit(10);

    const scrapyData = await betaDb.select({
      id: scrapyCrawls.id,
      domain: scrapyCrawls.domain,
      html: scrapyCrawls.html,
      createdAt: scrapyCrawls.createdAt
    })
    .from(scrapyCrawls)
    .orderBy(desc(scrapyCrawls.createdAt))
    .limit(10);

    // Format response
    const allDumps = [
      ...axiosDumps.map(dump => ({
        id: `axios_${dump.id}`,
        domain: dump.domain,
        method: 'Axios+Cheerio',
        size: dump.html?.length || 0,
        preview: dump.html ? dump.html.slice(0, 300) + '...' : 'No content'
      })),
      ...crawleeDumpsData.map(dump => ({
        id: `crawlee_${dump.id}`,
        domain: dump.domain,
        method: 'Crawlee',
        size: dump.html?.length || 0,
        preview: dump.html ? dump.html.slice(0, 300) + '...' : 'No content'
      })),
      ...scrapyData.map(dump => ({
        id: `scrapy_${dump.id}`,
        domain: dump.domain,
        method: 'Scrapy',
        size: dump.html?.length || 0,
        preview: dump.html ? dump.html.slice(0, 300) + '...' : 'No content'
      }))
    ].filter(dump => dump.size > 1000); // Only include substantial dumps

    res.json(allDumps);
  } catch (error) {
    console.error('Error fetching dumps:', error);
    res.status(500).json({ error: 'Failed to fetch dumps' });
  }
});

// Run extraction on selected dump
router.post('/extract', async (req, res) => {
  try {
    const { dumpId, schema, schemaName } = req.body;

    if (!dumpId || !schema) {
      return res.status(400).json({ error: 'Missing dumpId or schema' });
    }

    // Parse dump ID to determine source
    const [source, id] = dumpId.split('_');
    
    let htmlContent = '';
    
    // Fetch HTML content based on source
    switch (source) {
      case 'axios':
        const axisDump = await betaDb.select()
          .from(axiosCheerioV2Dumps)
          .where(sql`${axiosCheerioV2Dumps.id} = ${parseInt(id)}`)
          .limit(1);
        htmlContent = axisDump[0]?.html || '';
        break;
        
      case 'crawlee':
        const crawleeDump = await betaDb.select()
          .from(crawleeDumps)
          .where(sql`${crawleeDumps.id} = ${parseInt(id)}`)
          .limit(1);
        htmlContent = crawleeDump[0]?.html || '';
        break;
        
      case 'scrapy':
        const scrapyDump = await betaDb.select()
          .from(scrapyCrawls)
          .where(sql`${scrapyCrawls.id} = ${parseInt(id)}`)
          .limit(1);
        htmlContent = scrapyDump[0]?.html || '';
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid dump source' });
    }

    if (!htmlContent) {
      return res.status(404).json({ error: 'Dump not found or has no content' });
    }

    // Strip HTML tags for text extraction
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Run mock extraction
    const extraction = await MockLangExtract.extract(textContent, schema);

    res.json({
      success: true,
      extraction,
      metadata: {
        dumpId,
        schemaName,
        originalSize: htmlContent.length,
        textSize: textContent.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error running extraction:', error);
    res.status(500).json({ 
      error: 'Extraction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
