import { readFile } from 'node:fs/promises';
import { test, expect, readyGame, startWithSpace, canvasFits } from './helpers.js';
import { cabinetRoot, cabinetSha, origin } from '../scripts/cabinet.mjs';

const candidate = `${origin}/flappy-copilot/`;

test.beforeEach(async ({ page, request }) => {
  const response = await request.get(candidate);
  expect(response.ok()).toBeTruthy();
  expect(await response.text()).toBe(await readFile('dist/index.html', 'utf8'));
  const health = await request.get('/health');
  expect(await health.json()).toEqual({ cabinetSha });
  await page.goto('/arcade/');
  await expect(page.getByRole('button', { name: 'Play Flappy Copilot', exact: true })).toBeVisible();
});

test('serves the real pinned cabinet with only this game URL rewritten', async ({ request }) => {
  const original = JSON.parse(await readFile(`${cabinetRoot}/games.json`, 'utf8'));
  original.find((game) => game.id === 'flappy-copilot').url = '/flappy-copilot/';
  expect(await (await request.get('/arcade/games.json')).json()).toEqual(original);
  for (const file of ['index.html', 'styles.css', 'src/app.js', 'src/catalog.js']) {
    expect(await (await request.get(`/arcade/${file}`)).text())
      .toBe(await readFile(`${cabinetRoot}/${file}`, 'utf8'));
  }
});

for (const launch of ['mouse', 'keyboard']) {
  test(`${launch} launch gives Space and M to the game; reload and return clean up`, async ({ page }) => {
    const card = page.getByRole('button', { name: 'Play Flappy Copilot', exact: true });
    if (launch === 'mouse') await card.click();
    else {
      await card.focus();
      await page.keyboard.press('Enter');
    }
    const frame = await readyGame(page, candidate);
    await startWithSpace(page, frame);
    for (let i = 0; i < 2; i++) {
      await frame.waitForFunction(() => state === 'play' && bird.y >= 270 && bird.vy > 0);
      await page.keyboard.press('Space');
      await expect.poll(() => frame.evaluate(() => bird.vy)).toBeLessThan(0);
      expect(await frame.evaluate(() => state)).toBe('play');
    }
    await expect.poll(() => frame.evaluate(() => pipes.length)).toBeGreaterThan(0);
    const pipeX = await frame.evaluate(() => pipes[0].x);
    await expect.poll(() => frame.evaluate(() => pipes[0].x)).toBeLessThan(pipeX);
    await page.keyboard.press('m');
    expect(await frame.evaluate(() => muted)).toBe(true);
    await page.keyboard.press('m');
    expect(await frame.evaluate(() => muted)).toBe(false);

    await page.locator('#reload-game').click();
    await expect.poll(() => frame.isDetached()).toBe(true);
    const reloaded = await readyGame(page, candidate);
    await startWithSpace(page, reloaded);
    await page.locator('#return-button').click();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(card).toBeFocused();
    expect(reloaded.isDetached()).toBe(true);
    await page.keyboard.press('Enter');
    const relaunched = await readyGame(page, candidate);
    expect(relaunched).not.toBe(reloaded);
    await startWithSpace(page, relaunched);
  });
}

test('canvas fits narrow widths, touch works, and resizing preserves the game', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Play Flappy Copilot', exact: true }).click();
  const frame = await readyGame(page, candidate);
  await canvasFits(frame);
  if (isMobile) await frame.locator('#game').tap();
  else await frame.locator('#game').click();
  expect(await frame.evaluate(() => state)).toBe('play');
  await expect.poll(() => frame.evaluate(() => bird.vy)).toBeLessThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await canvasFits(frame);
  expect(frame.isDetached()).toBe(false);
  await page.setViewportSize({ width: 844, height: 390 });
  await canvasFits(frame);
});

test('switching games removes the old browsing context', async ({ page }) => {
  await page.route('https://filmgirl.github.io/mona-maze/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Mona Maze</title>',
  }));
  await page.getByRole('button', { name: 'Play Flappy Copilot', exact: true }).click();
  const oldFrame = await readyGame(page, candidate);
  // Use the cabinet's real hash router and unchanged sibling URL.
  await page.evaluate(() => { location.hash = 'game/mona-maze'; });
  await expect(page.locator('#frame-host iframe')).toHaveAttribute('src', 'https://filmgirl.github.io/mona-maze/');
  expect(oldFrame.isDetached()).toBe(true);
  await expect(page.locator('iframe')).toHaveCount(1);
  await page.locator('#return-button').click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Flappy Copilot', exact: true }).click();
  await startWithSpace(page, await readyGame(page, candidate));
});

test('native fullscreen keeps cabinet exit controls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Native fullscreen availability varies on mobile; fallback is tested there.');
  await page.getByRole('button', { name: 'Play Flappy Copilot', exact: true }).click();
  const frame = await readyGame(page, candidate);
  await page.locator('#fullscreen-button').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('cabinet');
  await expect(page.locator('#focus-button')).toBeInViewport();
  await expect(page.locator('#return-button')).toBeInViewport();
  await canvasFits(frame);
  await page.locator('#focus-button').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await page.locator('#enter-game').click();
  await startWithSpace(page, frame);
});

test('focus mode and unavailable fullscreen keep usable exits', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Play Flappy Copilot', exact: true }).click();
  const frame = await readyGame(page, candidate);
  await page.locator('#focus-button').click();
  await expect(page.locator('#focus-button')).toHaveText('Exit focus');
  await canvasFits(frame);
  await expect(page.locator('#focus-button')).toBeInViewport();
  await expect(page.locator('#return-button')).toBeInViewport();
  await page.locator('#focus-button').click();
  // Exercise a real supported fallback, not a mocked game or production response.
  await page.locator('#cabinet').evaluate((cabinet) => {
    Object.defineProperty(cabinet, 'requestFullscreen', { value: undefined });
  });
  await page.locator('#fullscreen-button').click();
  await expect(page.locator('#mode-status')).toContainText('Fullscreen is unavailable');
  await expect(page.locator('#focus-button')).toBeInViewport();
  await expect(page.locator('#return-button')).toBeInViewport();
  await canvasFits(frame);
  await page.locator('#return-button').click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play Flappy Copilot', exact: true })).toBeFocused();
});
