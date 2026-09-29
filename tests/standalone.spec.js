import { test, expect, canvasFits } from './helpers.js';

const candidate = '/flappy-copilot/';
const arcadeUrl = 'https://filmgirl.github.io/arcade/';

test.beforeEach(async ({ page }) => {
  await page.goto(candidate);
  await page.waitForFunction(() => typeof state !== 'undefined' && state === 'menu' && frame > 0);
});

test('standalone link fits desktop, narrow portrait, and landscape without overlapping the canvas', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await canvasFits(page.mainFrame());
    const link = page.getByRole('link', { name: 'GitHub Arcade', exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', arcadeUrl);
    expect(await link.getAttribute('target')).toBeNull();
    const bounds = await link.boundingBox();
    const canvas = await page.locator('#game').boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    if (viewport.width === 1280) expect(canvas.height).toBe(792);
  }
});

test('navigation focus is isolated from game input and canvas interaction restores Space', async ({ page, isMobile, browserName }) => {
  const link = page.getByRole('link', { name: 'GitHub Arcade', exact: true });
  // WebKit's default keyboard navigation uses Option+Tab to include links.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(link).toBeFocused();
  expect(await link.evaluate((anchor) => anchor.matches(':focus-visible'))).toBe(true);
  expect(await link.evaluate((anchor) => getComputedStyle(anchor).outlineStyle)).toBe('solid');
  await page.keyboard.press('Space');
  await page.keyboard.press('m');
  expect(await page.evaluate(() => ({ state, muted }))).toEqual({ state: 'menu', muted: false });

  // Observe the original document after a real click/tap without leaving it.
  await link.evaluate((anchor) => anchor.addEventListener('click', (event) => event.preventDefault(), { once: true }));
  if (isMobile) await link.tap();
  else await link.click();
  expect(await page.evaluate(() => state)).toBe('menu');

  if (isMobile) await page.locator('#game').tap();
  else await page.locator('#game').click();
  expect(await page.evaluate(() => state)).toBe('play');
  await expect(link).not.toBeFocused();
  await page.waitForFunction(() => state === 'play' && bird.y >= 270 && bird.vy > 0);
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => bird.vy)).toBeLessThan(0);
  expect(await page.evaluate(() => state)).toBe('play');
});

test('Enter follows the same-tab Arcade destination', async ({ page, browserName }) => {
  // Keep this deterministic; the review browser pass checks the real public site.
  await page.route(arcadeUrl, (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Arcade navigation destination</title>',
  }));
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(arcadeUrl);
  await expect(page).toHaveTitle('Arcade navigation destination');
});
