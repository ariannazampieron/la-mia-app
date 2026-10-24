import { test, expect } from "@playwright/test";

/**
 * Auth flow E2E tests for the Email OTP login.
 *
 * A full login (requesting + verifying a real code) isn't automated here —
 * the code is sent by email (or logged server-side only when RESEND_API_KEY
 * is unset), so there is no inbox for Playwright to read it from.
 */

test.describe("Pages load correctly", () => {
  test("login page shows the email step", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Finance Tracker" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Invia codice" })).toBeVisible();
  });

  test("register and reset-password routes redirect to login", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL("/login");

    await page.goto("/forgot-password");
    await expect(page).toHaveURL("/login");

    await page.goto("/reset-password");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Auth guards", () => {
  test("unauthenticated user cannot access /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // requireAuth() redirects to "/", which itself redirects unauthenticated users to "/login"
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated user cannot access /profile", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Email OTP request", () => {
  test("requesting a code moves to the verification step", async ({ page }) => {
    await page.goto("/login");

    const email = `test-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Invia codice" }).click();

    await expect(page.getByRole("heading", { name: "Controlla la tua email" })).toBeVisible();
    await expect(page.getByLabel("Codice di verifica")).toBeVisible();
  });
});
