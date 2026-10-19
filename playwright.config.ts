import { defineConfig } from '@playwright/test';
import { loadEnv, readDocConfig, outDir } from './lib/shared.mjs';

loadEnv();
const cfg = readDocConfig();
const demo = !!process.env.DOC_DEMO;
const DEMO_URL = 'http://127.0.0.1:4173';

if (!demo && !process.env.BASE_URL) {
  console.warn('\n⚠  BASE_URL is not set. Copy .env.example to .env and set it to your app’s address.\n');
}

export default defineConfig({
  testDir: demo ? './flows/examples' : './flows',
  testIgnore: demo ? [] : ['**/examples/**'],
  // One flow at a time keeps videos smooth and steps in order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 5 * 60_000,
  reporter: [['list']],
  outputDir: `${outDir()}/test-results`,
  use: {
    baseURL: demo ? DEMO_URL : process.env.BASE_URL,
    channel: cfg.browserChannel || undefined,
    headless: !process.env.HEADED,
    actionTimeout: Number(process.env.ACTION_TIMEOUT || 15_000),
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1',
  },
  webServer: demo
    ? { command: 'node demo-app/server.mjs', url: DEMO_URL, reuseExistingServer: true, timeout: 20_000 }
    : undefined,
});
