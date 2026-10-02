import { test, expect } from '@playwright/test';
test('production caches first load, reloads offline, plays single and hides debug', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByTestId('game-table')).toBeVisible();
  await expect(page.getByRole('button', { name: '개발', exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg?.active) return false;
        const cache = await caches.open('toki-v5-firebase');
        const keys = await cache.keys();
        return (
          keys.filter((r) => r.url.includes('/_next/static/')).length >= 3 &&
          keys.filter((r) => /\/cards\/m\d+-\d\.webp$/.test(r.url)).length === 48
        );
      }),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /혼자 치기/ })).toBeVisible();
  await expect(page).toHaveTitle('토끼맞고 · 마주 앉은 것처럼');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '편안하게, 내 속도로' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.getByTestId('game-table')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.hand-card img')
        .evaluateAll(
          (images) =>
            images.length === 10 &&
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
        ),
    )
    .toBe(true);
  await expect
    .poll(() => page.locator('.hand-card[aria-disabled="false"]').count(), { timeout: 12000 })
    .toBeGreaterThan(0);
  const version = await page.getByTestId('game-table').getAttribute('data-version');
  await page.locator('.hand-card[aria-disabled="false"]').first().click();
  if (await page.getByRole('button', { name: '한 장만 그냥 내기' }).isVisible())
    await page.getByRole('button', { name: '한 장만 그냥 내기' }).click();
  await expect(page.getByTestId('game-table')).not.toHaveAttribute('data-version', version!);
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
