import { test, expect } from '@playwright/test';
test('animation failure restores readiness without reloading', async ({ browser }) => {
  const a = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const b = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const pa = await a.newPage(),
    pb = await b.newPage();
  try {
    await pa.goto('/');
    await pa.getByRole('button', { name: /친구와 치기/ }).click();
    await pa.getByLabel('내 이름').fill('auditA');
    await pa.getByRole('button', { name: '방 만들기', exact: true }).click();
    const code = await pa.getByTestId('room-code').innerText();
    await pb.goto('/?room=' + code);
    await pb.getByLabel('내 이름').fill('auditB');
    await pb.getByRole('button', { name: '참여하기', exact: true }).click();
    await expect(pa.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    await expect(pb.getByTestId('game-table')).toBeVisible();
    const actor =
      (await pa.getByTestId('game-table').getAttribute('data-current')) === '0' ? pa : pb;
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await actor.evaluate(() => {
      const original = document.querySelector.bind(document);
      let failed = false;
      document.querySelector = ((selector: string) => {
        if (selector === '.floor-area' && !failed) {
          failed = true;
          throw new Error('audit animation fault');
        }
        return original(selector);
      }) as typeof document.querySelector;
    });
    await actor.locator('.hand-card').first().click();
    const plain = actor.getByRole('button', { name: '한 장만 그냥 내기' });
    if (await plain.isVisible()) await plain.click();
    await expect(actor.getByText('패 이동을 복구했어요. 계속 칠 수 있어요.')).toBeVisible();
    await expect(actor.getByTestId('game-table')).toHaveAttribute('data-busy', 'false');
    const nextActor =
      (await pa.getByTestId('game-table').getAttribute('data-current')) === '0' ? pa : pb;
    await expect(nextActor.getByTestId('game-table')).toHaveAttribute('data-can-act', 'true');
    await expect(pa.getByTestId('game-table')).toHaveAttribute(
      'data-version',
      (await pb.getByTestId('game-table').getAttribute('data-version'))!,
    );
  } finally {
    await a.close();
    await b.close();
  }
});
