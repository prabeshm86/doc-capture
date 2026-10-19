// npm run open — opens the generated HTML guide in your default browser.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/shared.mjs';

const demo = process.argv.includes('--demo');
const file = path.join(ROOT, demo ? 'output-demo' : 'output', 'docs', 'index.html');
if (!fs.existsSync(file)) {
  console.error(`No guide yet at ${path.relative(ROOT, file)}. Run "npm run ${demo ? 'demo' : 'docs'}" first.`);
  process.exit(1);
}
const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
const args = process.platform === 'win32' ? ['/c', 'start', '""', file] : [file];
spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
console.log(`Opened ${path.relative(ROOT, file)}`);
