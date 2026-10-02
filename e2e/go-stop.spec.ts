import { test, expect } from '@playwright/test';

test('mobile go stop decision preserves visible board and allows card inspection before deciding', async ({
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
    await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
    await page.locator('[data-card-id="m2-0"]').click();
    await page.getByRole('button', { name: /쌍피로 사용/ }).click();
    const decision = page.getByRole('region', { name: '고·스톱 결정' });
    await expect(decision).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(decision).toContainText('스톱하면');
    const summary = await decision.locator('.go-stop-summary').boundingBox();
    const header = await page.locator('.game-header').boundingBox();
    expect(summary!.width).toBeGreaterThanOrEqual(100);
    expect(summary!.height).toBeLessThanOrEqual(header!.height + 2);
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
