import { readFile } from 'node:fs/promises';
import { test, expect, readyGame, startWithSpace, canvasFits } from './helpers.js';

const gameUrl = 'https://filmgirl.github.io/flappy-copilot/';
const cabinetUrl = 'https://filmgirl.github.io/arcade/#game/flappy-copilot';

test('published game and real cabinet are playable', async ({ page, request }) => {
  let candidate;
  if (process.env.SMOKE_EXPECT_CANDIDATE === '1') {
    candidate = await readFile('dist/index.html', 'utf8');
    // Bounded CDN propagation polling; never accepts a stale deployed game.
    await expect.poll(async () => {
      const response = await request.get(`${gameUrl}?deploy=${process.env.GITHUB_SHA || 'local'}`, {
        headers: { 'Cache-Control': 'no-cache' }, timeout: 10_000,
      });
      return response.ok() && await response.text() === candidate;
    }, { timeout: 90_000, intervals: [1_000, 3_000, 5_000] }).toBe(true);
  }
  const response = await page.goto(gameUrl);
  expect(response.ok()).toBeTruthy();
  if (candidate) expect(await response.text()).toBe(candidate);
  await page.waitForFunction(() => typeof state !== 'undefined' && state === 'menu' && frame > 0);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => state)).toBe('play');
  const embeddedResponse = page.waitForResponse((response) => response.url() === gameUrl);
  await page.goto(cabinetUrl);
  const embedded = await embeddedResponse;
  expect(embedded.ok()).toBeTruthy();
  if (candidate) expect(await embedded.text()).toBe(candidate);
  const frame = await readyGame(page, gameUrl);
  await startWithSpace(page, frame);
  await canvasFits(frame);
  await page.keyboard.press('m');
  expect(await frame.evaluate(() => muted)).toBe(true);
  await page.locator('#reload-game').click();
  const reloaded = await readyGame(page, gameUrl);
  expect(frame.isDetached()).toBe(true);
  await startWithSpace(page, reloaded);
  await page.locator('#return-button').click();
  await expect(page.locator('iframe')).toHaveCount(0);
});
