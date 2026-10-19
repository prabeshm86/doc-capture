// Example flows for the bundled demo app. Run them with `npm run demo`.
// Use these as the pattern for your own flows in ../ (they are skipped in normal runs).
import { test } from '../../lib/doc';

test.describe('Reports', () => {
  test('Create a new report', async ({ page, doc }) => {
    doc.flow({
      summary: 'Build a report from one of your data sources and choose how it is displayed.',
      prerequisites: ['You need the **Editor** role to create reports.'],
    });

    await doc.goto('/#/dashboard');

    await doc.click(page.getByRole('link', { name: 'Reports' }), {
      title: 'Open Reports',
      text: 'In the left sidebar, click **Reports**.',
    });

    await doc.click(page.getByRole('link', { name: 'New report' }), {
      title: 'Start a new report',
      text: 'Click **+ New report** in the top-right corner.',
    });

    await doc.fill(page.getByLabel('Report name'), 'Q4 pipeline by region', {
      title: 'Name the report',
      text: 'Enter a name your team will recognize.',
      tip: 'Names don’t have to be unique, but a clear name makes the report easier to find.',
    });

    await doc.select(page.getByLabel('Data source'), 'Sales', {
      title: 'Choose a data source',
      text: 'Pick where the data comes from. For this example, choose **Sales**.',
    });

    await doc.select(page.getByLabel('Date range'), 'This quarter', {
      title: 'Set the date range',
      text: 'Choose the period the report covers.',
    });

    await doc.check(page.getByRole('radio', { name: 'Line' }), {
      title: 'Pick a chart type',
      text: 'Select **Line** to show the trend over time.',
      highlight: page.getByRole('group', { name: 'Chart type' }),
    });

    await doc.check(page.getByLabel('Email me when the report is ready'), {
      title: 'Get notified (optional)',
      text: 'Tick **Email me when the report is ready** if the report takes a while to build.',
      highlight: page.locator('label.check'), // outline the whole label, not just the tiny box
    });

    await doc.click(page.getByRole('button', { name: 'Save report' }), {
      title: 'Save the report',
      text: 'Click **Save report**.',
    });

    await doc.shot({
      title: 'Find your new report',
      text: 'You’re taken back to **Reports**, where the new report appears at the top with a **New** label.',
      highlight: page.getByRole('row', { name: /Q4 pipeline by region/ }),
      waitFor: page.getByRole('status').filter({ hasText: 'Report created' }),
    });
  });

  test('Search for a report', async ({ page, doc }) => {
    doc.flow({ summary: 'Find any report you own or that has been shared with you.' });

    await doc.goto('/#/reports');

    await doc.fill(page.getByRole('searchbox', { name: 'Search reports' }), 'sales', {
      title: 'Search by name',
      text: 'Type part of the report name in the search box at the top of the page. The list filters as you type.',
    });

    await doc.shot({
      title: 'Open a result',
      text: 'Matching reports are listed below. Click a report’s name to open it.',
      highlight: page.getByRole('table'),
    });
  });
});
