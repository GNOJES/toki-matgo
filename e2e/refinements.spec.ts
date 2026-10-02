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
  await page.getByRole('button', { name: '손패 확대 ↗' }).click();
  let history = await cdp.send('Page.getNavigationHistory');
  await cdp.send('Page.navigateToHistoryEntry', {
    entryId: history.entries[history.currentIndex - 1].id,
  });
  await expect(page.getByRole('dialog', { name: '내 손패 크게 보기' })).toHaveCount(0);
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
