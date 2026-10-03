import { expect, test, type Page } from '@playwright/test';

async function scoreFixture(page: Page) {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
}

test('mobile captured score and five-column inspection update after kukjin conversion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await scoreFixture(page);
  const own = page.locator('.captured').last();
  await own.getByRole('button', { name: /먹은 피/ }).click();
  const zoom = page.locator('dialog.zoom-modal[open]');
  await expect(zoom.getByRole('heading')).toHaveText('먹은 피 (현재 6점)');
  const boxes = await zoom
    .locator('.zoom-grid > div')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  expect(boxes).toHaveLength(15);
  expect(new Set(boxes.slice(0, 5).map((b) => b.y)).size).toBe(1);
  expect(boxes[5].y).toBeGreaterThan(boxes[0].y);
  expect(boxes[5].y - boxes[0].bottom).toBeLessThanOrEqual(14);
  await page.screenshot({ path: '/tmp/toki-captured-five.png' });
  await page.goBack();
  await expect(zoom).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '대기실로 돌아갈까요?' })).toHaveCount(0);
  await page.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
  await page.getByRole('button', { name: /쌍피로 사용/ }).click();
  await page.getByRole('button', { name: '패 보기', exact: true }).click();
  await own.getByRole('button', { name: /먹은 피/ }).click();
  await expect(zoom.getByRole('heading')).toHaveText('먹은 피 (현재 8점)');
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveCount(0);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'GO_STOP');
});

test('mobile native popup close and history back together only dismiss captured cards', async ({
  page,
}) => {
  await scoreFixture(page);
  await page
    .locator('.captured')
    .last()
    .getByRole('button', { name: /먹은 피/ })
    .click();
  await page.locator('dialog.zoom-modal').evaluate((el: HTMLDialogElement) => {
    el.close();
    // Some WebViews deliver navigation while the native dialog is already closed,
    // before React has removed the inspection. Exercise that lifecycle boundary.
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('dialog.zoom-modal')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '대기실로 돌아갈까요?' })).toHaveCount(0);
  await expect(page.getByTestId('game-table')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '대기실로 돌아갈까요?' })).toBeVisible();
});

test('mobile decision shows next Go and result compares both cumulative scores', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki.play-history.v1',
      JSON.stringify({
        solo: { wins: 2, losses: 1, draws: 0, points: 30, opponentPoints: 20 },
        recent: [],
      }),
    );
  });
  await scoreFixture(page);
  await expect(page.locator('.player-info.active')).toContainText('내 차례');
  await page.screenshot({ path: '/tmp/toki-active-turn.png' });
  await page.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
  await page.getByRole('button', { name: /쌍피로 사용/ }).click();
  const popup = page.getByRole('dialog', { name: '고 / 스톱', exact: true });
  await expect(popup).toContainText('현재 0고');
  await expect(popup.getByRole('button', { name: /^1고 선택/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/toki-next-go.png' });
  await popup.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
  const result = page.locator('.result-modal');
  const comparison = result.getByRole('region', { name: '혼자 치기 누적' });
  await expect(comparison).toContainText('나');
  await expect(comparison).toContainText('토끼');
  await expect(comparison.locator('.match-player').first()).toContainText('46점');
  await expect(comparison.locator('.match-player').last()).toContainText('20점');
  await expect(comparison).toContainText('26점 앞서고 있어요');
  await page.screenshot({ path: '/tmp/toki-result-comparison.png' });
});
