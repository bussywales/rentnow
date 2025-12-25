import { test, expect, type Page } from "@playwright/test";

const TENANT_EMAIL = process.env.PLAYWRIGHT_USER_EMAIL || "";
const TENANT_PASSWORD = process.env.PLAYWRIGHT_USER_PASSWORD || "";
const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";

const HAS_TENANT = !!TENANT_EMAIL && !!TENANT_PASSWORD;
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;
const HAS_ADMIN = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(dashboard|favourites)/, { timeout: 15_000 });
}

test.describe("Access control", () => {
  test("tenant cannot edit or delete landlord property", async ({ browser }) => {
    test.skip(
      !(HAS_TENANT && HAS_LANDLORD),
      "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test."
    );

    const landlordContext = await browser.newContext();
    const landlordPage = await landlordContext.newPage();
    await login(landlordPage, LANDLORD_EMAIL, LANDLORD_PASSWORD);

    const propsRes = await landlordPage.request.get("/api/properties?scope=own");
    expect(propsRes.ok()).toBeTruthy();
    const propsJson = await propsRes.json();
    const landlordPropertyId = propsJson?.properties?.[0]?.id as string | undefined;

    if (!landlordPropertyId) {
      test.skip(true, "No landlord properties found for access check.");
      await landlordContext.close();
      return;
    }

    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();
    await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD);

    const deleteRes = await tenantPage.request.delete(
      `/api/properties/${landlordPropertyId}`
    );
    expect(deleteRes.status()).toBe(403);

    await tenantPage.goto(`/dashboard/properties/${landlordPropertyId}`);
    await expect(tenantPage.getByText(/listing not found/i)).toBeVisible();

    await landlordContext.close();
    await tenantContext.close();
  });

  test("unpublished property hidden from public/tenant but visible to landlord/admin", async ({ browser }) => {
    test.skip(
      !(HAS_TENANT && HAS_LANDLORD && HAS_ADMIN),
      "Set PLAYWRIGHT_USER_EMAIL/PASSWORD, PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD, and PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test."
    );

    const landlordContext = await browser.newContext();
    const landlordPage = await landlordContext.newPage();
    await login(landlordPage, LANDLORD_EMAIL, LANDLORD_PASSWORD);

    const propsRes = await landlordPage.request.get("/api/properties?scope=own");
    expect(propsRes.ok()).toBeTruthy();
    const propsJson = await propsRes.json();
    const unpublished = (propsJson?.properties || []).find(
      (property: { is_approved?: boolean; is_active?: boolean }) =>
        property?.is_approved !== true || property?.is_active !== true
    ) as { id?: string } | undefined;

    const unpublishedId = unpublished?.id;
    if (!unpublishedId) {
      test.skip(true, "No unpublished landlord property found for visibility check.");
      await landlordContext.close();
      return;
    }

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/properties/${unpublishedId}`);
    await expect(publicPage.getByText(/listing not found/i)).toBeVisible();

    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();
    await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD);
    await tenantPage.goto(`/properties/${unpublishedId}`);
    await expect(tenantPage.getByText(/listing not found/i)).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminRes = await adminPage.request.get(`/api/properties/${unpublishedId}`);
    expect(adminRes.ok()).toBeTruthy();

    await landlordContext.close();
    await tenantContext.close();
    await adminContext.close();
    await publicContext.close();
  });

  test("tenant cannot read other tenants' viewings or messages by guessing IDs", async ({ browser }) => {
    test.skip(
      !(HAS_TENANT && HAS_ADMIN),
      "Set PLAYWRIGHT_USER_EMAIL/PASSWORD and PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run this test."
    );

    const tenantContext = await browser.newContext();
    const tenantPage = await tenantContext.newPage();
    await login(tenantPage, TENANT_EMAIL, TENANT_PASSWORD);
    const sessionRes = await tenantPage.request.get("/api/debug/session");
    const sessionJson = await sessionRes.json();
    const tenantId = sessionJson?.user?.id as string | undefined;

    if (!tenantId) {
      test.skip(true, "Unable to resolve tenant id for isolation check.");
      await tenantContext.close();
      return;
    }

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    const adminPropsRes = await adminPage.request.get("/api/properties?scope=own");
    expect(adminPropsRes.ok()).toBeTruthy();
    const adminPropsJson = await adminPropsRes.json();
    const properties = (adminPropsJson?.properties || []) as Array<{ id: string }>;

    let messagePropertyId: string | null = null;
    let viewingPropertyId: string | null = null;

    for (const property of properties.slice(0, 15)) {
      const msgRes = await adminPage.request.get(
        `/api/messages?propertyId=${property.id}`
      );
      if (msgRes.ok()) {
        const msgJson = await msgRes.json();
        const messages = (msgJson?.messages || []) as Array<{
          sender_id: string;
          recipient_id: string;
        }>;
        if (
          messages.length > 0 &&
          messages.every(
            (msg) => msg.sender_id !== tenantId && msg.recipient_id !== tenantId
          )
        ) {
          messagePropertyId = property.id;
        }
      }

      const viewRes = await adminPage.request.get(
        `/api/viewings?property_id=${property.id}`
      );
      if (viewRes.ok()) {
        const viewJson = await viewRes.json();
        const viewings = (viewJson?.viewings || []) as Array<{ tenant_id: string }>;
        if (
          viewings.length > 0 &&
          viewings.every((viewing) => viewing.tenant_id !== tenantId)
        ) {
          viewingPropertyId = property.id;
        }
      }

      if (messagePropertyId && viewingPropertyId) break;
    }

    if (!messagePropertyId && !viewingPropertyId) {
      test.skip(true, "No other-tenant messages/viewings found to validate isolation.");
      await tenantContext.close();
      await adminContext.close();
      return;
    }

    if (messagePropertyId) {
      const tenantMsgRes = await tenantPage.request.get(
        `/api/messages?propertyId=${messagePropertyId}`
      );
      expect(tenantMsgRes.ok()).toBeTruthy();
      const tenantMsgs = await tenantMsgRes.json();
      expect(tenantMsgs?.messages || []).toHaveLength(0);
    }

    if (viewingPropertyId) {
      const tenantViewRes = await tenantPage.request.get(
        `/api/viewings?property_id=${viewingPropertyId}`
      );
      expect(tenantViewRes.ok()).toBeTruthy();
      const tenantViews = await tenantViewRes.json();
      expect(tenantViews?.viewings || []).toHaveLength(0);
    }

    await tenantContext.close();
    await adminContext.close();
  });
});
