
import express from 'express';
import { betaDb } from '../betaDb';
import { axiosCheerioV2Dumps, crawleeDumps, scrapyCrawls } from '../../shared/betaSchema';
import { desc, sql } from 'drizzle-orm';

const router = express.Router();

import { spawn } from 'child_process';
import path from 'path';

// Real LangExtract integration using Python subprocess
class RealLangExtract {
  static async extract(htmlContent: string, schema: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../services/langextractService.py');
      const schemaJson = JSON.stringify(schema);
      
      // Escape HTML content for shell argument
      const escapedContent = htmlContent.replace(/"/g, '\\"');
      
      const pythonProcess = spawn('python3', [
        pythonScript,
        escapedContent,
        schemaJson
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`LangExtract process failed: ${errorOutput}`));
          return;
        }

        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse LangExtract output: ${output}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start LangExtract process: ${error.message}`));
      });
    });
  }
}

// Get available dumps for testing
router.get('/dumps', async (req, res) => {
  try {
    // Get samples from different dump sources
    const axiosDumps = await betaDb.select({
      id: axiosCheerioV2Dumps.id,
      domain: axiosCheerioV2Dumps.domain,
      html: axiosCheerioV2Dumps.rawHtml,
      createdAt: axiosCheerioV2Dumps.createdAt
    })
    .from(axiosCheerioV2Dumps)
    .orderBy(desc(axiosCheerioV2Dumps.createdAt))
    .limit(10);

    const crawleeDumpsData = await betaDb.select({
      id: crawleeDumps.id,
      domain: crawleeDumps.domain,
      html: crawleeDumps.dumpData,
      createdAt: crawleeDumps.createdAt
    })
    .from(crawleeDumps)
    .orderBy(desc(crawleeDumps.createdAt))
    .limit(10);

    const scrapyData = await betaDb.select({
      id: scrapyCrawls.id,
      domain: scrapyCrawls.domain,
      html: scrapyCrawls.rawData,
      createdAt: scrapyCrawls.createdAt
    })
    .from(scrapyCrawls)
    .orderBy(desc(scrapyCrawls.createdAt))
    .limit(10);

    // Format response
    const allDumps = [
      ...axiosDumps.map(dump => {
        const htmlContent = dump.html || '';
        return {
          id: `axios_${dump.id}`,
          domain: dump.domain,
          method: 'Axios+Cheerio',
          size: typeof htmlContent === 'string' ? htmlContent.length : 0,
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content'
        };
      }),
      ...crawleeDumpsData.map(dump => {
        const dumpData = dump.html as any;
        const htmlContent = dumpData?.pages?.[0]?.html || JSON.stringify(dumpData || {});
        return {
          id: `crawlee_${dump.id}`,
          domain: dump.domain,
          method: 'Crawlee',
          size: typeof htmlContent === 'string' ? htmlContent.length : 0,
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content'
        };
      }),
      ...scrapyData.map(dump => {
        const rawData = dump.html as any;
        const htmlContent = rawData?.html || JSON.stringify(rawData || {});
        return {
          id: `scrapy_${dump.id}`,
          domain: dump.domain,
          method: 'Scrapy',
          size: typeof htmlContent === 'string' ? htmlContent.length : 0,
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content'
        };
      })
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
        htmlContent = axisDump[0]?.rawHtml || '';
        break;
        
      case 'crawlee':
        const crawleeDump = await betaDb.select()
          .from(crawleeDumps)
          .where(sql`${crawleeDumps.id} = ${parseInt(id)}`)
          .limit(1);
        // For crawlee dumps, we need to extract HTML from the JSONB dumpData
        const dumpData = crawleeDump[0]?.dumpData as any;
        htmlContent = dumpData?.pages?.[0]?.html || JSON.stringify(dumpData || {});
        break;
        
      case 'scrapy':
        const scrapyDump = await betaDb.select()
          .from(scrapyCrawls)
          .where(sql`${scrapyCrawls.id} = ${parseInt(id)}`)
          .limit(1);
        // For scrapy crawls, we need to extract HTML from the JSONB rawData
        const rawData = scrapyDump[0]?.rawData as any;
        htmlContent = rawData?.html || JSON.stringify(rawData || {});
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid dump source' });
    }

    if (!htmlContent) {
      return res.status(404).json({ error: 'Dump not found or has no content' });
    }

    // Strip HTML tags for text extraction
    const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Run real LangExtract extraction
    const extraction = await RealLangExtract.extract(textContent, schema);

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
