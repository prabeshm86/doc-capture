---
description: Fix doc flows that fail after the app's UI changed
---

Run `npm run docs`. For every flow that fails:

1. Read the error and look at `output/captures/<slug>/failure.png` to see what the page showed.
2. If it shows a sign-in page, stop and tell me to run `npm run login`.
3. Otherwise update the locator, add a `waitFor`, or adjust the steps to match the new UI.
   Update the step `title`/`text` too if the label or position in the UI changed, so the
   instructions stay accurate.
4. Re-run just that flow (`npx playwright test -g "<title>"`) until it passes.

Follow `.github/copilot-instructions.md`. Finish with `npm run build` and a short list of what changed in each flow.
