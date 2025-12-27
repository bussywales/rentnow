import { test, expect, type Page } from "@playwright/test";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";

const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites)/, { timeout: 15_000 });
}

test("landlord can edit a property via dashboard autosave", async ({ page }) => {
  test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping property edit test.");
  test.skip(
    !HAS_LANDLORD,
    "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run the property edit test."
  );

  await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);

  const ownRes = await page.request.get("/api/properties?scope=own");
  if (!ownRes.ok()) {
    test.skip(true, "Unable to load landlord properties for edit test.");
  }
  const ownJson = await ownRes.json();
  const propertyId = ownJson?.properties?.[0]?.id as string | undefined;
  if (!propertyId) {
    test.skip(true, "No landlord properties available to edit.");
  }

  await page.goto(`/dashboard/properties/${propertyId}`);
  const titleInput = page.getByLabel("Listing title");
  await expect(titleInput).toBeVisible();

  const updatedTitle = `Updated listing ${Date.now()}`;
  const updateResponsePromise = page.waitForResponse((response) => {
    if (!response.url().includes(`/api/properties/${propertyId}`)) return false;
    if (response.request().method() !== "PUT") return false;
    const payload = response.request().postData() || "";
    return payload.includes(updatedTitle);
  });

  await titleInput.fill(updatedTitle);
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByLabel("Listing title")).toHaveValue(updatedTitle);
});
