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
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('button', { name: /혼자 치기/ }).click();
    await game(page);
    const rects = await page
      .locator('[data-testid]')
      .evaluateAll((els) =>
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
    expect(await page.getByTestId('opponent-hand').locator('img').count()).toBeGreaterThan(0);
    expect(await page.locator('.hand-card').count()).toBe(10);
    await page.getByRole('button', { name: '손패 확대 ↗' }).click();
    await expect(page.getByRole('dialog', { name: '내 손패 크게 보기' })).toBeVisible();
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
test('two contexts: room / hidden card traffic / moves / reconnect / complete game / next round', async ({
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
  for (const [i, p] of [pa, pb].entries())
    p.on('websocket', (ws) =>
      ws.on('framereceived', ({ payload }) => {
        const raw = payload.toString();
        if (raw.startsWith('42')) {
          try {
            const [event, data] = JSON.parse(raw.slice(2));
            if (event === 'room:state') messages[i].push(data);
          } catch {}
        }
      }),
    );
  await pa.goto('/');
  await pa.getByRole('button', { name: /친구와 치기/ }).click();
  await pa.getByLabel('어떻게 불러드릴까요?').fill('가족 A');
  await pa.getByRole('button', { name: /방 만들기/ }).click();
  await expect(pa.getByTestId('room-code')).toBeVisible();
  const code = await pa.getByTestId('room-code').innerText();
  await pb.goto(`/?room=${code}`);
  await pb.getByLabel('어떻게 불러드릴까요?').fill('친구 B');
  await pb.getByRole('button', { name: /방 코드로 참여/ }).click();
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
  // Verify both *actual received* initial payloads, not merely CSS hiding.
  const initial = messages.map((list) => (list as any[]).find((x) => x.game));
  for (let i = 0; i < 2; i++) {
    expect(initial[i]).toBeTruthy();
    expect(initial[i].game.players[1 - i]).not.toHaveProperty('hand');
    expect(initial[i].game).not.toHaveProperty('deck');
    const encoded = JSON.stringify(initial[i]);
    for (const c of initial[1 - i].game.hand) expect(encoded).not.toContain(`"${c.id}"`);
  }
  let steps = 0;
  for (; steps < 4; steps++) {
    if ((await pa.getByTestId('game-table').getAttribute('data-phase')) === 'FINISHED') break;
    const turn = await pa.getByTestId('game-table').getAttribute('data-current');
    await act(turn === '0' ? pa : pb);
    await match();
  }
  const version = await pb.getByTestId('game-table').getAttribute('data-version');
  await b.setOffline(true);
  await expect(pa.getByRole('status')).toContainText('상대방 연결을 기다리는 중', {
    timeout: 25000,
  });
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
  // Every state/event/reconnect packet is checked against the other player's concurrent hand.
  for (let i = 0; i < 2; i++)
    for (const msg of messages[i] as any[]) {
      if (!msg.game) continue;
      expect(msg.game.players[1 - i]).not.toHaveProperty('hand');
      const counterpart = (messages[1 - i] as any[]).find(
        (other) =>
          other.game &&
          other.round === msg.round &&
          other.game.stateVersion === msg.game.stateVersion,
      );
      if (counterpart)
        for (const c of counterpart.game.hand)
          expect(JSON.stringify(msg)).not.toContain(`"${c.id}"`);
    }
  await pa.getByRole('button', { name: '한 판 더', exact: true }).click();
  await pb.getByRole('button', { name: '한 판 더', exact: true }).click();
  await expect(pa.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  await expect(pb.getByTestId('game-table')).toHaveAttribute('data-round', '2');
  await match();
  await a.close();
  await b.close();
});
