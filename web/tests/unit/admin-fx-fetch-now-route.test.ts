import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postAdminFxFetchNowResponse,
  resetAdminFxFetchNowRateLimitForTests,
  resolveFxFetchNowBaseUrl,
  type AdminFxFetchNowDeps,
} from "@/app/api/admin/fx/fetch-now/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/fx/fetch-now", { method: "POST" });
}

void test("admin fx fetch-now preserves auth failures", async () => {
  const deps: AdminFxFetchNowDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminFxFetchNowDeps["requireRole"]>>,
    now: () => new Date("2026-02-25T12:00:00.000Z"),
    getCronSecret: () => "cron-secret",
    getAppUrl: () => "https://www.propatyhub.com",
    getPublicSiteUrl: () => "",
    getSiteUrl: () => "",
    doFetch: async () => {
      throw new Error("should not run");
    },
  };

  const response = await postAdminFxFetchNowResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("admin fx fetch-now calls internal route with server-side cron secret", async () => {
  resetAdminFxFetchNowRateLimitForTests();
  let capturedUrl = "";
  let capturedSecret = "";
  const deps: AdminFxFetchNowDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminFxFetchNowDeps["requireRole"]>>,
    now: () => new Date("2026-02-25T12:00:00.000Z"),
    getCronSecret: () => "cron-secret",
    getAppUrl: () => "https://www.propatyhub.com",
    getPublicSiteUrl: () => "",
    getSiteUrl: () => "",
    doFetch: async (input, init) => {
      capturedUrl = String(input);
      capturedSecret = new Headers(init?.headers).get("x-cron-secret") ?? "";
      return NextResponse.json({
        ok: true,
        fetchedAt: "2026-02-25T02:15:00.000Z",
        date: "2026-02-25",
        baseCurrency: "USD",
        currenciesCount: 3,
        source: "fixture",
      });
    },
  };

  const response = await postAdminFxFetchNowResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(capturedUrl, "https://www.propatyhub.com/api/internal/fx/fetch-daily");
  assert.equal(capturedSecret, "cron-secret");
  assert.equal(body.ok, true);
  assert.equal(body.base, "USD");
  assert.equal(body.count, 3);
  assert.equal(body.provider, "fixture");
});

void test("admin fx fetch-now rate limits repeated requests per admin", async () => {
  resetAdminFxFetchNowRateLimitForTests();
  const deps: AdminFxFetchNowDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-rate-limit" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminFxFetchNowDeps["requireRole"]>>,
    now: () => new Date("2026-02-25T12:00:00.000Z"),
    getCronSecret: () => "cron-secret",
    getAppUrl: () => "https://www.propatyhub.com",
    getPublicSiteUrl: () => "",
    getSiteUrl: () => "",
    doFetch: async () =>
      NextResponse.json({
        ok: true,
        fetchedAt: "2026-02-25T02:15:00.000Z",
        date: "2026-02-25",
        baseCurrency: "USD",
        currenciesCount: 3,
        source: "fixture",
      }),
  };

  const first = await postAdminFxFetchNowResponse(makeRequest(), deps);
  const second = await postAdminFxFetchNowResponse(makeRequest(), deps);
  const secondBody = await second.json();

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.equal(secondBody.ok, false);
  assert.equal(typeof secondBody.retryAfterSeconds, "number");
});

void test("admin fx fetch-now base url resolver prefers APP_URL then public site", () => {
  const baseFromAppUrl = resolveFxFetchNowBaseUrl({
    getAppUrl: () => "www.example.com",
    getPublicSiteUrl: () => "https://ignored.example.com",
    getSiteUrl: () => "https://ignored2.example.com",
  });
  assert.equal(baseFromAppUrl, "https://www.example.com");

  const baseFromPublic = resolveFxFetchNowBaseUrl({
    getAppUrl: () => "",
    getPublicSiteUrl: () => "https://public.example.com",
    getSiteUrl: () => "",
  });
  assert.equal(baseFromPublic, "https://public.example.com");
});
