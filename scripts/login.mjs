// npm run login
// Opens a browser at BASE_URL so you can sign in by hand (SSO, MFA, whatever your app uses).
// When you press Enter here, the session is saved to .auth/state.json and reused by every capture.
// No password is ever stored in this project.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { ROOT, loadEnv, readDocConfig } from '../lib/shared.mjs';

loadEnv();
const cfg = readDocConfig();
const url = process.env.BASE_URL;
if (!url) {
  console.error('BASE_URL is not set. Copy .env.example to .env and set it first.');
  process.exit(1);
}

const statePath = path.join(ROOT, '.auth', 'state.json');
fs.mkdirSync(path.dirname(statePath), { recursive: true });

const browser = await chromium.launch({ headless: false, channel: cfg.browserChannel || undefined });
const context = await browser.newContext({
  viewport: cfg.viewport,
  ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1',
  storageState: fs.existsSync(statePath) ? statePath : undefined,
});
const page = await context.newPage();
await page.goto(url);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question('\nSign in in the browser window. When you can see the app’s home page, press Enter here… ');
rl.close();

await context.storageState({ path: statePath });
await browser.close();
console.log(`Saved session to ${path.relative(ROOT, statePath)}. Re-run "npm run login" whenever it expires.`);
