import { test, expect } from '@playwright/test';

test('mobile single play never uses the saved friend name and friend form stays simple', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('toki.nickname.v1'))
      localStorage.setItem('toki.nickname.v1', '배포완료B');
  });
  await page.setViewportSize({ width: 378, height: 672 });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.locator('.player-info').last().locator('.player-name')).toHaveText(
    /^나(?:선)?0승$/,
  );
  await expect(page.getByTestId('game-table')).not.toContainText('배포완료B');
  await page.getByRole('button', { name: '나가기', exact: true }).click();
  await page
    .getByRole('dialog', { name: '대기실로 돌아갈까요?' })
    .getByRole('button', { name: '대기실로', exact: true })
    .click();
  await page.getByRole('button', { name: /친구와 치기/ }).click();
  await expect(page.getByLabel('내 이름', { exact: true })).toHaveValue('배포완료B');
  await expect(page.getByPlaceholder('내 이름을 넣어주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '방 만들기', exact: true })).toBeVisible();
  const join = page.getByRole('button', { name: '참여하기', exact: true });
  await expect(join).toBeVisible();
  await expect(join).toBeDisabled();
  await expect(page.getByText('참여할 내 이름을 위에 적어주세요.')).toBeVisible();
  await expect(page.getByText(/이름을 비우면/)).toHaveCount(0);
  await page.getByLabel('내 이름', { exact: true }).fill('민수');
  await page.getByLabel('방 코드', { exact: true }).fill('0123');
  await expect(join).toBeEnabled();
  expect(await join.evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(672);
  await page.screenshot({ path: '/tmp/toki-friend-form.png' });
  await page.getByRole('button', { name: '홈으로', exact: true }).click();
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.locator('.player-info').last().locator('.player-name')).toHaveText(
    /^나(?:선)?0승$/,
  );
  await expect(page.getByTestId('game-table')).not.toContainText('민수');
  await page.reload();
  await page.getByRole('button', { name: /혼자 치기/ }).click();
  await expect(page.locator('.player-info').last().locator('.player-name')).toHaveText(
    /^나(?:선)?0승$/,
  );
  expect(await page.evaluate(() => localStorage.getItem('toki.nickname.v1'))).toBe('민수');
});
