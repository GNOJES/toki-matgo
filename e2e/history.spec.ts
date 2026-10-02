import { test, expect } from '@playwright/test';

test('mobile recent records menu fits below play buttons and Back closes records and reset confirmation', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki.play-history.v1',
      JSON.stringify({
        solo: { wins: 1, losses: 0, draws: 0, points: 7, opponentPoints: 0 },
        recent: [
          {
            id: 'solo',
            at: 1000,
            mode: 'single',
            opponent: '토끼',
            outcome: 'win',
            points: 7,
            reason: 'STOP',
          },
          {
            id: 'friend',
            at: 2000,
            mode: 'multi',
            opponent: '친구',
            outcome: 'loss',
            points: 3,
            reason: 'STOP',
          },
        ],
      }),
    );
  });
  for (const [width, height] of [
    [360, 740],
    [390, 844],
    [412, 915],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const menu = page.getByRole('button', { name: /최근 기록/ });
    const rect = await menu.boundingBox();
    const friends = await page.getByRole('button', { name: /친구와 치기/ }).boundingBox();
    expect(rect!.y).toBeGreaterThan(friends!.y + friends!.height);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(height);
  }
  await page.screenshot({ path: '/tmp/toki-home-history.png' });
  await page.getByRole('button', { name: /최근 기록/ }).click();
  const history = page.getByRole('dialog', { name: '최근 기록', exact: true });
  await history.getByRole('button', { name: '혼자 치기 기록 초기화', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '혼자 치기 기록을 초기화할까요?' })).toHaveCount(0);
  await expect(history).toBeVisible();
  await history.getByRole('button', { name: '혼자 치기 기록 초기화', exact: true }).click();
  await page.getByRole('button', { name: '기록 초기화', exact: true }).click();
  await expect(history).toContainText('총 0판');
  await expect(history.locator('.history-list li')).toHaveCount(1);
  await expect(history).toContainText('친구와 치기');
  await page.goBack();
  await expect(history).toHaveCount(0);
  await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
});
