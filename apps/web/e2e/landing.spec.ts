import { test, expect } from '@playwright/test';

test('landing page renders hero CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /lista de presentes de casamento/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /come\u00e7ar gr\u00e1tis/i })).toBeVisible();
});

test('login page form is reachable', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/e-mail/i)).toBeVisible();
  await expect(page.getByLabel(/senha/i)).toBeVisible();
});

test('registration form has username slug field', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByLabel(/nome \(do casal\)/i)).toBeVisible();
  await expect(page.getByLabel(/url p\u00fablica/i)).toBeVisible();
});
