import { test, expect, type Page } from "@playwright/test";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";

const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites)/, { timeout: 15_000 });
}

test("landlord can submit and admin can reject with reason", async ({ browser }) => {
  test.skip(
    !(HAS_LANDLORD && HAS_ADMIN),
    "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD and PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test."
  );

  const landlordContext = await browser.newContext();
  const landlordPage = await landlordContext.newPage();
  await login(landlordPage, LANDLORD_EMAIL, LANDLORD_PASSWORD);

  await landlordPage.goto("/dashboard/properties/new");
  await landlordPage.getByLabel("Listing title").fill(`Draft listing ${Date.now()}`);
  await landlordPage.getByLabel("City").fill("Lagos");
  await landlordPage.getByLabel("Price").fill("2500");
  await landlordPage.getByLabel("Bedrooms").fill("2");
  await landlordPage.getByLabel("Bathrooms").fill("2");
  await landlordPage.getByLabel("Furnished").check();

  await landlordPage.getByRole("button", { name: "Next" }).click();
  await expect(landlordPage.getByRole("heading", { name: /details/i })).toBeVisible();

  await landlordPage.getByLabel("Description").fill("Great home near transit with amenities.");
  await landlordPage.getByRole("button", { name: "Next" }).click();
  await landlordPage.getByRole("button", { name: "Next" }).click();
  await landlordPage.getByRole("button", { name: "Next" }).click();

  await landlordPage.getByRole("button", { name: /submit for approval/i }).click();
  await landlordPage.waitForURL(/\/dashboard/, { timeout: 15_000 });

  const ownRes = await landlordPage.request.get("/api/properties?scope=own");
  expect(ownRes.ok()).toBeTruthy();
  const ownJson = await ownRes.json();
  const newest = (ownJson?.properties || [])[0];
  const listingId = newest?.id as string | undefined;
  expect(listingId).toBeTruthy();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
  const rejectRes = await adminPage.request.patch(`/api/admin/properties/${listingId}`, {
    data: { action: "reject", reason: "Missing photos" },
  });
  expect(rejectRes.ok()).toBeTruthy();
  await adminContext.close();

  await landlordPage.goto("/dashboard");
  await expect(landlordPage.getByText(/rejection reason/i)).toBeVisible();

  await landlordContext.close();
});
