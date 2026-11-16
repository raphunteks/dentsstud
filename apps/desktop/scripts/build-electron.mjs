import { build } from 'esbuild';

const bakedApi = process.env.DENTSWEB_API_BASE ?? process.env.DENTWEB_API_BASE ?? 'https://motion.dentsweb.my.id';
const common = { bundle: true, platform: 'node', target: 'node22', sourcemap: true, external: ['electron', '@remotion/renderer', '@remotion/compositor-*'], logLevel: 'info', define: { __DENTWEB_BAKED_API__: JSON.stringify(bakedApi), __DENTSWEB_BAKED_API__: JSON.stringify(bakedApi) } };
await build({ ...common, entryPoints: ['electron/main/index.ts'], outfile: 'dist/electron/main.js', format: 'esm', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" } });
// Sandboxed preload must be CommonJS.
await build({ ...common, entryPoints: ['electron/preload/index.ts'], outfile: 'dist/electron/preload.cjs', format: 'cjs' });

// Ship the prebuilt Remotion bundle next to main.js for local rendering.
import { cpSync, existsSync } from 'node:fs';
const src = new URL('../../../packages/remotion-compositions/bundle', import.meta.url);
if (existsSync(src)) cpSync(src, new URL('../dist/remotion-bundle', import.meta.url), { recursive: true });
else console.warn('[desktop] Remotion bundle missing: run pnpm --filter @dentweb/remotion-compositions build');
