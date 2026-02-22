import assert from "node:assert/strict";
import test from "node:test";
import { resolveSessionUserFromSupabase } from "@/lib/auth";
import { shouldLogAuthzDeny } from "@/lib/authz";

void test("guest session resolution is silent in production for expected auth-miss paths", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDebugAuthNoise = process.env.DEBUG_AUTH_NOISE;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;

  let warnCount = 0;
  let infoCount = 0;
  process.env.NODE_ENV = "production";
  delete process.env.DEBUG_AUTH_NOISE;
  console.warn = () => {
    warnCount += 1;
  };
  console.info = () => {
    infoCount += 1;
  };

  try {
    const user = await resolveSessionUserFromSupabase({
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "Auth session missing!" },
        }),
        refreshSession: async () => ({
          data: { session: null },
          error: { message: "Auth session missing!" },
        }),
      },
    });

    assert.equal(user, null);
    assert.equal(warnCount, 0);
    assert.equal(infoCount, 0);
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDebugAuthNoise === undefined) {
      delete process.env.DEBUG_AUTH_NOISE;
    } else {
      process.env.DEBUG_AUTH_NOISE = originalDebugAuthNoise;
    }
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
  }
});

void test("authz deny logger suppresses expected 401 guest misses in production only", () => {
  assert.equal(
    shouldLogAuthzDeny({
      status: 401,
      reason: "missing_user",
      nodeEnv: "production",
      debugAuthNoise: "",
    }),
    false
  );
  assert.equal(
    shouldLogAuthzDeny({
      status: 401,
      reason: "missing_user",
      nodeEnv: "test",
      debugAuthNoise: "",
    }),
    true
  );
  assert.equal(
    shouldLogAuthzDeny({
      status: 403,
      reason: "role_forbidden",
      nodeEnv: "production",
      debugAuthNoise: "",
    }),
    true
  );
  assert.equal(
    shouldLogAuthzDeny({
      status: 401,
      reason: "missing_user",
      nodeEnv: "production",
      debugAuthNoise: "1",
    }),
    true
  );
});

