import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/i);
}

test("sale intent hides rental type and deposit section", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping listing basics refinement.");

  await login(page);
  await page.goto("/dashboard/properties/new");

  await page.getByLabel(/listing title/i).fill("Sale intent hide test");
  await page.getByLabel(/listing intent/i).selectOption("buy");

  await expect(page.locator("label:has-text(\"Rental type\")")).toHaveCount(0);

  await page.getByLabel(/city/i).fill("Lagos");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByRole("heading", { name: /property specs/i })).toBeVisible();

  await page.getByLabel(/listing type/i).selectOption("apartment");
  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByRole("heading", { name: /basics/i })).toBeVisible();

  await page.getByLabel(/bedrooms/i).fill("0");
  await page.getByLabel(/bathrooms/i).fill("0");
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(/Bedrooms must be at least 1/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /deposit & rules/i })).toHaveCount(0);
});

test("non-res listings allow 0 rooms and autosave layout stays stable", async ({ page }) => {
  test.skip(!email || !password, "E2E creds missing; skipping listing basics refinement.");

  await login(page);
  await page.goto("/dashboard/properties/new");

  const nextButton = page.getByRole("button", { name: /next/i });
  const initialBox = await nextButton.boundingBox();
  expect(initialBox).toBeTruthy();

  await page.getByLabel(/listing title/i).fill("Land listing test");
  await page.getByLabel(/city/i).fill("Lagos");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  await page.getByText(/Saving/i).waitFor();
  const savingBox = await nextButton.boundingBox();
  expect(savingBox).toBeTruthy();
  if (initialBox && savingBox) {
    expect(Math.abs(initialBox.x - savingBox.x)).toBeLessThanOrEqual(1);
  }

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByRole("heading", { name: /property specs/i })).toBeVisible();

  await page.getByLabel(/listing type/i).selectOption("land");
  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByRole("heading", { name: /basics/i })).toBeVisible();

  await expect(page.getByLabel(/bedrooms/i)).toBeVisible();
  await page.getByLabel(/bedrooms/i).fill("0");
  await page.getByLabel(/bathrooms/i).fill("0");

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByRole("heading", { name: /property specs/i })).toBeVisible();
});
