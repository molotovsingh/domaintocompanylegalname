import express from 'express';
import { betaDb } from '../betaDb';
import { axiosCheerioV2Dumps, crawleeDumps, scrapyCrawls } from '../../shared/betaSchema';
import { desc, sql } from 'drizzle-orm';

const router = express.Router();

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Real LangExtract integration using Python subprocess
class RealLangExtract {
  static async extract(htmlContent: string, schema: any, domain?: string, modelName?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../services/langextractService.py');

      // Pass data through stdin to avoid E2BIG error with large content
      const inputData = JSON.stringify({
        content: htmlContent,
        schema: schema,
        domain: domain || '',
        model_name: modelName || 'gemini-2.5-flash'
      });

      const pythonProcess = spawn('python3', [
        pythonScript
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      // Write input data to stdin
      pythonProcess.stdin.write(inputData);
      pythonProcess.stdin.end();

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

// Test API key status
router.get('/test-api', async (req, res) => {
  try {
    const modelName = req.query.model as string || 'gemini-2.5-flash';
    const result = await RealLangExtract.extract("Test content", { "test": "string" }, undefined, modelName);
    if (result.error && result.error.includes("API key")) {
      res.json({ 
        status: 'error', 
        message: 'Gemini API key not configured or invalid',
        details: result.error
      });
    } else {
      res.json({ 
        status: 'success', 
        message: 'API key is working',
        hasModel: !result.error,
        modelUsed: modelName
      });
    }
  } catch (error) {
    res.json({ 
      status: 'error', 
      message: 'API test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
    .limit(20);

    const crawleeDumpsData = await betaDb.select({
      id: crawleeDumps.id,
      domain: crawleeDumps.domain,
      html: crawleeDumps.dumpData,
      createdAt: crawleeDumps.createdAt
    })
    .from(crawleeDumps)
    .orderBy(desc(crawleeDumps.createdAt))
    .limit(20);

    const scrapyData = await betaDb.select({
      id: scrapyCrawls.id,
      domain: scrapyCrawls.domain,
      html: scrapyCrawls.rawData,
      createdAt: scrapyCrawls.createdAt
    })
    .from(scrapyCrawls)
    .orderBy(desc(scrapyCrawls.createdAt))
    .limit(20);

    // Format response
    const allDumps = [
      ...axiosDumps.map(dump => {
        const htmlContent = dump.html || '';
        return {
          id: `axios_${dump.id}`,
          domain: dump.domain,
          method: 'Axios+Cheerio',
          size: typeof htmlContent === 'string' ? htmlContent.length : 0,
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content',
          createdAt: dump.createdAt
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
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content',
          createdAt: dump.createdAt
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
          preview: typeof htmlContent === 'string' && htmlContent ? htmlContent.slice(0, 300) + '...' : 'No content',
          createdAt: dump.createdAt
        };
      })
    ]
      .filter(dump => dump.size > 1000) // Only include substantial dumps
      .sort((a, b) => {
        // Sort by most recent first
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 30); // Limit total to 30 most recent dumps

    res.json(allDumps);
  } catch (error) {
    console.error('Error fetching dumps:', error);
    res.status(500).json({ error: 'Failed to fetch dumps' });
  }
});

// Extract entities from the dump
router.post('/extract', async (req, res) => {
  const extractionId = `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { dumpId, schema, model } = req.body;

    console.log(`[LangExtract] [${extractionId}] Starting extraction request:`, {
      dumpId,
      schemaKeys: Object.keys(schema || {}),
      model: model || 'gemini-2.5-flash',
      timestamp: new Date().toISOString()
    });

    if (!dumpId || !schema) {
      console.log(`[LangExtract] [${extractionId}] ERROR: Missing required parameters`, { dumpId: !!dumpId, schema: !!schema });
      return res.status(400).json({ 
        success: false, 
        error: 'Missing dumpId or schema' 
      });
    }

    // Get the dump content
    console.log(`[LangExtract] [${extractionId}] Retrieving dump content for: ${dumpId}`);
    const dump = await getDumpContent(dumpId);
    if (!dump) {
      console.log(`[LangExtract] [${extractionId}] ERROR: Dump not found: ${dumpId}`);
      return res.status(404).json({ 
        success: false, 
        error: 'Dump not found' 
      });
    }

    console.log(`[LangExtract] [${extractionId}] Dump retrieved:`, {
      domain: dump.domain,
      contentLength: dump.html?.length || 0,
      hasContent: !!dump.html
    });

    // Call LangExtract service
    const modelName = model || 'gemini-2.5-flash';
    const serviceCallStart = Date.now();

    console.log(`[LangExtract] [${extractionId}] Calling LangExtract service:`, {
      model: modelName,
      domain: dump.domain,
      htmlLength: dump.html.length,
      schemaFields: Object.keys(schema)
    });

    const result = await RealLangExtract.extract(dump.html, schema, dump.domain, modelName);
    const serviceCallDuration = Date.now() - serviceCallStart;

    console.log(`[LangExtract] [${extractionId}] Service call completed in ${serviceCallDuration}ms:`, {
      success: !result.error,
      error: result.error || null,
      entitiesFound: result.entities?.length || 0,
      processingTime: result.processingTime || 0,
      tokensProcessed: result.tokensProcessed || 0
    });

    if (result.error) {
      console.log(`[LangExtract] [${extractionId}] ERROR in service response:`, result.error);
    }

    res.json({
      success: true,
      extraction: result
    });

  } catch (error) {
    console.error(`[LangExtract] [${extractionId}] ROUTE ERROR:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Helper function to get dump content
async function getDumpContent(dumpId: string): Promise<{ html: string | null; domain: string | null } | null> {
  const [source, id] = dumpId.split('_');
  let htmlContent: string | null = null;
  let domain: string | null = null;

  try {
    switch (source) {
      case 'axios':
        const axiosDump = await betaDb.select()
          .from(axiosCheerioV2Dumps)
          .where(sql`${axiosCheerioV2Dumps.id} = ${parseInt(id)}`)
          .limit(1);
        if (axiosDump.length > 0) {
          htmlContent = axiosDump[0]?.rawHtml || null;
          domain = axiosDump[0]?.domain || null;
        }
        break;

      case 'crawlee':
        const crawleeDump = await betaDb.select()
          .from(crawleeDumps)
          .where(sql`${crawleeDumps.id} = ${parseInt(id)}`)
          .limit(1);
        if (crawleeDump.length > 0) {
          const dumpData = crawleeDump[0]?.dumpData as any;
          htmlContent = dumpData?.pages?.[0]?.html || JSON.stringify(dumpData || {});
          domain = crawleeDump[0]?.domain || null;
        }
        break;

      case 'scrapy':
        const scrapyDump = await betaDb.select()
          .from(scrapyCrawls)
          .where(sql`${scrapyCrawls.id} = ${parseInt(id)}`)
          .limit(1);
        if (scrapyDump.length > 0) {
          const rawData = scrapyDump[0]?.rawData as any;
          htmlContent = rawData?.html || JSON.stringify(rawData || {});
          domain = scrapyDump[0]?.domain || null;
        }
        break;

      default:
        console.error(`[LangExtract] Invalid dump source: ${source}`);
        return null;
    }

    if (htmlContent) {
      // Basic cleanup: remove HTML tags and normalize whitespace for text extraction
      const textContent = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return { html: textContent, domain };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`[LangExtract] Error fetching dump ${dumpId}:`, error);
    return null;
  }
}

export default router;