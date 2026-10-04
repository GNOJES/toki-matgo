import { openHandZoom } from './zoom-helper';
import { test, expect, type Page } from '@playwright/test';

async function observeFlights(page: Page) {
  await page.evaluate(() => {
    const records: { kind: string; card: string; target: string; hidden: boolean }[] = [];
    (window as unknown as { flightRecords: typeof records }).flightRecords = records;
    new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>('.card-motion');
      if (!el) return;
      const target = el.dataset.targetCardId ?? '';
      records.push({
        kind: el.className,
        card: el.dataset.movingCardId ?? '',
        target,
        hidden:
          !!target &&
          getComputedStyle(document.querySelector(`[data-floor-card-id="${target}"]`)!)
            .visibility === 'hidden',
      });
    }).observe(document.querySelector('.floor-area')!, {
      subtree: true,
      childList: true,
      attributes: true,
    });
  });
}
async function hasFlight(page: Page, kind: string, card: string, target: string, hidden?: boolean) {
  return page.evaluate(
    ({ kind, card, target, hidden }) =>
      (
        window as unknown as {
          flightRecords: { kind: string; card: string; target: string; hidden: boolean }[];
        }
      ).flightRecords.some(
        (r) =>
          r.kind.includes(kind) &&
          r.card === card &&
          r.target === target &&
          (hidden === undefined || r.hidden === hidden),
      ),
    { kind, card, target, hidden },
  );
}

test('mobile chooses a floor card before striking it, flips at the deck and strikes the remaining card', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByRole('button', { name: '바닥 두 장 · 따닥', exact: true }).click();
  const hand = page.locator('.hand-card[data-card-id="m1-2"]');
  await expect(hand).toHaveClass(/matchable/);
  expect(await hand.locator('.hwatu').evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe(
    'none',
  );
  await expect(page.locator('.hand-match-dot')).toHaveCount(0);
  await observeFlights(page);
  await hand.click();
  const choice = page.getByRole('dialog', { name: '어떤 패를 먹을까요?' });
  await expect(choice).toBeVisible();
  await expect(page.locator('.card-motion.play')).toHaveCount(0);
  await expect(page.locator('.card-motion.waiting')).toHaveAttribute('data-moving-card-id', 'm1-2');
  const target = page.locator('button[data-floor-card-id="m1-1"]');
  const targetRect = await target.locator('.hwatu').boundingBox();
  const board = await page.locator('.floor-area').boundingBox();
  await choice.getByRole('button', { name: '1월 송학 띠 선택', exact: true }).click();
  const strike = page.locator('.card-motion.play[data-moving-card-id="m1-2"]');
  await expect(strike).toHaveAttribute('data-target-card-id', 'm1-1');
  const coords = await strike.evaluate((el) => ({
    x: parseFloat((el as HTMLElement).style.getPropertyValue('--to-x')),
    y: parseFloat((el as HTMLElement).style.getPropertyValue('--to-y')),
  }));
  expect(coords.x).toBeCloseTo(targetRect!.x - board!.x, 0);
  expect(coords.y).toBeCloseTo(targetRect!.y - board!.y, 0);
  const flip = page.locator('.card-motion.flip[data-moving-card-id="m1-3"]');
  await expect(flip).toBeVisible();
  await expect(flip.locator('.flip-back img')).toHaveAttribute(
    'src',
    /^\/cards\/back\.svg\?v=[a-f0-9]+$/,
  );
  const deck = await page.locator('.deck .hwatu').boundingBox();
  const flipped = await flip.boundingBox();
  expect(flipped!.x).toBeCloseTo(deck!.x, 0);
  expect(flipped!.y).toBeCloseTo(deck!.y, 0);
  await expect.poll(() => hasFlight(page, 'play', 'm1-3', 'm1-0')).toBe(true);
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  await expect(page.locator('.pending-cards')).toHaveCount(0);
});

test('mobile native close requests dismiss hand popup then confirm return to lobby', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await openHandZoom(page);
  const popup = page.locator('dialog.zoom-modal[open]');
  await expect(popup).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(page.getByTestId('game-table')).toBeVisible();
  await openHandZoom(page);
  await expect(popup).toBeVisible();
  // Native Android may close the dialog directly when cancellation is unavailable.
  await popup.evaluate((el) => (el as HTMLDialogElement).close());
  await expect(popup).toHaveCount(0);
  // Chromium routes Escape through the same CloseWatcher as Android system Back.
  // WebKit uses the history fallback instead.
  if (await page.evaluate(() => 'CloseWatcher' in window)) await page.keyboard.press('Escape');
  else await page.goBack();
  const exit = page.getByRole('dialog', { name: '대기실로 돌아갈까요?' });
  await expect(exit).toBeVisible();
  await exit.getByRole('button', { name: '대기실로', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => 'CloseWatcher' in window)) await page.keyboard.press('Escape');
    else await page.goBack();
    await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
  }
});

for (const draw of ['m1-2', 'm12-0'])
  test(`mobile deck ${draw} chooses before strike or lands directly in an empty slot`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?debug=1');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByText('직접 패 분배', { exact: true }).click();
    await page.getByRole('textbox', { name: '직접 패 분배 JSON' }).fill(
      JSON.stringify({
        hand: ['m8-0', 'm8-1', 'm8-2', 'm9-0', 'm9-1', 'm9-2', 'm10-0', 'm10-1', 'm10-2', 'm11-0'],
        floor: ['m1-0', 'm1-1', 'm2-0', 'm3-0', 'm4-0', 'm5-0', 'm6-0', 'm7-0'],
        draw: [draw],
      }),
    );
    await page.getByRole('button', { name: '이 분배로 시작' }).click();
    await observeFlights(page);
    await page.locator('.hand-card[data-card-id="m11-0"]').click();
    await expect(page.locator('.card-motion.place[data-moving-card-id="m11-0"]')).toHaveAttribute(
      'data-target-card-id',
      'm11-0',
    );
    await expect(page.locator(`.card-motion.flip[data-moving-card-id="${draw}"]`)).toBeVisible();
    if (draw === 'm1-2') {
      const choice = page.getByRole('dialog', { name: '어떤 패를 먹을까요?' });
      await expect(choice).toBeVisible();
      const waiting = page.locator('.card-motion.waiting');
      await expect(waiting).toHaveAttribute('data-moving-card-id', draw);
      const deck = await page.locator('.deck .hwatu').boundingBox();
      const held = await waiting.boundingBox();
      expect(held!.x).toBeCloseTo(deck!.x, 0);
      expect(held!.y).toBeCloseTo(deck!.y, 0);
      await page.keyboard.press('Escape');
      await expect(choice).toBeVisible();
      await choice.getByRole('button', { name: '1월 송학 띠 선택', exact: true }).click();
      await expect(
        page.locator(`.card-motion.play[data-moving-card-id="${draw}"]`),
      ).toHaveAttribute('data-target-card-id', 'm1-1');
    } else {
      await expect.poll(() => hasFlight(page, 'place', draw, draw, true)).toBe(true);
      await expect(page.locator(`[data-floor-card-id="${draw}"]`)).toBeVisible();
    }
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
  });

for (const stage of ['hand', 'deck'])
  test(`mobile identical pi auto-pick strikes one floor card from ${stage} without a chooser`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?debug=1');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByText('직접 패 분배', { exact: true }).click();
    const played = stage === 'hand' ? 'm1-0' : 'm11-0';
    await page.getByRole('textbox', { name: '직접 패 분배 JSON' }).fill(
      JSON.stringify({
        hand: [played, 'm8-0', 'm8-1', 'm8-2', 'm9-0', 'm9-1', 'm9-2', 'm10-0', 'm10-1', 'm10-2'],
        floor: ['m1-2', 'm1-3', 'm2-0', 'm3-0', 'm4-0', 'm5-0', 'm6-0', 'm7-0'],
        draw: [stage === 'hand' ? 'm12-0' : 'm1-0'],
      }),
    );
    await page.getByRole('button', { name: '이 분배로 시작' }).click();
    await observeFlights(page);
    await page.locator(`.hand-card[data-card-id="${played}"]`).click();
    await expect.poll(() => hasFlight(page, 'play', 'm1-0', 'm1-2')).toBe(true);
    await expect(page.getByRole('dialog', { name: '어떤 패를 먹을까요?' })).toHaveCount(0);
  });
