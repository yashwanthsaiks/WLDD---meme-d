import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './src/server/routes/auth.js';
import campaignRoutes from './src/server/routes/campaigns.js';
import submissionRoutes from './src/server/routes/submissions.js';
import { initDatabase, getDatabaseStatus } from './src/server/db/models.js';
import { initRedis, cache } from './src/server/cache/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize persistence layer
  const dbInitResult = await initDatabase();
  console.log(`[Init] DB Mode: ${dbInitResult.mode} (${dbInitResult.message})`);

  // Initialize Redis Cache
  const redisResult = initRedis();
  console.log(`[Init] Redis Cache: ${redisResult.message}`);

  // Health and system status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      db: getDatabaseStatus(),
      cache: cache.getStats(),
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/submissions', submissionRoutes);

  // Vite integration
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Meme'd Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal] Failed to start server:', err);
  process.exit(1);
});
