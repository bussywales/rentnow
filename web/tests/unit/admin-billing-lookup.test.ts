import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildAdminBillingLookupHref,
  findAdminAuthUserByEmail,
  findAdminAuthUserById,
  normalizeAdminBillingLookupParams,
  resolveAdminBillingLookupIdentity,
} from "../../lib/billing/admin-billing-lookup";

type AdminUser = {
  id: string;
  email?: string | null;
};

function createAdminClient(pages: AdminUser[][]) {
  return {
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
          assert.equal(perPage, 200);
          return {
            data: {
              users: pages[page - 1] ?? [],
            },
            error: null,
          };
        },
      },
    },
  };
}

void test("billing lookup scans beyond the first auth page for email matches", async () => {
  const pageOne = Array.from({ length: 200 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    email: `user-${index + 1}@example.com`,
  }));
  const target = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "paid-tenant@example.com",
  };
  const adminClient = createAdminClient([pageOne, [target]]);

  const matched = await findAdminAuthUserByEmail(adminClient as never, target.email);

  assert.deepEqual(matched, target);
});

void test("billing lookup scans beyond the first auth page for profile id matches", async () => {
  const pageOne = Array.from({ length: 200 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    email: `user-${index + 1}@example.com`,
  }));
  const target = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "recover-me@example.com",
  };
  const adminClient = createAdminClient([pageOne, [target]]);

  const matched = await findAdminAuthUserById(adminClient as never, target.id);

  assert.deepEqual(matched, target);
});

void test("billing lookup reports identity mismatches when email and profile id differ", async () => {
  const adminClient = createAdminClient([
    [
      {
        id: "33333333-3333-4333-8333-333333333333",
        email: "known@example.com",
      },
    ],
  ]);

  const result = await resolveAdminBillingLookupIdentity({
    adminClient: adminClient as never,
    email: "known@example.com",
    profileId: "44444444-4444-4444-8444-444444444444",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error, "Email and profile ID refer to different accounts.");
});

void test("billing lookup treats blank profileId query params as absent", () => {
  const normalized = normalizeAdminBillingLookupParams({
    email: "  tenant@example.com ",
    profileId: "   ",
  });

  assert.deepEqual(normalized, {
    email: "tenant@example.com",
    profileId: "",
    hasLookupInput: true,
  });
});

void test("billing identity resolution still loads from email when profileId query param is blank", async () => {
  const adminClient = createAdminClient([
    [
      {
        id: "66666666-6666-4666-8666-666666666666",
        email: "tenant@example.com",
      },
    ],
  ]);

  const result = await resolveAdminBillingLookupIdentity({
    adminClient: adminClient as never,
    email: "tenant@example.com",
    profileId: "   ",
  });

  assert.deepEqual(result, {
    ok: true,
    profileId: "66666666-6666-4666-8666-666666666666",
    email: "tenant@example.com",
  });
});

void test("billing recovery href carries profile id and email for operator-safe handoff", () => {
  const href = buildAdminBillingLookupHref({
    profileId: "55555555-5555-4555-8555-555555555555",
    email: "tenant@example.com",
  });

  assert.equal(
    href,
    "/admin/billing?profileId=55555555-5555-4555-8555-555555555555&email=tenant%40example.com"
  );
});

void test("billing recovery href omits blank params so email-only recovery stays clean", () => {
  const href = buildAdminBillingLookupHref({
    profileId: "   ",
    email: "tenant@example.com",
  });

  assert.equal(href, "/admin/billing?email=tenant%40example.com");
});

void test("admin user drawer exposes direct billing recovery entry point", () => {
  const filePath = path.join(process.cwd(), "components", "admin", "AdminUserDrawer.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Open billing recovery/);
  assert.match(source, /buildAdminBillingLookupHref/);
});
