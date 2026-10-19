import { test } from '../../lib/doc';

test.describe('Account settings', () => {
  test('Change notification preferences', async ({ page, doc }) => {
    doc.flow({ summary: 'Choose which emails you get and set your time zone.' });

    await doc.goto('/#/dashboard');

    await doc.click(page.getByRole('link', { name: 'Settings' }), {
      title: 'Open Settings',
      text: 'In the left sidebar, click **Settings**.',
    });

    await doc.check(page.getByRole('checkbox', { name: /Weekly summary/ }), {
      title: 'Turn on the weekly summary',
      text: 'Tick **Weekly summary** to get top insights every Monday.',
      highlight: page.locator('label.toggle', { hasText: 'Weekly summary' }),
      crop: page.locator('form#settings'), // zoom the screenshot in on the form
    });

    await doc.select(page.getByLabel('Time zone'), 'Eastern Time (US)', {
      title: 'Set your time zone',
      text: 'Digests are sent at 8 AM in this time zone.',
    });

    await doc.click(page.getByRole('button', { name: 'Save changes' }), {
      title: 'Save your changes',
      text: 'Click **Save changes**. A confirmation appears in the top-right corner.',
      shot: 'after',
      waitFor: page.getByRole('status').filter({ hasText: 'Settings saved' }),
      highlight: page.getByRole('status'),
    });
  });
});
