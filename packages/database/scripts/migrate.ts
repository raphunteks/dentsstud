import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config();
dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '../src/index.js';

const db = createDatabase(undefined, 1);
await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) });
console.log('[migrate] up to date');
await db.$client.end();
