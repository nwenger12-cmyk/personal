/**
 * Copies the pdf.js worker into public/ so the browser can load it.
 *
 * pdf.js does its parsing in a Web Worker and needs that file served from an
 * ordinary URL -- it cannot be bundled into the page. Copying it at build time
 * keeps a ~1MB vendored blob out of the repository while still producing a
 * fully static app with nothing to configure at deploy time.
 *
 * This takes the LEGACY build deliberately. pdf.js's default build calls
 * Map.prototype.getOrInsertComputed, a proposal-stage API that almost no
 * browser ships yet -- it throws "getOrInsertComputed is not a function" on
 * current Chrome. The legacy build is the same parser transpiled for browsers
 * that actually exist, and lib/pdf-extract.ts imports the matching entry
 * point. The two must stay in step: a legacy worker with a modern main
 * thread, or the reverse, fails at run time.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve('pdfjs-dist/package.json')),
  'legacy',
  'build',
  'pdf.worker.min.mjs',
);
const target = join(process.cwd(), 'public', 'pdf.worker.min.mjs');

mkdirSync(join(process.cwd(), 'public'), { recursive: true });
copyFileSync(source, target);
console.log(`pdf.js worker -> ${target}`);
