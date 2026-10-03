import { test, expect } from '@playwright/test';

test('mobile go stop decision preserves visible board and allows card inspection before deciding', async ({
  page,
}) => {
  for (const [width, height] of [
    [360, 740],
    [378, 672],
    [390, 600],
    [390, 844],
    [412, 915],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/?debug=1');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
    await page.locator('[data-card-id="m2-0"]').click();
    await page.getByRole('button', { name: /쌍피로 사용/ }).click();
    const popup = page.getByRole('dialog', { name: '고 / 스톱', exact: true });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button', { name: /^1고 선택/ })).toBeVisible();
    await expect(popup.getByRole('button', { name: '스톱 이번 판을 마쳐요' })).toBeVisible();
    const popupBounds = await popup.boundingBox();
    expect(popupBounds!.y).toBeGreaterThanOrEqual(0);
    expect(popupBounds!.y + popupBounds!.height).toBeLessThanOrEqual(height + 1);
    if (width === 390 && height === 600)
      await page.screenshot({ path: '/tmp/toki-go-stop-popup.png' });
    await popup.getByRole('button', { name: '패 보기', exact: true }).click();
    const decision = page.getByRole('region', { name: '고·스톱 결정' });
    await expect(decision).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(decision).toContainText('스톱하면');
    const summary = await decision.locator('.go-stop-summary').boundingBox();
    const header = await page.locator('.game-header').boundingBox();
    expect(summary!.width).toBeGreaterThanOrEqual(100);
    expect(summary!.height).toBeLessThanOrEqual(header!.height + 2);
    for (const button of await decision.getByRole('button').all()) {
      const bounds = await button.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
    }
    const boxes = await page
      .locator('.deck, .floor-card, .hand-card, .captured-group')
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {
            visible: !!hit && (el.contains(hit) || hit.contains(el)),
            top: r.top,
            bottom: r.bottom,
          };
        }),
      );
    for (const box of boxes) {
      expect(box.visible).toBe(true);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(height + 1); // WebKit fractional pixel rounding.
    }
    await page.locator('.floor-card').first().click();
    await expect(page.locator('dialog.zoom-modal[open]')).toBeVisible();
    await page.goBack();
    await expect(page.locator('dialog.zoom-modal[open]')).toHaveCount(0);
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'GO_STOP');
    for (const captured of [0, 1]) {
      await page.locator('.captured').nth(captured).locator('.captured-group').last().click();
      await expect(page.locator('dialog.zoom-modal[open]')).toBeVisible();
      await page.goBack();
    }
    await expect(decision).toBeVisible();
    await page.screenshot({ path: `/tmp/toki-go-stop-${width}.png` });
    await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  }
});

for (const inspectBeforeGo of [false, true]) {
  test(`mobile go stop returns for the next decision after ${inspectBeforeGo ? 'Back and header Go' : 'popup Go'}`, async ({
    page,
  }) => {
    await page.goto('/?debug=1');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
    await page.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
    await page.getByRole('button', { name: /쌍피로 사용/ }).click();
    const popup = page.getByRole('dialog', { name: '고 / 스톱', exact: true });
    await expect(popup).toBeVisible();
    if (inspectBeforeGo) {
      await page.goBack();
      await expect(popup).toHaveCount(0);
      await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'GO_STOP');
    }
    await page.getByRole('button', { name: /^1고 선택/ }).click();
    await page.getByRole('button', { name: '보너스 쌍피 내기', exact: true }).click();
    await page.locator('[data-card-id="m1-1"]').click();
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('현재 1고');
    await expect(popup.getByRole('button', { name: /^2고 선택/ })).toBeVisible();
    await popup.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  });
}

test('mobile go stop waits for an existing card inspection to close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
  await page.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
  await page.getByRole('button', { name: /쌍피로 사용/ }).click();
  await page.locator('.captured-group').first().click();
  const zoom = page.locator('dialog.zoom-modal[open]');
  const popup = page.getByRole('dialog', { name: '고 / 스톱', exact: true });
  await expect(zoom).toBeVisible();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'GO_STOP');
  await expect(popup).toHaveCount(0);
  await page.goBack();
  await expect(zoom).toHaveCount(0);
  await expect(popup).toBeVisible();
});
