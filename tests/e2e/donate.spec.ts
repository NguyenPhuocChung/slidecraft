import { test, expect } from '@playwright/test';

test('donate button shows the QR code and account (header + editor)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('slidecraft.lang', 'vi'));
  await page.goto('/dashboard');
  await page.getByTestId('donate-button').first().click();
  const dlg = page.getByTestId('donate-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Ủng hộ SlideCraft');
  await expect(dlg).toContainText('7411034915');
  const ok = await page.getByTestId('donate-qr').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(ok).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});
