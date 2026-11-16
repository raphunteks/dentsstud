import { Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApi, createApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await createApp();
if (env.NODE_ENV !== 'production') SwaggerModule.setup('api/docs', app, buildOpenApi(app));
await app.listen(env.PORT, '0.0.0.0');
new Logger('Bootstrap').log(`DENTSWEB API listening on :${env.PORT}`);
