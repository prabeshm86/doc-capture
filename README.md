# doc-capture

Generate user documentation for a web app automatically: **annotated screenshots**, a
**walkthrough video** (with a visible cursor, click ripples and step captions) and an
**animated GIF** for every task, published as an HTML user guide plus Markdown pages.

You describe each task once as a Playwright "flow". After that, `npm run docs` regenerates
everything, so when the UI changes you re-run it instead of re-recording.

```
flows/02-reports.spec.ts  ──►  npm run docs  ──►  output/docs/index.html     HTML guide (search, video chapters)
                                                 output/docs/<flow>.md      Markdown per guide
                                                 output/docs/assets/…       PNG screenshots, MP4, GIF
```

---

## 1. Set up (once)

You need **Node.js 18+** and access to the app from this machine.

```bash
npm install
npx playwright install chromium     # skip if you set "browserChannel" below
cp .env.example .env                # Windows: copy .env.example .env
```

Edit `.env` and set `BASE_URL` to your app (a test or staging environment is best).
Edit `doc.config.json` and set `productName`.

**Try it on the demo app first** (no setup needed beyond `npm install`):

```bash
npm run demo
npm run open -- --demo
```

### Sign in once

```bash
npm run login
```

A browser opens at your app. Sign in the way you normally do (SSO, MFA, etc.), wait until you see
the home page, then press **Enter** in the terminal. The session is saved to `.auth/state.json`
(git-ignored) and every capture starts signed in. **No password is stored in this project.**
Run it again whenever the session expires — you'll know because flows fail on a sign-in page.

Then check everything works:

```bash
npm run docs        # captures flows/01-getting-started.spec.ts
npm run open
```

---

## 2. Add a guide (with Copilot)

1. **Record the task once:**

   ```bash
   npm run record -- create-report /reports
   ```

   A browser opens, already signed in. Click through the task as a user would, then close the
   window. The raw steps are saved to `recordings/create-report.ts`.

2. **Ask Copilot to turn it into a documented flow.** In VS Code Copilot Chat (Agent mode), type
   `/doc-flow` and fill in the recording path, title and section. Copilot reads
   `.github/copilot-instructions.md`, writes `flows/NN-<area>.spec.ts`, runs it and fixes it until
   it passes.

   If prompt files aren't enabled in your Copilot, paste this instead:

   > Convert `recordings/create-report.ts` into a documented flow following
   > `.github/copilot-instructions.md`. Title "Create a new report", section "Reports". Run it and
   > fix it until it passes.

3. **Review the wording.** The step text is what your users read: check that titles are short and
   that each step says exactly what to click.

4. `npm run docs` and `npm run open`.

You can also write flows by hand — see `flows/examples/` and the API table in
`.github/copilot-instructions.md`.

### What a flow looks like

```ts
import { test } from '../lib/doc';

test.describe('Reports', () => {
  test('Create a new report', async ({ page, doc }) => {
    doc.flow({ summary: 'Build a report from one of your data sources.' });
    await doc.goto('/reports');

    await doc.click(page.getByRole('button', { name: 'New report' }), {
      title: 'Start a new report',
      text: 'Click **New report** in the top-right corner.',
    });

    await doc.fill(page.getByLabel('Report name'), 'Q4 pipeline', {
      title: 'Name the report',
      text: 'Enter a name your team will recognize.',
    });
  });
});
```

The `describe` title becomes the section, the test title becomes the guide title, and each
`doc.*` call becomes a numbered step with its own screenshot and a chapter in the video.

---

## 3. Keep it up to date

After a release, run `npm run docs`. Flows that break are skipped (the rest still build) and a
`failure.png` is saved next to each one. In Copilot Chat, `/doc-fix` re-runs everything and
repairs broken locators and wording.

| Command | What it does |
|---|---|
| `npm run docs` | Capture every flow, then build the docs |
| `npm run docs -- -g "Create a new report"` | Capture one flow by title, then rebuild |
| `npm run docs -- --build-only` | Rebuild docs from the last capture (e.g. after editing `doc.config.json` colors) |
| `npm run open` | Open the HTML guide |
| `npm run login` | Sign in again and save the session |
| `npm run record -- <name> [path]` | Record a task to `recordings/<name>.ts` |
| `npm run demo` | Run the examples against the bundled demo app |

---

## 4. Share the docs

`output/docs/` is self-contained — copy the whole folder.

- **Internal web server / GitHub Pages / S3 / Azure Static Web Apps:** upload the folder; `index.html` is the guide.
- **Confluence, a wiki, Docusaurus, MkDocs:** use the `.md` files and the `assets/` folder.
- **PDF:** open `index.html` in Chrome or Edge → Print → Save as PDF. Print styles put each guide
  on its own pages without the video.
- **SharePoint/Teams:** these usually download `.html` instead of displaying it. Share the PDF, or
  embed the MP4/GIF from `assets/` in a page.

---

## Configuration (`doc.config.json`)

| Key | Default | Notes |
|---|---|---|
| `productName` | `"My App"` | Shown in the guide header |
| `intro` | | Paragraph on the guide's home page |
| `viewport` | `1280×800` | Browser size for screenshots and video |
| `screenshotScale` | `2` | `2` = sharp on high-DPI screens; `1` = smaller files |
| `browserChannel` | `""` | `"msedge"` or `"chrome"` to use the installed browser instead of downloading Chromium |
| `pace` | `1` | Video speed: `1.5` slower, `0.6` faster |
| `accentColor` | `#E5484D` | Highlight box, click ripple, step numbers |
| `highlightStyle` | `"box"` | `"spotlight"` also dims the rest of the page |
| `cursor` / `captions` | `true` | Fake cursor and step caption in the video (never in screenshots) |
| `blurSelectors` | `[]` | CSS selectors blurred in screenshots **and** video, e.g. `[".user-menu .email"]` |
| `gif` | `{ enabled, width: 960, fps: 12 }` | Animated GIF per guide |
| `typingDelayMs`, `highlightMs`, `stepPauseMs` | `55`, `600`, `900` | Fine-tune pacing |

---

## Troubleshooting on a work laptop

- **`npx playwright install` is blocked** → set `"browserChannel": "msedge"` (Windows) or
  `"chrome"` in `doc.config.json` to use the browser that's already installed.
- **`npm install` fails behind the company proxy** → `npm config set proxy http://proxy:port`
  and `npm config set https-proxy http://proxy:port`, or ask IT for the npm registry mirror.
- **No MP4/GIF, only `.webm`** → the bundled ffmpeg couldn't download. Install ffmpeg (or get the
  exe from IT) and set `FFMPEG_PATH` in `.env`. Docs still build without it; WebM plays in Chrome and Edge.
- **Certificate errors on an internal site** → `IGNORE_HTTPS_ERRORS=1` in `.env`.
- **Flows fail on a sign-in page** → `npm run login`.
- **Want to watch it run** → `HEADED=1` in `.env`, or `npx playwright test <file> --debug`.
- **Sensitive data in screenshots** → use a test account with sample data, add selectors to
  `blurSelectors`, and use `mask`/`sensitive` on individual steps. Check your company's rules
  before publishing screenshots outside the team.

## Project layout

```
flows/                 your guides (one test = one guide); examples/ = demo-app reference flows
lib/doc.ts             the doc fixture: steps, highlights, cursor, screenshots, video, manifest
lib/overlay.js         in-page cursor, click ripple, captions and highlight box
scripts/build-docs.mjs turns captures into HTML + Markdown, converts video to MP4/GIF
scripts/login.mjs      manual sign-in → .auth/state.json
scripts/record.mjs     Playwright recorder → recordings/<name>.ts
demo-app/              small sample app used by `npm run demo`
.github/               Copilot instructions and /doc-flow, /doc-fix prompts
```
