// The `doc` fixture: wraps Playwright actions so each user-visible step gets a title,
// a screenshot with the target highlighted, and a timestamp in the walkthrough video.
// Flows import { test, expect } from this file instead of '@playwright/test'.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readDocConfig, outDir, slugify, hexToRgb } from './shared.mjs';

export { expect };

type DocConfig = ReturnType<typeof readDocConfig>;

/** When the step's screenshot is taken relative to its action. */
export type ShotTiming = 'before' | 'after' | 'none';

export interface StepOptions {
  /** Short imperative heading, e.g. "Open the Reports page". Also shown as the caption in the video. */
  title: string;
  /** Instruction text under the heading. Supports **bold**, `code`, _italic_ and [links](url). */
  text?: string;
  /** Optional tip callout shown under the screenshot. */
  tip?: string;
  /** Optional warning callout shown under the screenshot. */
  warning?: string;
  /** Element to outline in the screenshot. Defaults to the action's target; pass null for none. */
  highlight?: Locator | null;
  /** Crop the screenshot to this element (plus padding) instead of the full viewport. */
  crop?: Locator;
  /** Extra elements to paint over in the screenshot (e.g. emails, account numbers). */
  mask?: Locator[];
  /** Override when the screenshot is taken. Defaults: click/hover → 'before', fill/select/check → 'after'. */
  shot?: ShotTiming;
  /** Wait for this element to be visible before the 'after' screenshot (e.g. a toast or a loaded table). */
  waitFor?: Locator;
  /** Capture the whole scrollable page (no highlight). */
  fullPage?: boolean;
}

export interface FlowMeta {
  title: string;
  summary?: string;
  section?: string;
  order?: number;
  prerequisites?: string[];
}

interface StepRecord {
  n: number;
  title: string;
  text?: string;
  tip?: string;
  warning?: string;
  image?: string;
  t: number;
}

const HIDE_OVERLAYS = '#__doc-cursor, #__doc-caption { visibility: hidden !important; }';

export class Doc {
  readonly steps: StepRecord[] = [];
  readonly meta: FlowMeta;
  private mouse: { x: number; y: number };

  constructor(
    private readonly page: Page,
    readonly dir: string,
    private readonly cfg: DocConfig,
    private readonly t0: number,
    meta: FlowMeta,
  ) {
    this.meta = meta;
    this.mouse = { x: Math.round(cfg.viewport.width / 2), y: Math.round(cfg.viewport.height / 2) };
  }

  /** Set the guide's summary, prerequisites, section or order. Call once at the top of the test. */
  flow(meta: Partial<FlowMeta>) {
    Object.assign(this.meta, meta);
  }

  /** Navigate. Pass step options to make the arrival its own documented step. */
  async goto(url: string, o?: StepOptions) {
    const rec = o ? await this.begin(o) : undefined;
    await this.page.goto(url);
    await this.settle(o?.waitFor);
    if (rec && o) await this.capture(rec, o, null);
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Click a button, link, tab, menu item, etc. */
  async click(target: Locator, o: StepOptions) {
    const shot = o.shot ?? 'before';
    const rec = await this.begin(o);
    await this.pointAt(target);
    if (shot === 'before') await this.capture(rec, o, target);
    await target.click();
    await this.clearHighlight();
    await this.settle(o.waitFor);
    if (shot === 'after') await this.capture(rec, o, null);
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Type into a text field (types visibly, character by character). */
  async fill(target: Locator, value: string, o: StepOptions & { sensitive?: boolean }) {
    const shot = o.shot ?? 'after';
    const rec = await this.begin(o);
    const opts = o.sensitive ? { ...o, mask: [...(o.mask ?? []), target] } : o;
    await this.pointAt(target);
    if (shot === 'before') await this.capture(rec, opts, target);
    await target.click();
    if (o.sensitive) await target.evaluate((el) => ((el as HTMLElement).style.filter = 'blur(6px)'));
    await target.fill('');
    await target.pressSequentially(value, { delay: this.cfg.typingDelayMs * this.cfg.pace });
    await this.wait(300);
    if (shot === 'after') await this.capture(rec, opts, target);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Choose an option in a native <select>. For custom dropdowns, use two doc.click steps instead. */
  async select(target: Locator, value: string | { label: string }, o: StepOptions) {
    const shot = o.shot ?? 'after';
    const rec = await this.begin(o);
    await this.pointAt(target);
    if (shot === 'before') await this.capture(rec, o, target);
    await target.selectOption(value);
    await this.wait(300);
    if (shot === 'after') await this.capture(rec, o, target);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Tick a checkbox or radio button (or flip a switch). */
  async check(target: Locator, o: StepOptions & { uncheck?: boolean }) {
    const shot = o.shot ?? 'after';
    const rec = await this.begin(o);
    await this.pointAt(target);
    if (shot === 'before') await this.capture(rec, o, target);
    if (o.uncheck) await target.uncheck();
    else await target.check();
    await this.wait(300);
    if (shot === 'after') await this.capture(rec, o, target);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Hover to reveal a tooltip or menu. */
  async hover(target: Locator, o: StepOptions) {
    const rec = await this.begin(o);
    await this.pointAt(target);
    await target.hover();
    await this.settle(o.waitFor);
    if ((o.shot ?? 'before') !== 'none') await this.capture(rec, o, target);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Press a key or shortcut, e.g. 'Enter' or 'Control+S'. */
  async press(key: string, o: StepOptions) {
    const rec = await this.begin(o);
    await this.page.keyboard.press(key);
    await this.settle(o.waitFor);
    if ((o.shot ?? 'after') !== 'none') await this.capture(rec, o, null);
    await this.wait(this.cfg.stepPauseMs);
  }

  /** A screenshot-only step: "You'll see…", "Your report appears here", etc. */
  async shot(o: StepOptions) {
    const rec = await this.begin(o);
    if (o.highlight) await this.pointAt(o.highlight, false);
    await this.settle(o.waitFor);
    await this.capture(rec, o, o.highlight ?? null);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Any other action (drag and drop, file upload, keyboard combos). Screenshot is taken afterwards. */
  async step(o: StepOptions, action: () => Promise<unknown>) {
    const rec = await this.begin(o);
    await action();
    await this.settle(o.waitFor);
    if ((o.shot ?? 'after') !== 'none') await this.capture(rec, o, o.highlight ?? null);
    await this.clearHighlight();
    await this.wait(this.cfg.stepPauseMs);
  }

  /** Pause the video for a moment (scaled by the configured pace). */
  async pause(ms = 1000) {
    await this.wait(ms);
  }

  // ---------------------------------------------------------------------------

  private wait(ms: number) {
    return this.page.waitForTimeout(Math.max(0, ms * this.cfg.pace));
  }

  private async call(fn: string, ...args: unknown[]) {
    await this.page
      .evaluate(([name, a]) => (window as any).__doc?.[name as string]?.(...(a as unknown[])), [fn, args] as const)
      .catch(() => {});
  }

  private async begin(o: StepOptions): Promise<StepRecord> {
    const rec: StepRecord = {
      n: this.steps.length + 1,
      title: o.title,
      text: o.text,
      tip: o.tip,
      warning: o.warning,
      t: (Date.now() - this.t0) / 1000,
    };
    this.steps.push(rec);
    await this.call('caption', rec.n, o.title);
    return rec;
  }

  private async settle(waitFor?: Locator) {
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    if (waitFor) {
      await waitFor.waitFor({ state: 'visible' }).catch((err: Error) => {
        const step = this.steps[this.steps.length - 1];
        throw new Error(
          `Step ${step?.n} "${step?.title}": waited for ${waitFor.toString()} but it never appeared. ` +
            `(${String(err.message).split('\n')[0]})`,
        );
      });
    }
    await this.wait(350);
  }

  /** Scroll the element into view, glide the visible cursor to it and outline it. */
  private async pointAt(target: Locator, moveCursor = true) {
    try {
      await target.scrollIntoViewIfNeeded();
    } catch (err) {
      const step = this.steps[this.steps.length - 1];
      const reason = String((err as Error).message).split('\n')[0];
      throw new Error(
        `Step ${step?.n} "${step?.title}": couldn't find ${target.toString()} on the page. ` +
          `Check the locator against output/captures/<flow>/failure.png. (${reason})`,
      );
    }
    const box = await target.boundingBox();
    if (box && moveCursor) await this.glide(box.x + box.width / 2, box.y + box.height / 2);
    await this.highlight(target);
    await this.wait(this.cfg.highlightMs);
  }

  private async glide(x: number, y: number) {
    const { x: sx, y: sy } = this.mouse;
    const steps = this.cfg.cursor ? Math.max(8, Math.min(40, Math.round(Math.hypot(x - sx, y - sy) / 25))) : 1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // ease in-out
      await this.page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      if (steps > 1) await this.page.waitForTimeout(12 * this.cfg.pace);
    }
    this.mouse = { x, y };
  }

  private async highlight(target: Locator | null | undefined) {
    if (!target) return;
    await target.evaluate((el) => (window as any).__doc?.highlight(el)).catch(() => {});
  }

  private async clearHighlight() {
    await this.call('clearHighlight');
  }

  private async capture(rec: StepRecord, o: StepOptions, defaultHighlight: Locator | null) {
    const hl = o.highlight === undefined ? defaultHighlight : o.highlight;
    await this.clearHighlight();
    if (hl && !o.fullPage) await this.highlight(hl); // redraw so it lines up after any layout shift

    let clip: { x: number; y: number; width: number; height: number } | undefined;
    if (o.crop) {
      const b = await o.crop.boundingBox();
      if (b) {
        const pad = 32;
        const { width: vw, height: vh } = this.cfg.viewport;
        const x = Math.max(0, b.x - pad);
        const y = Math.max(0, b.y - pad);
        clip = { x, y, width: Math.min(vw - x, b.width + pad * 2), height: Math.min(vh - y, b.height + pad * 2) };
      }
    }

    const file = `${String(rec.n).padStart(2, '0')}.png`;
    await this.page.screenshot({
      path: path.join(this.dir, file),
      clip,
      fullPage: !!o.fullPage && !clip,
      mask: o.mask,
      maskColor: this.cfg.maskColor,
      animations: 'disabled',
      caret: 'hide',
      style: HIDE_OVERLAYS,
    });
    rec.image = file;
  }
}

const overlaySource = fs.readFileSync(path.join(ROOT, 'lib', 'overlay.js'), 'utf8');

export const test = base.extend<{ doc: Doc }>({
  context: async ({ browser, baseURL }, use, testInfo) => {
    const cfg = readDocConfig();
    const statePath = path.join(ROOT, '.auth', 'state.json');
    const context = await browser.newContext({
      baseURL,
      viewport: cfg.viewport,
      deviceScaleFactor: cfg.screenshotScale,
      colorScheme: cfg.colorScheme,
      locale: cfg.locale || undefined,
      timezoneId: cfg.timezoneId || undefined,
      storageState: !process.env.DOC_DEMO && fs.existsSync(statePath) ? statePath : undefined,
      recordVideo: cfg.video ? { dir: testInfo.outputPath('video'), size: cfg.viewport } : undefined,
    });
    const opts = {
      cursor: cfg.cursor,
      captions: cfg.captions,
      accentColor: cfg.accentColor,
      accentRgb: hexToRgb(cfg.accentColor),
      highlightStyle: cfg.highlightStyle,
      blurSelectors: cfg.blurSelectors,
    };
    await context.addInitScript({ content: `${overlaySource}\n;__docInit(${JSON.stringify(opts)});` });
    await use(context);
    await context.close();
  },

  doc: async ({ page }, use, testInfo) => {
    const cfg = readDocConfig();
    const slug = slugify(testInfo.title);
    const dir = path.join(outDir(), 'captures', slug);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    const t0 = Date.now();
    let trimStart = 0;
    page.once('load', () => (trimStart = (Date.now() - t0) / 1000));

    const titlePath = testInfo.titlePath;
    const section = titlePath.length > 2 ? titlePath[titlePath.length - 2] : 'General';
    const doc = new Doc(page, dir, cfg, t0, { title: testInfo.title, section });

    await use(doc);

    const passed = testInfo.status === testInfo.expectedStatus;
    if (!passed) await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    await doc.pause(800);
    const video = page.video();
    await page.close();
    if (video) await video.saveAs(path.join(dir, 'video.webm')).catch(() => {});

    const manifest = {
      slug,
      ...doc.meta,
      file: path.basename(testInfo.file),
      line: testInfo.line,
      status: passed ? 'passed' : 'failed',
      error: passed ? undefined : (testInfo.error?.message ?? '').split('\n')[0],
      steps: doc.steps,
      video: video && fs.existsSync(path.join(dir, 'video.webm')) ? 'video.webm' : undefined,
      trimStart,
      viewport: cfg.viewport,
      capturedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  },
});
