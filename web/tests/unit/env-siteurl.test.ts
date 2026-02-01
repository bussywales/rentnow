import test from "node:test";
import assert from "node:assert/strict";
import { getSiteUrl } from "@/lib/env";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

void test("getSiteUrl prioritizes SITE_URL over other env vars", async () => {
  resetEnv();
  process.env.SITE_URL = "https://prod.propatyhub.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://public.propatyhub.com";
  process.env.VERCEL_URL = "preview-123.vercel.app";
  const url = await getSiteUrl();
  assert.equal(url, "https://prod.propatyhub.com");
});

void test("getSiteUrl falls back to NEXT_PUBLIC_SITE_URL then VERCEL_URL", async () => {
  resetEnv();
  process.env.SITE_URL = "";
  process.env.NEXT_PUBLIC_SITE_URL = "https://public.propatyhub.com";
  process.env.VERCEL_URL = "preview-123.vercel.app";
  const url = await getSiteUrl();
  assert.equal(url, "https://public.propatyhub.com");

  resetEnv();
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_URL = "preview-456.vercel.app";
  const vercelUrl = await getSiteUrl();
  assert.equal(vercelUrl, "https://preview-456.vercel.app");
});

void test("getSiteUrl falls back to localhost when nothing configured", async () => {
  resetEnv();
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;
  const url = await getSiteUrl();
  assert.equal(url, "http://localhost:3000");
});
