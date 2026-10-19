// npm run docs [-- <playwright args>]   capture every flow, then build the docs
// npm run demo                          same, against the bundled demo app
// npm run docs -- --build-only           rebuild docs from the last capture
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, outDir } from '../lib/shared.mjs';
import { build } from './build-docs.mjs';

loadEnv();
const args = process.argv.slice(2);
if (args.includes('--demo')) process.env.DOC_DEMO = '1';
const buildOnly = args.includes('--build-only');
const passThrough = args.filter((a) => !['--demo', '--build-only'].includes(a));

let code = 0;
if (!buildOnly) {
  // A full run starts clean so removed flows don't linger; a filtered run (-g, a file) keeps the rest.
  if (!passThrough.length) fs.rmSync(path.join(outDir(), 'captures'), { recursive: true, force: true });
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const res = spawnSync(process.execPath, [cli, 'test', ...passThrough], { stdio: 'inherit', cwd: ROOT, env: process.env });
  code = res.status ?? 1;
  if (code !== 0) console.log('\nSome flows failed. Building docs from the ones that passed…');
}

await build();
process.exit(code);
