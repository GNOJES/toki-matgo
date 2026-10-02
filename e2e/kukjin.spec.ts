import { test, expect } from '@playwright/test';

test('mobile chrysanthemum choice shows scoring alternatives and mandatory choice cannot close on Back', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '국화 선택', exact: true }).click();
  await page.getByRole('button', { name: '국화 열끗 · 쌍피 선택', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '국화를 쌍피로 사용할까요?' });
  await expect(modal).toBeVisible();
  await page.goBack();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '국화 점수 선택', exact: true }).click();
  await page.locator('[data-card-id="m2-0"]').click();
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('기본 8점');
  await expect(modal).toContainText('기본 6점');
  await page.goBack();
  await expect(modal).toBeVisible();
  await page.screenshot({ path: '/tmp/toki-kukjin-dialog.png' });
  await modal.getByRole('button', { name: /쌍피로 사용/ }).click();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'GO_STOP');
  await expect(
    page
      .locator('.captured')
      .nth(1)
      .locator('.captured-group')
      .nth(3)
      .locator('[data-captured-card-id="m9-0"]'),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/toki-kukjin-choice.png' });
});
