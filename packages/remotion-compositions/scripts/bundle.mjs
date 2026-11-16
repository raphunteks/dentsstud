import { bundle } from '@remotion/bundler';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../bundle', import.meta.url));
await bundle({ entryPoint: fileURLToPath(new URL('../src/index.ts', import.meta.url)), outDir: out, onProgress: () => {} });
console.log(`[remotion] bundle -> ${out}`);
