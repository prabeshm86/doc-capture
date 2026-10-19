// npm run record -- <name> [start-path]
// Opens Playwright's recorder, signed in with your saved session. Click through the task once;
// the recorder writes the raw steps to recordings/<name>.ts. Then ask Copilot to turn that
// recording into a documented flow (see .github/prompts/doc-flow.prompt.md).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, readDocConfig, slugify } from '../lib/shared.mjs';

loadEnv();
const cfg = readDocConfig();
const [name = 'recording', startPath = ''] = process.argv.slice(2);
const base = process.env.BASE_URL;
if (!base) {
  console.error('BASE_URL is not set. Copy .env.example to .env and set it first.');
  process.exit(1);
}

const out = path.join(ROOT, 'recordings', `${slugify(name)}.ts`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const statePath = path.join(ROOT, '.auth', 'state.json');

const args = [
  'codegen',
  `--viewport-size=${cfg.viewport.width},${cfg.viewport.height}`,
  '--target=playwright-test',
  `--output=${out}`,
];
if (fs.existsSync(statePath)) args.push(`--load-storage=${statePath}`);
if (cfg.browserChannel) args.push(`--channel=${cfg.browserChannel}`);
if (process.env.IGNORE_HTTPS_ERRORS === '1') args.push('--ignore-https-errors');
args.push(new URL(startPath, base).toString());

console.log(`Recording to ${path.relative(ROOT, out)} — close the browser window when you're done.`);
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', cwd: ROOT });
console.log(`\nSaved ${path.relative(ROOT, out)}. In Copilot Chat, run /doc-flow and point it at this file.`);
