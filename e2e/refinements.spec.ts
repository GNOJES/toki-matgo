import { openHandZoom } from './zoom-helper';
import { test, expect } from '@playwright/test';

test('mobile computer dealer waits for start confirmation', async ({ page, context }) => {
  await context.addInitScript(() => {
    let n = 0,
      seed = 12345;
    const original = crypto.getRandomValues.bind(crypto);
    Object.defineProperty(crypto, 'getRandomValues', {
      value: (array: ArrayBufferView) => {
        if (!(array instanceof Uint32Array)) return original(array);
        for (let i = 0; i < array.length; i++) {
          if (n++ === 0) array[i] = Math.floor(4294967296 * 0.9);
          else if (n === 2) array[i] = Math.floor(4294967296 * 0.1);
          else {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            array[i] = seed;
          }
        }
        return array;
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByRole('dialog', { name: '이번 판의 선' })).toContainText('토끼가 선이에요');
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-current', '1');
  await page.waitForTimeout(1800); // Beyond the CPU's maximum thinking delay.
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-version', '0');
  await page.getByRole('button', { name: '게임 시작', exact: true }).click();
  await expect(page.getByTestId('game-table')).not.toHaveAttribute('data-version', '0');
});

test('mobile resting cards keep their coordinates after capture, strike is tilted and text is above it', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '바닥 두 장 · 따닥', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '개발 · 룰 검증' })).toHaveCount(0);
  await expect(page.locator('button[data-floor-card-id="m1-0"]')).toBeVisible();
  await expect(page.locator('button[data-floor-card-id="m1-1"]')).toBeVisible();
  const before: Record<string, { x: number; y: number }> = await page
    .locator('button[data-floor-card-id]')
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [
          el.getAttribute('data-floor-card-id'),
          el.getBoundingClientRect().toJSON(),
        ]),
      ),
    );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.hand-card[data-card-id="m1-2"]').click();
  await page.getByRole('button', { name: '1월 송학 띠 선택', exact: true }).click();
  const moving = page.locator('.card-motion.play');
  await expect(moving).toBeVisible();
  const angle = await moving.evaluate((el) =>
    Math.abs(parseFloat((el as HTMLElement).style.getPropertyValue('--land-angle'))),
  );
  expect(angle).toBeGreaterThanOrEqual(9);
  await expect(page.locator('.slap-impact')).toBeVisible();
  expect(
    await page.locator('.turn-message').evaluate((el) => Number(getComputedStyle(el).zIndex)),
  ).toBeGreaterThan(await moving.evaluate((el) => Number(getComputedStyle(el).zIndex)));
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  const after: Record<string, { x: number; y: number }> = await page
    .locator('button[data-floor-card-id]')
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [
          el.getAttribute('data-floor-card-id'),
          el.getBoundingClientRect().toJSON(),
        ]),
      ),
    );
  for (const [id, rect] of Object.entries(after))
    if (before[id]) {
      expect(rect.x).toBeCloseTo(before[id].x, 1);
      expect(rect.y).toBeCloseTo(before[id].y, 1);
    }
});

test('browser traversal from an outside entry stays in game and cross-document exit asks confirmation', async ({
  page,
  browserName,
  context,
}) => {
  test.skip(browserName !== 'chromium', 'Chrome browser history protocol');
  await page.goto('/outside-test');
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  const cdp = await context.newCDPSession(page);
  await openHandZoom(page);
  let history = await cdp.send('Page.getNavigationHistory');
  await cdp.send('Page.navigateToHistoryEntry', {
    entryId: history.entries[history.currentIndex - 1].id,
  });
  await expect(page.locator('dialog.zoom-modal[open]')).toHaveCount(0);
  await expect(page.getByTestId('game-table')).toBeVisible();
  history = await cdp.send('Page.getNavigationHistory');
  await cdp.send('Page.navigateToHistoryEntry', {
    entryId: history.entries[history.currentIndex - 1].id,
  });
  await expect(page.getByRole('dialog', { name: '대기실로 돌아갈까요?' })).toBeVisible();
  await page.getByRole('button', { name: '계속 치기', exact: true }).click();
  let confirmation = false;
  page.on('dialog', async (dialog) => {
    confirmation = dialog.type() === 'beforeunload';
    await dialog.dismiss();
  });
  await page.goto('about:blank', { timeout: 5000 }).catch(() => {});
  expect(confirmation).toBe(true);
  await expect(page.getByTestId('game-table')).toBeVisible();
});

test('mobile center deck matches floor card size and twelve months never cover each other', async ({
  page,
}) => {
  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [412, 915],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByRole('button', { name: '열두 달 바닥', exact: true }).click();
    await expect(page.locator('.floor-card')).toHaveCount(12);
    const measurements = await page.locator('.floor-area').evaluate((board) => {
      const bounds = board.getBoundingClientRect();
      const deck = board.querySelector('.deck .hwatu')!;
      const d = deck.getBoundingClientRect().toJSON();
      const cards = [...board.querySelectorAll('.floor-card')].map((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        width: parseFloat(getComputedStyle(el).width),
        angle: getComputedStyle(el).transform,
      }));
      return { bounds: bounds.toJSON(), deck: d, cards };
    });
    expect(measurements.cards).toHaveLength(12);
    const { deck, bounds, cards } = measurements;
    expect(deck.x + deck.width / 2).toBeCloseTo(bounds.x + bounds.width / 2, 0);
    expect(deck.y + deck.height / 2).toBeCloseTo(bounds.y + bounds.height / 2, 0);
    for (const card of cards) {
      expect(card.width).toBeCloseTo(deck.width, 0);
      expect(card.angle).not.toBe('none');
      expect(card.rect.left).toBeGreaterThanOrEqual(bounds.left);
      expect(card.rect.right).toBeLessThanOrEqual(bounds.right);
    }
    const rects = [...cards.map((c) => c.rect), deck];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
          b = rects[j];
        const overlap =
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        expect(overlap).toBe(0);
      }
  }
});

test('mobile ppuk bonus rests with its month instead of an unrelated bonus group', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '뻑과 보너스', exact: true }).click();
  await page.locator('.hand-card[data-card-id="m1-2"]').click();
  await expect(page.locator('[data-floor-month="1"] [data-floor-card-id="bonus-0"]')).toBeVisible();
  await expect(page.locator('[data-floor-month="0"]')).toHaveCount(0);
});
