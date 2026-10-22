import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase, db, triggerMasterBackup, getDatabaseProtectionStats } from './server/db.ts';
import { resetNestleDemoData } from './server/nestleSeed.ts';

import authRouter from './server/routes/auth.ts';
import dropPointsRouter from './server/routes/dropPoints.ts';
import usersRouter from './server/routes/users.ts';
import productsRouter from './server/routes/products.ts';
import stocksRouter from './server/routes/stocks.ts';
import salesRouter from './server/routes/sales.ts';
import pointsOfSaleRouter from './server/routes/pointsOfSale.ts';
import toursAndVisitsRouter from './server/routes/toursAndVisits.ts';
import statsAndReportsRouter from './server/routes/statsAndReports.ts';
import notificationsAndLogsRouter from './server/routes/notificationsAndLogs.ts';
import acceptanceTestRouter from './server/routes/acceptanceTest.ts';
import dpSupplyRouter from './server/routes/dpSupply.ts';
import { vrsInvoicesRouter } from './server/routes/vrsInvoices.ts';
import posRequestsRouter from './server/routes/posRequests.ts';
import backupRouter from './server/routes/backup.ts';
import scoringRouter, { seedScoringDefaultData, checkAndAutoCloseSemestersInBamako } from './server/routes/scoringAndGifts.ts';
import { startBackupScheduler, performDailyBackup } from './server/backupManager.ts';
import { requireAuth, type AuthRequest } from './server/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Parse explicit CLI args (--port, -p, --port=X, -p=X)
  let cliPort = NaN;
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--port' || arg === '-p') && process.argv[i + 1]) {
      cliPort = parseInt(process.argv[i + 1], 10);
      break;
    }
    if (arg.startsWith('--port=')) {
      cliPort = parseInt(arg.split('=')[1], 10);
      break;
    }
    if (arg.startsWith('-p=')) {
      cliPort = parseInt(arg.split('=')[1], 10);
      break;
    }
  }

  // Port resolution:
  // In AI Studio / Cloud Run container deployments, Nginx acts as the front proxy on port 8080
  // and reverse-proxies incoming traffic to http://localhost:3000.
  // Therefore, the Node server must listen on port 3000 (even when Cloud Run injects PORT=8080).
  // If an explicit CLI argument (--port, -p) or a custom non-8080 PORT is provided, we honor it.
  let targetPort = 3000;
  if (!isNaN(cliPort) && cliPort > 0) {
    targetPort = cliPort;
  } else if (process.env.APP_PORT) {
    targetPort = parseInt(process.env.APP_PORT, 10) || 3000;
  } else if (process.env.PORT && Number(process.env.PORT) !== 8080) {
    targetPort = Number(process.env.PORT);
  } else {
    targetPort = 3000;
  }
  const PORT = targetPort;

  let cliHost: string | undefined = undefined;
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--host' || arg === '-h') && process.argv[i + 1] && !process.argv[i + 1].startsWith('-')) {
      cliHost = process.argv[i + 1];
      break;
    }
    if (arg.startsWith('--host=')) {
      cliHost = arg.split('=')[1];
      break;
    }
    if (arg.startsWith('-h=')) {
      cliHost = arg.split('=')[1];
      break;
    }
  }
  const HOST = cliHost || process.env.HOST || '0.0.0.0';

  // Initialize SQLite persistent database and schema
  initDatabase();
  seedScoringDefaultData();
  checkAndAutoCloseSemestersInBamako();
  startBackupScheduler();

  // Periodic automatic semester closure check (once per hour, Africa/Bamako time)
  setInterval(() => {
    checkAndAutoCloseSemestersInBamako();
  }, 60 * 60 * 1000);

  // CORS and preflight headers for preview / iframe environments
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Permissions-Policy', 'camera=*, geolocation=*, microphone=*');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Express body parsers (with 50mb limit for BL image / document uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: '6C DISTRIBUTION MANAGEMENT API', time: new Date().toISOString() });
  });

  // Mount API modules
  app.use('/api/auth', authRouter);
  app.use('/api/drop-points', dropPointsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/stocks', stocksRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/points-of-sale', pointsOfSaleRouter);
  app.use('/api', toursAndVisitsRouter);
  app.use('/api/stats', statsAndReportsRouter);
  app.use('/api', notificationsAndLogsRouter);
  app.use('/api/acceptance-tests', acceptanceTestRouter);
  app.use('/api/dp-supply', dpSupplyRouter);
  app.use('/api/vrs-invoices', vrsInvoicesRouter);
  app.use('/api/pos-requests', posRequestsRouter);
  app.use('/api/backup', backupRouter);
  app.use('/api/scoring', scoringRouter);
  app.use('/api', scoringRouter);
  app.use('/', scoringRouter);

  // Data Protection & Zero-Data-Loss Monitoring endpoints
  app.get('/api/system/data-protection', (_req, res) => {
    res.json(getDatabaseProtectionStats());
  });

  app.post('/api/system/trigger-backup', (_req, res) => {
    try {
      performDailyBackup(true);
      triggerMasterBackup(true);
      db.pragma('wal_checkpoint(PASSIVE)');
      res.json({
        success: true,
        message: 'Sauvegarde miroir et snapshot SQLite créés avec succès.',
        stats: getDatabaseProtectionStats()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset demo data endpoint: strictly requires SAN authentication and 2-step confirmation with word 'REINITIALISER'
  // and performs an automated safety backup immediately before resetting
  app.post(['/api/system/reset-demo-data', '/api/admin/reset-demo-data'], requireAuth, (req: AuthRequest, res) => {
    if (req.user?.role !== 'SALES_ADMIN_NATIONAL') {
      return res.status(403).json({ error: "Accès refusé. Seul le Sales Admin National (SAN) peut réinitialiser les données de démo." });
    }
    const { confirmation } = req.body;
    if (confirmation !== 'REINITIALISER') {
      return res.status(400).json({
        error: "Confirmation requise : pour éviter toute perte accidentelle de données, vous devez explicitement saisir le mot 'REINITIALISER'.",
        code: 'CONFIRMATION_REQUIRED'
      });
    }

    try {
      // 1. Sauvegarde automatique obligatoire juste avant
      performDailyBackup(true);
      triggerMasterBackup(true);

      // 2. Réinitialisation contrôlée
      resetNestleDemoData(db);

      // 3. Pose immédiate du marqueur seeded_at dans la table meta
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO meta (key, value, created_at, updated_at) VALUES ('seeded_at', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run(now);

      triggerMasterBackup(true);
      db.pragma('wal_checkpoint(PASSIVE)');
      res.json({
        success: true,
        message: 'Jeu de données de démo Nestlé réinitialisé avec succès après sauvegarde automatique préalable.',
      });
    } catch (err: any) {
      console.error('[SERVER] Erreur lors de la réinitialisation des données de démo:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la réinitialisation des données de démo.' });
    }
  });

  // Continuous background synchronization (WAL flush & JSON/DB snapshot every 5 minutes)
  setInterval(() => {
    try {
      triggerMasterBackup(false);
      db.pragma('wal_checkpoint(PASSIVE)');
    } catch (err) {
      console.warn('[6C DIST] Periodic backup sync notice:', err);
    }
  }, 5 * 60 * 1000);

  // Graceful shutdown handling for container redeployment
  const gracefulShutdown = (signal: string) => {
    console.log(`[6C DIST] Received ${signal}. Flushing WAL and creating final master database snapshot...`);
    try {
      triggerMasterBackup(true);
      db.pragma('wal_checkpoint(TRUNCATE)');
      console.log('[6C DIST] Database cleanly committed and synchronized. Exiting safely.');
    } catch (err) {
      console.error('[6C DIST] Error during shutdown backup:', err);
    }
  };

  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT');
    process.exit(0);
  });

  // Global API error handling middleware (catches payload too large, syntax errors, etc.)
  app.use('/api', (err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('[API Handler Error]:', err);
    const status = err.status || err.statusCode || 500;
    const message = err.type === 'entity.too.large'
      ? 'Fichier ou document trop volumineux (limite 50 Mo).'
      : err.message || 'Une erreur interne est survenue sur le serveur.';
    res.status(status).json({ error: message });
  });

  const httpServer = http.createServer(app);

  // Vite integration (SPA mode)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, 'vite.config.ts'),
      root: __dirname,
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint introuvable.' });
      }
      try {
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use('/api/*', (_req, res) => {
      res.status(404).json({ error: 'Endpoint introuvable.' });
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = httpServer.listen(PORT, HOST, () => {
    console.log(`[6C DIST] Server running on http://${HOST}:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[6C DIST] Port ${PORT} already active.`);
      process.exit(1);
    } else {
      console.error('[6C DIST] Server error:', err);
      process.exit(1);
    }
  });

  process.on('uncaughtException', (err) => {
    console.error('[6C DIST] Process uncaught exception handled safely:', err);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[6C DIST] Process unhandled rejection handled safely at:', promise, 'reason:', reason);
  });
}

startServer().catch((err) => {
  console.error('[6C DIST] Fatal error starting server:', err);
  process.exit(1);
});
