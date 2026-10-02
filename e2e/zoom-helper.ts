import { expect, type Page } from '@playwright/test';
export async function openHandZoom(page: Page) {
  const card = page.locator('.hand-card').first();
  await card.dispatchEvent('pointerdown');
  await expect(page.locator('dialog.zoom-modal[open]')).toBeVisible();
  await card.dispatchEvent('pointerup');
}
