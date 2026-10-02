import { test, expect } from '@playwright/test';

test('mobile back closes nested menus, confirms game exit and keeps the home page', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
  await expect(page.getByText('처음이라면, 맞고 안내')).toHaveCount(0);
  await expect(page.getByText('돈 없이, 점수로만 즐겨요.')).toHaveCount(0);
  await expect(page.locator('.table-mark')).toHaveCount(0);
  await expect(page).toHaveTitle('토끼맞고 · 마주 앉은 것처럼');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '편안하게, 내 속도로' });
  await settings.getByRole('button', { name: '맞고 안내', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '맞고, 천천히 익혀요' })).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.goBack();
  await expect(page.getByRole('dialog', { name: '맞고, 천천히 익혀요' })).toHaveCount(0);
  await expect(settings).toBeVisible();
  await page.goBack();
  await expect(settings).toHaveCount(0);
  await page.getByRole('button', { name: /친구와 치기/ }).click();
  await expect(page.getByRole('heading', { name: '친구를 초대해요.' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  const game = page.getByTestId('game-table');
  await expect(game).toBeVisible();
  await expect(game).toHaveAttribute('data-phase', 'PLAY');
  expect(await page.locator('.hand-card').allTextContents()).toEqual(Array(10).fill(''));
  const version = await game.getAttribute('data-version');
  await page.getByRole('button', { name: '손패 확대 ↗' }).click();
  await expect(page.getByRole('dialog', { name: '내 손패 크게 보기' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(game).toHaveAttribute('data-version', version!);
  await page.goBack();
  const exit = page.getByRole('dialog', { name: '화투판을 나갈까요?' });
  await expect(exit).toBeVisible();
  await page.goBack();
  await expect(exit).toHaveCount(0);
  await expect(game).toBeVisible();
  await page.goBack();
  await expect(exit).toBeVisible();
  await exit.getByRole('button', { name: '나가기', exact: true }).click();
  const homeUrl = page.url();
  for (let i = 0; i < 3; i++) {
    await page.goBack();
    await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
    await expect(page).toHaveURL(homeUrl);
  }
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.reload();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '토끼맞고 홈' })).toBeVisible();
});

test('mobile floor pairs and triples show complete faces, enlarge and preserve required choices on back', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  for (const fixture of ['자뻑', '바닥 두 장 · 따닥']) {
    await page.getByRole('button', { name: '개발', exact: true }).click();
    await page.getByRole('button', { name: fixture, exact: true }).click();
    const group = page.locator('[data-floor-month="1"]');
    await expect(group.locator('.floor-card')).toHaveCount(fixture === '자뻑' ? 3 : 2);
    const boxes = await group
      .locator('.floor-card')
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().toJSON()));
    expect(boxes.length).toBe(fixture === '자뻑' ? 3 : 2);
    for (let i = 1; i < boxes.length; i++)
      expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right);
    await group.locator('.floor-card').first().click();
    const zoom = page.getByRole('dialog', { name: '바닥패 크게 보기' });
    await expect(zoom).toBeVisible();
    await expect(zoom.locator('img')).toHaveCount(boxes.length);
    await page.goBack();
    await expect(zoom).toHaveCount(0);
  }
  await page.locator('.hand-card[data-card-id="m1-2"]').click();
  const selection = page.getByRole('dialog', { name: '어떤 패를 먹을까요?' });
  await expect(selection).toBeVisible();
  const version = await page.getByTestId('game-table').getAttribute('data-version');
  await page.goBack();
  await expect(selection).toBeVisible();
  await expect(page.getByTestId('game-table')).toHaveAttribute('data-version', version!);
  await selection.locator('.floor-choices button').first().click();
  await expect(page.getByTestId('game-table')).not.toHaveAttribute('data-version', version!);
});
