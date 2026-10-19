// Starter flow: proves your setup works (BASE_URL, saved sign-in, browser) and gives the guide
// its first page. Replace the text with your own, then add one file per area of your app.
// See ../.github/copilot-instructions.md for the API and ./examples/ for fuller flows.
import { test } from '../lib/doc';

test.describe('Getting started', () => {
  test('Open the app', async ({ page, doc }) => {
    doc.flow({ summary: 'Sign in and find your way around the home page.' });

    await doc.goto('/', {
      title: 'Open the app',
      text: 'Go to the app in your browser. After you sign in, you land on the home page.',
    });
  });
});
