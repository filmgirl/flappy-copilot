import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const failures = [];
    const failedRequests = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      failedRequests.push(request);
    });
    await use(page);
    for (const request of failedRequests) {
      const reason = request.failure()?.errorText;
      // Cancellation can be emitted before framedetached. Check after the interaction,
      // and exclude only canceled navigations whose browsing context was removed.
      if (request.isNavigationRequest() && request.frame().isDetached()
          && ['net::ERR_ABORTED', 'cancelled'].includes(reason)) continue;
      failures.push(`${reason} ${request.url()}`);
    }
    expect(failures, 'No uncaught errors, console errors, or missing requested assets').toEqual([]);
  },
});
export { expect };

export async function readyGame(page, expectedUrl) {
  const iframe = page.locator('#frame-host iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute('src', expectedUrl);
  await expect.poll(() => page.frames().find((frame) => frame.url() === expectedUrl)?.url()).toBe(expectedUrl);
  const frame = page.frames().find((entry) => entry.url() === expectedUrl);
  await frame.waitForFunction(() => typeof state !== 'undefined' && state === 'menu' && frame > 0);
  await expect.poll(() => frame.evaluate(() => {
    const pixels = document.querySelector('canvas').getContext('2d').getImageData(0, 0, 480, 640).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    return colors.size;
  }), { message: 'Real game draw loop painted a nonblank, multicolor menu' }).toBeGreaterThan(10);
  return frame;
}

export async function startWithSpace(page, frame) {
  // Deliberately no focus/click inside the game: this catches the cabinet's launch regression.
  await page.keyboard.press('Space');
  await expect.poll(() => frame.evaluate(() => state)).toBe('play');
  await expect(page.locator('#library')).toBeHidden();
  await expect(page.locator('#frame-host iframe')).toBeFocused();
  await expect.poll(() => frame.evaluate(() => bird.vy)).toBeLessThan(0);
}

export async function canvasFits(frame) {
  const bounds = await frame.locator('#game').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
  });
  expect(bounds.width).toBeGreaterThan(100);
  expect(bounds.height).toBeGreaterThan(100);
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.width / bounds.height).toBeCloseTo(3 / 4, 2);
}
