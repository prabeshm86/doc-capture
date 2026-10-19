# Copilot instructions — doc-capture

This repo generates **end-user documentation** (annotated screenshots + walkthrough videos) by
driving a web app with Playwright. Each test in `flows/` is one user guide. Running
`npm run docs` captures every flow and builds `output/docs/` (an HTML guide plus Markdown pages).

Your main job here is writing and fixing flows in `flows/*.spec.ts`. You usually can't see the
app itself, so work from recordings in `recordings/` (made with `npm run record`), from what the
user tells you, and from the error output and `output/captures/<flow>/failure.png` when a run fails.

## How a flow is written

```ts
import { test } from '../lib/doc';           // NOT from '@playwright/test'

test.describe('Reports', () => {             // describe title = section in the guide
  test('Create a new report', async ({ page, doc }) => {   // test title = guide title
    doc.flow({
      summary: 'Build a report from one of your data sources.',
      prerequisites: ['You need the **Editor** role.'],     // optional
    });

    await doc.goto('/reports');              // plain navigation, not a documented step

    await doc.click(page.getByRole('button', { name: 'New report' }), {
      title: 'Start a new report',
      text: 'Click **New report** in the top-right corner.',
    });

    await doc.fill(page.getByLabel('Report name'), 'Q4 pipeline', {
      title: 'Name the report',
      text: 'Enter a name your team will recognize.',
      tip: 'You can rename it later.',
    });
  });
});
```

## The `doc` API (lib/doc.ts)

Every documented step takes `StepOptions`: `{ title, text?, tip?, warning?, highlight?, crop?, mask?, shot?, waitFor?, fullPage? }`.

| Call | Use for | Screenshot |
|---|---|---|
| `doc.goto(url, opts?)` | Navigation. Only becomes a step if `opts` is given. | after load |
| `doc.click(locator, opts)` | Buttons, links, tabs, menu items, custom dropdown options | **before** the click, target outlined |
| `doc.fill(locator, value, opts)` | Text inputs (typed visibly). Add `sensitive: true` to mask the value. | after typing |
| `doc.select(locator, value, opts)` | Native `<select>` only | after |
| `doc.check(locator, opts)` | Checkboxes, radios, switches (`uncheck: true` to clear) | after |
| `doc.hover(locator, opts)` | Tooltips, hover menus | before |
| `doc.press(key, opts)` | Keyboard shortcuts, e.g. `'Enter'`, `'Control+S'` | after |
| `doc.shot(opts)` | "You'll see…" result steps with nothing to do | now |
| `doc.step(opts, async () => {…})` | Anything else (drag and drop, `setInputFiles`, multi-key combos) | after |
| `doc.pause(ms)` | Let the viewer see something in the video | — |

Useful options:
- `highlight: locator` outlines a different element than the target (e.g. the whole form row or card); `highlight: null` for none.
- `crop: locator` zooms the screenshot in on one area (e.g. a dialog or form).
- `waitFor: locator` waits for a result (toast, table, dialog) before the screenshot.
- `mask: [locator]` paints over sensitive values in the screenshot.
- `shot: 'after' | 'before' | 'none'` overrides the timing.

## Rules

**One user action = one `doc.*` call.** Don't hide several user-visible actions in one step, and
don't make setup clicks (closing a cookie banner, dismissing a "what's new" popup) into documented
steps — do those with plain `page.*` calls.

**Locators, in order of preference:** `getByRole(role, { name })` → `getByLabel` →
`getByPlaceholder` → `getByText` → `getByTestId` → CSS as a last resort. Never use generated
class names (`.css-1x2y3z`), XPath, or `nth()` unless there's no alternative. When converting a
recording, keep the recorder's role/label locators — they came from the real app.

**Writing style** (the text is what end users read):
- `title`: short imperative, 2–6 words, sentence case — "Save the report", not "Clicking save".
- `text`: one or two sentences in second person ("Click…", "Enter…", "Choose…"). Put the exact UI
  label in **bold**. Say where things are when it helps ("in the left sidebar", "top-right").
- Use `tip` for optional shortcuts and `warning` for anything destructive or irreversible.
- End a flow with a `doc.shot` showing the result when the outcome isn't obvious.

**Data and safety:**
- Never put passwords, tokens or real customer data in a flow. Sign-in is handled once by
  `npm run login`, which saves the session to `.auth/` (git-ignored) — flows start signed in.
- Use clearly fake sample values ("Q4 pipeline", "Jordan Lee", "jordan@example.com").
- Mask anything personal with `mask` or `sensitive: true`; for things on every page (user menu,
  account number) add a CSS selector to `blurSelectors` in `doc.config.json`.
- Don't document destructive actions against shared data unless the user confirms it's a test environment.

**Waiting:** don't add `page.waitForTimeout`. Locators auto-wait; use `waitFor` for results and
`doc.pause` only for video pacing.

**Files:** one file per area, numbered for order: `flows/02-reports.spec.ts`,
`flows/03-admin.spec.ts`. `flows/examples/` holds reference flows for the bundled demo app; leave them alone.

## Running and debugging

- `npm run docs` — capture all flows and build the guide (`npm run open` to view it).
- `npx playwright test flows/02-reports.spec.ts` — capture one file, then `npm run build`.
- `npx playwright test -g "Create a new report"` — one flow by title.
- `HEADED=1` in `.env` to watch, or `npx playwright test <file> --debug` to step through.
- On failure, read the error, look at `output/captures/<flow-slug>/failure.png`, and fix the
  locator or add a `waitFor`. If the sign-in expired, the failure shows a login page: tell the
  user to run `npm run login`.
- `npm run demo` runs the examples against the bundled demo app — useful for checking the kit itself.

Don't change `lib/` or `scripts/` unless asked; they're shared by every flow.
