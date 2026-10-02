import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page, name: string) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
}

async function endpoint(page: Page, motion: string, endpoint: 'from' | 'to', target: string) {
  return page.locator(motion).evaluate(
    (el, { endpoint, target }) => {
      const style = (el as HTMLElement).style;
      const board = document.querySelector('.floor-area')!.getBoundingClientRect();
      const rect = document.querySelector(target)!.getBoundingClientRect();
      const width = parseFloat(style.getPropertyValue('--motion-width'));
      const height = parseFloat(style.getPropertyValue('--motion-height'));
      return {
        x: parseFloat(style.getPropertyValue(`--${endpoint}-x`)) + width / 2 + board.left,
        y: parseFloat(style.getPropertyValue(`--${endpoint}-y`)) + height / 2 + board.top,
        targetX: rect.left + rect.width / 2,
        targetY: rect.top + rect.height / 2,
      };
    },
    { endpoint, target },
  );
}

test('mobile bonus pauses at center then enters own captured pi without landing on floor', async ({
  page,
}) => {
  await fixture(page, '보너스 손패');
  await page.locator('.hand-card[data-card-id="bonus-0"]').click();
  const preview = page.locator('.card-motion.bonus');
  await expect(preview).toBeVisible();
  const center = await endpoint(page, '.card-motion.bonus', 'to', '.deck .hwatu');
  expect(center.x).toBeCloseTo(center.targetX, 0);
  expect(center.y).toBeCloseTo(center.targetY, 0);
  await expect(page.locator('[data-floor-card-id="bonus-0"]')).toHaveCount(0);
  await expect(page.locator('.card-motion.bonus-capture')).toBeVisible();
  const intoPi = await page.locator('.card-motion.bonus-capture').evaluate((el) => {
    const board = document.querySelector('.floor-area')!.getBoundingClientRect();
    const pile = document
      .querySelectorAll('.captured')[1]
      .querySelectorAll('.captured-group')[3]
      .getBoundingClientRect();
    const style = (el as HTMLElement).style;
    return {
      x:
        parseFloat(style.getPropertyValue('--to-x')) +
        parseFloat(style.getPropertyValue('--motion-width')) / 2 +
        board.left,
      y:
        parseFloat(style.getPropertyValue('--to-y')) +
        parseFloat(style.getPropertyValue('--motion-height')) / 2 +
        board.top,
      targetX: pile.left + pile.width / 2,
      targetY: pile.top + pile.height / 2,
    };
  });
  expect(intoPi.x).toBeCloseTo(intoPi.targetX, 0);
  expect(intoPi.y).toBeCloseTo(intoPi.targetY, 0);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  await expect(
    page.locator('.captured').nth(1).locator('[data-captured-card-id="bonus-0"]'),
  ).toBeVisible();
});

test('mobile bomb creates two playable hand tokens and stolen pi flies from opponent', async ({
  page,
}) => {
  await fixture(page, '폭탄과 피 강탈');
  const stolen = await page
    .locator('.captured')
    .first()
    .locator('[data-captured-card-id]')
    .getAttribute('data-captured-card-id');
  await page.locator('.hand-card[data-card-id="m1-0"]').click();
  await page.getByRole('button', { name: '폭탄 내기', exact: true }).click();
  await expect(page.locator('.card-motion.transfer')).toBeVisible();
  const callout = page.locator('.turn-message.callout');
  await expect(callout).toContainText('폭탄');
  expect(
    await callout.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(26);
  await page.screenshot({ path: '/tmp/toki-special-effect.png' });
  const from = await endpoint(
    page,
    '.card-motion.transfer',
    'from',
    `.captured [data-captured-card-id="${stolen}"] .hwatu`,
  );
  expect(from.x).toBeCloseTo(from.targetX, 0);
  expect(from.y).toBeCloseTo(from.targetY, 0);
  await expect(
    page.locator('.captured').first().locator(`[data-captured-card-id="${stolen}"]`),
  ).toBeHidden();
  await expect(page.locator('.bomb-pass')).toHaveCount(2);
  await expect(page.locator('.pass-button')).toHaveCount(0);
  await expect(
    page.locator('.captured').nth(1).locator(`[data-captured-card-id="${stolen}"]`),
  ).toBeVisible();
  await page.locator('.bomb-pass').first().click();
  await expect(page.locator('.bomb-pass')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/toki-bomb-board.png' });
});
