import { openHandZoom } from './zoom-helper';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
async function speed(context: BrowserContext) {
  await context.addInitScript(() => {
    localStorage.setItem(
      'toki.preferences.v1',
      JSON.stringify({ speed: 'fast', difficulty: 'normal', sound: false, haptic: false }),
    );
  });
}
async function game(page: Page) {
  await expect(page.getByTestId('game-table')).toBeVisible();
}
async function act(page: Page) {
  const table = page.getByTestId('game-table');
  const phase = await table.getAttribute('data-phase');
  if (phase === 'FINISHED') return false;
  if ((await table.getAttribute('data-can-act')) !== 'true') return false;
  const before = await table.getAttribute('data-version');
  if (phase === 'GO_STOP')
    await page.getByRole('button', { name: '스톱 이번 판을 마쳐요' }).click();
  else if (phase === 'SELECT_FLOOR') await page.locator('.floor-choices button').first().click();
  else {
    const pass = page.getByRole('button', { name: /덱 뒤집기/ });
    if ((await page.locator('.hand-card').count()) === 0 && (await pass.isVisible()))
      await pass.click();
    else {
      await page.locator('.hand-card[aria-disabled="false"]').first().click();
      if (await page.getByRole('button', { name: '한 장만 그냥 내기' }).isVisible())
        await page.getByRole('button', { name: '한 장만 그냥 내기' }).click();
    }
  }
  await expect(table).not.toHaveAttribute('data-version', before!);
  await expect(table).toHaveAttribute('data-busy', 'false');
  return true;
}
for (const [width, height] of [
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 915],
])
  test(`mobile ${width}×${height} fits all areas / zoom / settings`, async ({ page, context }) => {
    await speed(context);
    // Stable display deal: a random chongtong would open a result modal before zoom.
    // This override only runs inside this test's browser context.
    await context.addInitScript(() => {
      let seed = 12345;
      const original = crypto.getRandomValues.bind(crypto);
      Object.defineProperty(crypto, 'getRandomValues', {
        value: (array: ArrayBufferView) => {
          if (!(array instanceof Uint32Array)) return original(array);
          for (let i = 0; i < array.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            array[i] = seed;
          }
          return array;
        },
      });
    });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await game(page);
    await page.getByRole('button', { name: '게임 시작', exact: true }).click();
    const rects = await page.locator('[data-testid]').evaluateAll((els) =>
      els.map((el) => ({
        name: el.getAttribute('data-testid'),
        r: el.getBoundingClientRect().toJSON(),
      })),
    );
    for (const { r } of rects) {
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.bottom).toBeLessThanOrEqual(height);
      expect(r.right).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    await expect(page.getByTestId('opponent-hand')).toHaveText('10장');
    await expect(page.getByTestId('opponent-hand').locator('img')).toHaveCount(0);
    expect(await page.locator('.hand-card').count()).toBe(10);
    await expect
      .poll(() =>
        page
          .locator('.hand-card img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await openHandZoom(page);
    await expect(page.locator('dialog.zoom-modal[open]')).toBeVisible();
    await page.getByRole('button', { name: '닫기' }).click();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '편안하게, 내 속도로' })).toBeVisible();
    await page.getByRole('button', { name: '이대로 좋아요' }).click();
    await page.screenshot({ path: `test-results/mobile-${width}.png` });
  });
test('single three complete rounds, results and next dealer', async ({ page, context }) => {
  await speed(context);
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await page.getByRole('button', { name: '개발', exact: true }).click();
  await page.getByLabel('애니메이션 건너뛰기').check();
  await page.getByRole('button', { name: '닫기' }).click();
  for (let round = 1; round <= 3; round++) {
    await game(page);
    for (let steps = 0; steps < 100; steps++) {
      const phase = await page.getByTestId('game-table').getAttribute('data-phase');
      if (phase === 'FINISHED') break;
      if (!(await act(page))) await page.waitForTimeout(150);
    }
    await expect(page.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
    await expect(page.getByRole('button', { name: '한 판 더', exact: true })).toBeVisible();
    if (round < 3) await page.getByRole('button', { name: '한 판 더', exact: true }).click();
  }
});
test('two contexts: Firebase room / same host state / moves / reconnect / complete game / next round', async ({
  browser,
}) => {
  const a = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    }),
    b = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
  await speed(a);
  await speed(b);
  const pa = await a.newPage(),
    pb = await b.newPage();
  const messages: [unknown[], unknown[]] = [[], []];
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on('pageerror', (error) => errors.push(error.message));
  for (const [i, p] of [pa, pb].entries())
    p.on('websocket', (ws) =>
      ws.on('framereceived', ({ payload }) => {
        const raw = payload.toString();
        try {
          const packet = JSON.parse(raw);
          const value = packet?.d?.b?.d;
          const serialized = value?.state?.data ?? value?.data;
          if (typeof serialized === 'string') {
            const state = JSON.parse(serialized);
            if (state.game) messages[i].push(state);
          }
        } catch {}
      }),
    );
  await pa.goto('/');
  await pa.getByRole('button', { name: /친구와 치기/ }).click();
  await pa.getByLabel('내 이름 · 두 경우 모두 이 이름으로 참여해요').fill('가족 A');
  await pa.getByRole('button', { name: /방 만들기/ }).click();
  await expect(pa.getByTestId('room-code')).toBeVisible();
  const code = await pa.getByTestId('room-code').innerText();
  expect(code).toMatch(/^[0-9]{4}$/);
  await pb.goto(`/?room=${code}`);
  await pb.getByLabel('내 이름 · 두 경우 모두 이 이름으로 참여해요').fill('친구 B');
  await pb.getByRole('button', { name: /내 이름으로 참여/ }).click();
  await game(pa);
  await game(pb);
  const match = async () => {
    await expect(pa.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    await expect(pb.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    expect(await pa.getByTestId('game-table').getAttribute('data-version')).toBe(
      await pb.getByTestId('game-table').getAttribute('data-version'),
    );
    expect(
      await pa
        .getByTestId('floor-cards')
        .locator('img')
        .evaluateAll((els) => els.map((e) => e.getAttribute('src')).sort()),
    ).toEqual(
      await pb
        .getByTestId('floor-cards')
        .locator('img')
        .evaluateAll((els) => els.map((e) => e.getAttribute('src')).sort()),
    );
  };
  await match();
  // Full authoritative state is intentionally readable by these two trusted friends.
  await expect.poll(() => messages[0].length > 0 && messages[1].length > 0).toBe(true);
  const initial = messages.map((list) => (list as any[]).find((x) => x.game));
  expect(initial[0].game).toEqual(initial[1].game);
  expect(initial[0].game.deck.length).toBeGreaterThan(0);
  await expect(pa.getByTestId('opponent-hand')).toHaveText('10장');
  await expect(pb.getByTestId('opponent-hand')).toHaveText('10장');
  let steps = 0;
  for (; steps < 4; steps++) {
    if ((await pa.getByTestId('game-table').getAttribute('data-phase')) === 'FINISHED') break;
    const turn = await pa.getByTestId('game-table').getAttribute('data-current');
    await act(turn === '0' ? pa : pb);
    await match();
  }
  const version = await pb.getByTestId('game-table').getAttribute('data-version');
  await b.setOffline(true);
  await expect(pa.locator('.turn-message')).toContainText('친구의 연결을 기다리고 있어요.', {
    timeout: 25000,
  });
  await expect(pa.locator('.connection-banner')).toContainText('친구 B의 재접속을 기다려요');
  await expect(pa.getByTestId('game-table')).toHaveAttribute('data-can-act', 'false');
  await b.setOffline(false);
  await pb.reload();
  await game(pb);
  await expect(pb.getByTestId('game-table')).toHaveAttribute('data-version', version!);
  await match();
  for (; steps < 100; steps++) {
    if ((await pa.getByTestId('game-table').getAttribute('data-phase')) === 'FINISHED') break;
    await expect
      .poll(
        async () =>
          (await pa.getByTestId('game-table').getAttribute('data-can-act')) === 'true' ||
          (await pb.getByTestId('game-table').getAttribute('data-can-act')) === 'true',
      )
      .toBe(true);
    const turn = await pa.getByTestId('game-table').getAttribute('data-current');
    await act(turn === '0' ? pa : pb);
    await match();
  }
  await expect(pa.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  await expect(pb.getByTestId('game-table')).toHaveAttribute('data-phase', 'FINISHED');
  const final = (messages[0] as any[]).filter((m) => m.game?.result).at(-1)?.game.result;
  const finalB = (messages[1] as any[]).filter((m) => m.game?.result).at(-1)?.game.result;
  expect(final).toEqual(finalB);
  expect((messages[0] as any[]).filter((m) => m.game?.result).at(-1)?.game).toEqual(
    (messages[1] as any[]).filter((m) => m.game?.result).at(-1)?.game,
  );
  await pa.getByRole('button', { name: '한 판 더', exact: true }).click();
  await pb.getByRole('button', { name: '한 판 더', exact: true }).click();
  await expect(pa.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  await expect(pb.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  await match();
  await a.setOffline(true);
  await expect(pb.locator('.turn-message')).toContainText('방장의 연결을 기다리고 있어요.', {
    timeout: 30000,
  });
  await a.setOffline(false);
  await pa.reload();
  await game(pa);
  await match();
  await pb.getByRole('button', { name: '나가기', exact: true }).click();
  await pb
    .getByRole('dialog', { name: '대기실로 돌아갈까요?' })
    .getByRole('button', { name: '대기실로', exact: true })
    .click();
  await expect(pb.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
  await expect(pa.getByRole('dialog', { name: '친구가 방을 종료했어요' })).toBeVisible();
  await pa.getByRole('button', { name: '홈으로 돌아가기', exact: true }).click();
  await expect(pa.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});
