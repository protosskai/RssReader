import { test, expect } from '@playwright/test';

test('RSS Reader renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('http://localhost:9300', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const title = await page.title();
  const bodyLen = (await page.textContent('body'))?.length || 0;
  const htmlLen = (await page.content()).length;

  console.log(`Title: "${title}", Body: ${bodyLen} chars, HTML: ${htmlLen} bytes`);

  // Must have actual content (a loaded Vue app is >50KB)
  expect(htmlLen, 'HTML should contain rendered Vue app').toBeGreaterThan(50000);

  // No Vue errors
  const vueErrors = errors.filter(e => e.includes('[Vue') || e.includes('Failed to') || e.includes('Cannot find'));
  expect(vueErrors, 'No Vue/import errors').toHaveLength(0);
});
