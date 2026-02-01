import test from "node:test";
import assert from "node:assert/strict";
import { getServerAuthCookieDefaults } from "@/lib/auth/server-cookie";

const ORIGINAL_ENV = { ...process.env };

function withEnv(env: Partial<NodeJS.ProcessEnv>) {
  process.env = { ...ORIGINAL_ENV, ...env };
}

void test("cookie domain only set for production + propatyhub.com host", () => {
  withEnv({ NODE_ENV: "production" });
  const prodDefaults = getServerAuthCookieDefaults({
    headers: new Headers({ host: "app.propatyhub.com" }),
  } as unknown as import("next/server").NextRequest);
  assert.equal(prodDefaults.domain, ".propatyhub.com");

  const rentnowDefaults = getServerAuthCookieDefaults({
    headers: new Headers({ host: "rentnow.space" }),
  } as unknown as import("next/server").NextRequest);
  assert.equal(rentnowDefaults.domain, undefined);

  withEnv({ NODE_ENV: "development" });
  const devDefaults = getServerAuthCookieDefaults({
    headers: new Headers({ host: "app.propatyhub.com" }),
  } as unknown as import("next/server").NextRequest);
  assert.equal(devDefaults.domain, undefined);
});
