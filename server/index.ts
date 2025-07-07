import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { gleifUpdateService } from "./services/gleifUpdateService";
import { addWideExportRoute } from './routes-wide';
import { addNormalizedExportRoute } from './routes-normalized';
import smokeTestRoutes from './routes-smoke-test';
import knowledgeGraphRoutes from './routes-knowledge-graph';
import changesRoutes from './routes-changes';
import { spawn } from 'child_process';
import axios from 'axios';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Beta server management
let betaServerProcess: any = null;
let betaServerReady = false;

async function startBetaServer() {
  return new Promise<void>((resolve, reject) => {
    log('🧪 Starting beta server automatically...');
    
    // Kill any existing beta server processes first
    const killCommand = spawn('pkill', ['-f', 'betaIndex.ts'], { stdio: 'pipe' });
    
    killCommand.on('close', () => {
      // Wait a moment for cleanup
      setTimeout(() => {
        betaServerProcess = spawn('npx', ['tsx', 'server/betaIndex.ts'], {
          stdio: 'pipe',
          cwd: process.cwd()
        });

        betaServerProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString().trim();
          log(`[Beta] ${output}`, 'beta');
          
          // Check for ready signal
          if (output.includes('Beta server fully initialized and ready')) {
            betaServerReady = true;
            log('✅ Beta server startup completed');
            resolve();
          }
        });

        betaServerProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString().trim();
          log(`[Beta Error] ${error}`, 'beta');
        });

        betaServerProcess.on('error', (error: Error) => {
          log(`❌ Beta server failed to start: ${error.message}`);
          reject(error);
        });

        betaServerProcess.on('exit', (code: number | null) => {
          if (code !== 0) {
            log(`❌ Beta server exited with code ${code}`);
            betaServerReady = false;
          }
        });

        // Timeout fallback
        setTimeout(() => {
          if (!betaServerReady) {
            log('⚠️ Beta server startup timeout, continuing anyway...');
            resolve();
          }
        }, 15000);
      }, 2000);
    });
  });
}

async function checkBetaServerHealth() {
  try {
    const response = await axios.get('http://localhost:3001/api/beta/health', { timeout: 3000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Set up additional routes BEFORE vite middleware
  addWideExportRoute(app);
  addNormalizedExportRoute(app);
  app.use(knowledgeGraphRoutes);
  app.use('/api/smoke-test', smokeTestRoutes);
  app.use(changesRoutes);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Auto-start beta server after main server is ready
    try {
      await startBetaServer();
      log('🎯 Complete server stack ready: Main (5000) + Beta (3001)');
    } catch (error) {
      log(`⚠️ Beta server failed to start, continuing with main server only: ${error}`);
    }
  });
})();

// Cleanup beta server on main server shutdown
process.on('SIGTERM', () => {
  log('🛑 Shutting down main server...');
  if (betaServerProcess) {
    log('🛑 Stopping beta server...');
    betaServerProcess.kill('SIGTERM');
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  log('🛑 Main server interrupted...');
  if (betaServerProcess) {
    log('🛑 Stopping beta server...');
    betaServerProcess.kill('SIGTERM');
  }
  process.exit(0);
});