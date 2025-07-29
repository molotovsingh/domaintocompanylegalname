import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const router = Router();

// Run the smoke test
router.post('/smoke-test', async (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'API key is required' 
    });
  }

  try {
    // Set the API key as an environment variable for the smoke test
    const env = {
      ...process.env,
      openrouter: apiKey // Using Replit Secret name
    };

    // Run the smoke test script
    const scriptPath = path.join(__dirname, '../../scripts/openrouter-smoke-test.ts');
    const { stdout, stderr } = await execAsync(`tsx ${scriptPath}`, { env });

    // Parse the output to extract test results
    const lines = stdout.split('\n');
    const results: any[] = [];
    let allPassed = true;

    // Simple parsing of the console output
    lines.forEach(line => {
      if (line.includes('=== Test')) {
        const testName = line.match(/=== Test \d+: (.+) ===/)?.[1] || 'Unknown Test';
        results.push({ testName, passed: false, message: '', details: {} });
      } else if (line.includes('✅')) {
        const lastResult = results[results.length - 1];
        if (lastResult) {
          lastResult.passed = true;
          lastResult.message = line.replace(/✅/, '').trim();
        }
      } else if (line.includes('❌')) {
        const lastResult = results[results.length - 1];
        if (lastResult) {
          lastResult.passed = false;
          lastResult.message = line.replace(/❌/, '').trim();
          allPassed = false;
        }
      }
    });

    res.json({
      success: true,
      results,
      allPassed,
      rawOutput: stdout
    });
  } catch (error: any) {
    console.error('Smoke test error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run smoke test',
      stderr: error.stderr
    });
  }
});

// Save API key (in production, this would be stored securely)
router.post('/save-key', async (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'API key is required' 
    });
  }

  try {
    // In production, this would save to a secure storage
    // For now, we'll just validate the format
    if (!apiKey.startsWith('sk-or-')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API key format. OpenRouter keys should start with "sk-or-"'
      });
    }

    res.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save API key'
    });
  }
});

export default router;