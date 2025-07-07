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
    // Kill any existing beta server
    const { exec } = await import('child_process');
    await new Promise(resolve => {
      exec('pkill -f "betaIndex.ts" || true', () => resolve(null));
    });
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    log('🧪 Starting beta server...');
    
    betaServerProcess = spawn('npx', ['tsx', 'server/betaIndex.ts'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      detached: false
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
    
    // Wait for beta server to be ready
    let attempts = 0;
    while (attempts < 30) {
      try {
        await axios.get('http://0.0.0.0:3001/api/beta/health', { timeout: 1000 });
        log('✅ Beta server is ready');
        break;
      } catch {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (attempts >= 30) {
      log('⚠️ Beta server startup timeout - continuing anyway');
    }
    
  } catch (error) {
    log(`❌ Failed to start beta server: ${error}`);
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
  process.exit(0);
});

process.on('SIGINT', () => {
  log('🛑 Main server interrupted...');
  stopBetaServer();
  process.exit(0);
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
    
    // Start beta server automatically
    await startBetaServer();
  });
})();