import { test, expect } from '@playwright/test';

// Fluxo e2e: cadastro → dashboard → logout. Com `pnpm dev` na raiz sobe só o Next (API incluída).
test('signup → dashboard → logout', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const username = `e2e${stamp.toString().slice(-6)}`;

  await page.goto('/register');
  await page.getByLabel(/nome \(do casal\)/i).fill('Casal E2E');
  await page.getByLabel(/url p\u00fablica/i).fill(username);
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/senha/i).fill('senha-forte-e2e-123');
  await page.getByRole('button', { name: /criar minha lista/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /casal e2e/i })).toBeVisible();

  await page.getByRole('button', { name: /sair/i }).click();
  await expect(page).toHaveURL(/\/login/);
});
