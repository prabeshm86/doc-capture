---
description: Turn a Playwright recording into a documented user-guide flow
---

Convert the Playwright recording at `${input:recording:recordings/my-task.ts}` into a documented
flow, following `.github/copilot-instructions.md`.

Guide title: ${input:title:e.g. Create a new report}
Section: ${input:section:e.g. Reports}
What the user is trying to do, and anything they should know first: ${input:context:e.g. Editors build a report from a data source; needs the Editor role}

Steps:
1. Read the recording and `flows/examples/01-reports.spec.ts` for the pattern.
2. Create (or add to) the right numbered file in `flows/`, with the section as the `test.describe` title.
3. Turn each meaningful user action into one `doc.*` call with a clear `title` and `text`. Drop
   recorder noise (duplicate clicks, focus clicks before typing, cookie banners, scrolls).
   Keep the recorder's `getByRole`/`getByLabel` locators.
4. Replace any real names, emails or IDs in typed values with obvious sample data, and mask
   anything sensitive.
5. Add a final `doc.shot` that shows the result.
6. Run `npx playwright test <the file> -g "<title>"`. If it fails, read the error and
   `output/captures/<slug>/failure.png`, fix it and run again until it passes.
7. Run `npm run build` and tell me which flow you added and how many steps it has.
