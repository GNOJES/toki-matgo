import { test, expect } from '@playwright/test';

test('mobile in-app browser keeps guidance and all cards separate as toolbars resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 378, height: 672 });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '열두 달 바닥', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.floor-card')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-floor-card-id')).sort()),
    )
    .toEqual(Array.from({ length: 12 }, (_, i) => `m${i + 1}-0`).sort());
  const version = await page.getByTestId('game-table').getAttribute('data-version');
  for (const [width, height] of [
    [378, 672],
    [360, 640],
    [390, 600],
    [378, 744],
    [378, 672],
  ]) {
    await page.setViewportSize({ width, height });
    // Mobile Chromium applies dvh and container layout after the viewport resize event.
    await expect
      .poll(() =>
        page.getByTestId('game-table').evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(height);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollHeight))
      .toBe(height);
    await page.locator('.floor-card img').evaluateAll(async (images) => {
      await Promise.all(images.map((img) => (img as HTMLImageElement).decode()));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    const geometry = await page.evaluate(() => {
      const rect = (el: Element) => el.getBoundingClientRect().toJSON();
      const board = rect(document.querySelector('.floor-area')!);
      const guide = rect(document.querySelector('.turn-message')!);
      const floor = [...document.querySelectorAll('.floor-card')].map(rect);
      const deck = rect(document.querySelector('.deck .hwatu')!);
      const hands = [...document.querySelectorAll('.hand-card .hwatu')].map(rect);
      return {
        board,
        guide,
        floor,
        deck,
        hands,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    const { board, guide, floor, deck, hands } = geometry;
    expect(guide.top).toBeGreaterThanOrEqual(board.bottom);
    expect(geometry.scrollHeight).toBe(height);
    expect(hands).toHaveLength(10);
    for (const card of [...floor, deck, ...hands]) {
      expect(card.top).toBeGreaterThanOrEqual(0);
      expect(card.bottom, JSON.stringify({ width, height, card, geometry })).toBeLessThanOrEqual(
        height + 1,
      );
      expect(card.left).toBeGreaterThanOrEqual(0);
      expect(card.right).toBeLessThanOrEqual(width);
    }
    for (const card of floor) {
      expect(card.top, JSON.stringify({ width, height, card, board })).toBeGreaterThanOrEqual(
        board.top,
      );
      expect(card.bottom, JSON.stringify({ width, height, card, board })).toBeLessThanOrEqual(
        board.bottom,
      );
    }
    expect(deck.width).toBe(hands[0].width);
    const rects = [...floor, deck, guide];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
          b = rects[j];
        const overlap =
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
          Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        expect(overlap, JSON.stringify({ width, height, a, b })).toBe(0);
      }
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-version', version!);
  }
  await page.screenshot({ path: '/tmp/toki-short-viewport.png' });
});
