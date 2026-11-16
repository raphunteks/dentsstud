import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { MetricsRegistry } from './infra/observability.js';

export const API_PREFIX = 'api/v1';

export async function createApp(opts: { logger?: false } = {}): Promise<INestApplication> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: opts.logger, bufferLogs: false });
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  const metrics = app.get(MetricsRegistry);
  app.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    const t0 = process.hrtime.bigint();
    res.on('finish', () => {
      const route = req.route ? `${req.baseUrl}${(req.route as { path: string }).path}` : 'unmatched';
      metrics.observe(req.method, route, res.statusCode, Number(process.hrtime.bigint() - t0) / 1e9);
    });
    next();
  });
  app.useBodyParser('json', { limit: '1mb' });
  const origins = [env.WEB_ORIGIN, ...env.CORS_EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)];
  app.enableCors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  return app;
}

export function buildOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('DENTWEB STUDIO API')
    .setDescription('API v1 — Create Motion. Powered by AI.')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('dw_sid')
    .build();
  return SwaggerModule.createDocument(app, config);
}
