import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { gleifUpdateService } from "./services/gleifUpdateService";
import { addWideExportRoute } from './routes-wide';
import { addNormalizedExportRoute } from './routes-normalized';
import smokeTestRoutes from './routes-smoke-test';
import knowledgeGraphRoutes from './routes-knowledge-graph';
import changesRoutes from './routes-changes';
import openRouterRoutes from './routes/openrouter';
import langExtractDemoRoutes from './routes/langextract-demo';
import { spawn } from 'child_process';
import axios from 'axios';

// Simple process cleanup function for port conflicts
async function killConflictingProcesses() {
  const { exec } = await import('child_process');
  return new Promise<void>((resolve) => {
    exec('fuser -k 5000/tcp 2>/dev/null || true', () => {
      exec('fuser -k 3001/tcp 2>/dev/null || true', () => {
        setTimeout(() => {
          log('🔧 Cleared port conflicts');
          resolve();
        }, 1000);
      });
    });
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Beta server management
let betaServerProcess: any = null;

async function startBetaServer() {
  try {
    // Kill any existing beta server processes
    const { exec } = await import('child_process');
    await new Promise(resolve => {
      exec('pkill -f "betaIndex.ts" || true', () => resolve(null));
    });

    // Shorter cleanup wait
    await new Promise(resolve => setTimeout(resolve, 1000));

    log('🧪 Starting beta server...');

    // Add --no-cache flag to tsx to prevent module caching
    betaServerProcess = spawn('npx', ['tsx', '--no-cache', 'server/betaIndex.ts'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      detached: false,
      env: {
        ...process.env,
        TSX_DISABLE_CACHE: 'true'  // Also try environment variable
      }
    });

    betaServerProcess.stdout.on('data', (data: Buffer) => {
      log(`[Beta] ${data.toString().trim()}`);
    });

    betaServerProcess.stderr.on('data', (data: Buffer) => {
      log(`[Beta Error] ${data.toString().trim()}`);
    });

    betaServerProcess.on('exit', (code: number) => {
      log(`[Beta] Process exited with code ${code}`);
      betaServerProcess = null;
    });

    // Reduced wait time and attempts for beta server
    let attempts = 0;
    while (attempts < 10) {
      try {
        await axios.get('http://0.0.0.0:3001/api/beta/health', { timeout: 500 });
        log('✅ Beta server is ready');
        break;
      } catch {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (attempts >= 10) {
      log('⚠️ Beta server startup timeout - main server will continue');
    }

  } catch (error) {
    log(`❌ Failed to start beta server: ${error} - main server will continue`);
  }
}

function stopBetaServer() {
  if (betaServerProcess) {
    log('🛑 Stopping beta server...');
    betaServerProcess.kill('SIGTERM');
    betaServerProcess = null;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('🛑 Main server shutting down...');
  stopBetaServer();
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGINT', () => {
  log('🛑 Main server interrupted...');
  stopBetaServer();
  setTimeout(() => process.exit(0), 1000);
});

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (error) => {
  log(`❌ Uncaught Exception: ${error.message}`);
  console.error(error);
  // Don't exit immediately, let the process continue
});

process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
  console.error(reason);
  // Don't exit immediately, let the process continue
});

(async () => {
  const server = await registerRoutes(app);

  // Set up additional routes BEFORE vite middleware
  addWideExportRoute(app);
  addNormalizedExportRoute(app);
  app.use(knowledgeGraphRoutes);
  app.use('/api/smoke-test', smokeTestRoutes);
  app.use('/api/changes', changesRoutes);
  app.use('/api/openrouter', openRouterRoutes);
  app.use('/api/langextract-demo', langExtractDemoRoutes);

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

  // Improved server startup with proper retry logic
  async function startServerWithRetry() {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Clean up any existing processes first
        await killConflictingProcesses();

        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to start the server
        await new Promise<void>((resolve, reject) => {
          const serverInstance = server.listen({
            port,
            host: "0.0.0.0",
            reusePort: true,
          }, async () => {
            log(`serving on port ${port}`);

            // Start beta server in background (non-blocking)
            startBetaServer().catch(error => {
              log(`Beta server startup failed: ${error} - main server continues`);
            });

            resolve();
          });

          serverInstance.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`Port ${port} is already in use`));
            } else {
              reject(error);
            }
          });
        });

        // If we get here, server started successfully
        return;

      } catch (error) {
        log(`❌ Server startup attempt ${attempt}/${maxRetries} failed: ${error}`);

        if (attempt === maxRetries) {
          log(`❌ Failed to start server after ${maxRetries} attempts. Exiting.`);
          process.exit(1);
        } else {
          log(`🔄 Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  // Start the server
  await startServerWithRetry();
})();