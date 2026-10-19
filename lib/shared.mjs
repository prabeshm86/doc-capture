// Shared helpers used by playwright.config.ts, the capture fixture and the scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Loads KEY=VALUE pairs from .env into process.env (existing variables win). */
export function loadEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export const DEFAULTS = {
  productName: 'My App',
  intro: '',
  viewport: { width: 1280, height: 800 },
  screenshotScale: 2,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: '',
  browserChannel: '',
  pace: 1,
  typingDelayMs: 55,
  highlightMs: 600,
  stepPauseMs: 900,
  cursor: true,
  captions: true,
  highlightStyle: 'box',
  accentColor: '#E5484D',
  maskColor: '#1f2937',
  blurSelectors: [],
  video: true,
  gif: { enabled: true, width: 960, fps: 12 },
};

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

/** doc.config.json merged over the defaults (demo mode reads demo-app/doc.config.json instead). */
export function readDocConfig() {
  const file = process.env.DOC_DEMO
    ? path.join(ROOT, 'demo-app', 'doc.config.json')
    : path.join(ROOT, 'doc.config.json');
  const user = readJson(file);
  return {
    ...DEFAULTS,
    ...user,
    viewport: { ...DEFAULTS.viewport, ...(user.viewport || {}) },
    gif: { ...DEFAULTS.gif, ...(user.gif || {}) },
  };
}

/** Where captures and generated docs go. */
export function outDir() {
  return path.join(ROOT, process.env.DOC_DEMO ? 'output-demo' : 'output');
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'flow';
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
