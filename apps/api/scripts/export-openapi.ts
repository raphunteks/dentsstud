import { writeFileSync, mkdirSync } from 'node:fs';
import { buildOpenApi, createApp } from '../src/bootstrap.js';

const app = await createApp({ logger: false });
await app.init();
const doc = buildOpenApi(app);
const out = new URL('../../../../docs/api/openapi.json', import.meta.url);
mkdirSync(new URL('.', out), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2));
console.log(`[openapi] ${Object.keys(doc.paths).length} paths -> docs/api/openapi.json`);
await app.close();
