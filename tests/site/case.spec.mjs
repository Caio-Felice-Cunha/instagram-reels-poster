import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const failures = [];
  page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) failures.push(`external request: ${request.url()}`);
  });
  page._caseFailures = failures;
});

test.afterEach(async ({ page }) => expect(page._caseFailures).toEqual([]));

test('replays the report and exposes the engineering walkthrough', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A Reel batch/i })).toBeVisible();
  await expect(page.locator('#summary')).toContainText('3/3');
  await expect(page.locator('#items article')).toHaveCount(3);
  await page.getByRole('button', { name: /Replay again/i }).click();
  await expect(page.getByText('caption verification', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Pure batch core', { exact: false })).toBeVisible();
  await expect(page.getByText('CAPTION_NOT_SET', { exact: false }).first()).toBeVisible();
});

test('supports keyboard navigation, reduced motion, and narrow screens', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'one accessibility pass is sufficient');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#demo')).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
