import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { Container } from './container';
import { errorHandler, notFoundHandler } from './shared/http/error-handler';

export function createApp(container: Container): Express {
  const { config, db } = container;
  const logger = pino({
    level: config.nodeEnv === 'test' ? 'silent' : config.logLevel,
    // Nunca se registran credenciales ni tokens.
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  });

  const app = express();
  app.disable('x-powered-by');
  // Detrás del proxy inverso (nginx): la IP real llega en X-Forwarded-For.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await db.ping();
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', detalle: 'Base de datos no disponible' });
    }
  });

  for (const router of container.routers) app.use('/api', router);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
