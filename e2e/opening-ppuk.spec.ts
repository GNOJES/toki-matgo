import { test, expect } from '@playwright/test';
import { startDebugGame } from './debug-helper';

for (const reducedMotion of ['reduce', 'no-preference'] as const)
  for (const [fixture, title, payment] of [
    ['뻑과 보너스', '첫뻑!', '상대에게 7점 획득'],
    ['2연뻑', '2연뻑!', '상대에게 14점 추가'],
    ['3연뻑', '3연뻑!', '상대에게 21점 추가'],
  ])
    test(`mobile ${reducedMotion} fast ${title} shows matgo payment long enough`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.emulateMedia({ reducedMotion });
      await page.addInitScript(() => {
        localStorage.setItem(
          'toki.preferences.v1',
          JSON.stringify({ speed: 'fast', sound: false, haptic: false }),
        );
        localStorage.setItem('toki.nickname.v1', '친구이름');
      });
      await page.goto('/?debug=1');
      await startDebugGame(page);
      await page.getByRole('button', { name: '개발', exact: true }).click();
      await page.getByRole('button', { name: fixture, exact: true }).click();
      await page.evaluate(() => {
        const record = { start: 0, end: 0 };
        (window as any).ppukNoticeTiming = record;
        new MutationObserver(() => {
          if (document.querySelector('.callout.opening-ppuk')) {
            if (!record.start) record.start = performance.now();
          } else if (record.start && !record.end) record.end = performance.now();
        }).observe(document.querySelector('.floor-area')!, { childList: true, subtree: true });
      });
      await page.locator('.hand-card[data-card-id="m1-2"]').click();
      const notice = page.locator('.callout.opening-ppuk');
      await expect(notice).toBeVisible();
      await expect(notice.locator('.effect-player')).toHaveText('나');
      await expect(notice).toContainText(title);
      await expect(notice.locator('small')).toHaveText(payment);
      await expect(notice).not.toContainText('세 장이');
      const box = await notice.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      if (fixture === '2연뻑' && reducedMotion === 'reduce')
        await page.screenshot({ path: '/tmp/matgo-opening-ppuk.png' });
      await expect(notice).toHaveCount(0);
      const duration = await page.evaluate(() => {
        const r = (window as any).ppukNoticeTiming;
        return r.end - r.start;
      });
      expect(duration).toBeGreaterThanOrEqual(2150);
      if (fixture === '3연뻑') {
        await expect(page.getByRole('dialog', { name: '기분 좋은 한 판!' })).toBeVisible();
        await expect(page.getByText('즉시 점수 · 나 42 / 토끼 0')).toBeVisible();
      }
    });
