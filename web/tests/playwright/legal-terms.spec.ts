import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE_ENV } from "./helpers/env";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const tenantEmail = process.env.PLAYWRIGHT_USER_EMAIL || "";
const tenantPassword = process.env.PLAYWRIGHT_USER_PASSWORD || "";

const HAS_ADMIN = !!adminEmail && !!adminPassword;
const HAS_TENANT = !!tenantEmail && !!tenantPassword;

let adminClient: SupabaseClient | null = null;
let setupError: string | null = null;
let tenantId: string | null = null;
let originalDocs: Array<{ id: string; status: string; published_at: string | null }> = [];

const audiences = ["MASTER", "TENANT", "LANDLORD_AGENT", "ADMIN_OPS", "AUP"];

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard|\/tenant|\/host|\/admin/, { timeout: 15_000 });
}

test.describe.serial("Legal terms management", () => {
  test.beforeAll(async () => {
    if (!HAS_SUPABASE_ENV || !serviceRoleKey || !HAS_TENANT) return;

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tenantResult = await adminClient.auth.admin.getUserByEmail(tenantEmail);
    tenantId = tenantResult.data?.user?.id ?? null;
    if (!tenantId) {
      setupError = "Unable to resolve tenant user id.";
      return;
    }

    const { data: docs, error } = await adminClient
      .from("legal_documents")
      .select("id, audience, status, published_at, version")
      .eq("jurisdiction", "NG")
      .in("audience", audiences)
      .order("version", { ascending: false });

    if (error || !docs) {
      setupError = error?.message || "Unable to fetch legal documents.";
      return;
    }

    const latestByAudience = new Map<string, { id: string; status: string; published_at: string | null }>();
    docs.forEach((doc) => {
      if (!latestByAudience.has(doc.audience)) {
        latestByAudience.set(doc.audience, doc);
      }
    });

    originalDocs = Array.from(latestByAudience.values());

    await adminClient
      .from("legal_documents")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
      })
      .in(
        "id",
        originalDocs.map((doc) => doc.id)
      );

    await adminClient
      .from("legal_acceptances")
      .delete()
      .eq("user_id", tenantId)
      .eq("jurisdiction", "NG");
  });

  test.afterAll(async () => {
    if (!adminClient) return;

    if (originalDocs.length > 0) {
      await Promise.all(
        originalDocs.map((doc) =>
          adminClient
            .from("legal_documents")
            .update({ status: doc.status, published_at: doc.published_at })
            .eq("id", doc.id)
        )
      );
    }

    if (tenantId) {
      await adminClient
        .from("legal_acceptances")
        .delete()
        .eq("user_id", tenantId)
        .eq("jurisdiction", "NG");
    }
  });

  test("admin can view legal admin page", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping legal admin test.");
    test.skip(!HAS_ADMIN, "Admin credentials missing; skipping legal admin test.");

    await login(page, adminEmail, adminPassword);
    await page.goto("/admin/legal");
    await expect(page.getByText(/legal documents/i)).toBeVisible();
    await expect(page.getByText(/master terms/i)).toBeVisible();
  });

  test("non-admin cannot read draft-only documents", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping legal access test.");
    test.skip(!HAS_TENANT, "Tenant credentials missing; skipping legal access test.");

    await login(page, tenantEmail, tenantPassword);
    const response = await page.request.get("/api/legal/documents?jurisdiction=NG");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const docs = Array.isArray(body?.documents) ? body.documents : [];
    const hasDraft = docs.some((doc: { status?: string }) => doc.status === "draft");
    expect(hasDraft).toBeFalsy();
  });

  test("acceptance gate redirects and returns to original route", async ({ page }) => {
    test.skip(!HAS_SUPABASE_ENV, "Supabase env vars missing; skipping acceptance gate test.");
    test.skip(!HAS_TENANT, "Tenant credentials missing; skipping acceptance gate test.");
    test.skip(!!setupError, setupError || "Setup failed.");

    await login(page, tenantEmail, tenantPassword);
    await page.goto("/tenant");
    await page.waitForURL(/\/legal\/accept/, { timeout: 15_000 });
    await expect(page.getByText(/review terms/i)).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /i agree/i }).click();
    await page.waitForURL(/\/tenant/, { timeout: 15_000 });
  });
});
