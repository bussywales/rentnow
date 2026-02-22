import test from "node:test";
import assert from "node:assert/strict";
import {
  isExpectedMissingSessionErrorMessage,
  resolveSessionUserFromSupabase,
} from "@/lib/auth";

void test("isExpectedMissingSessionErrorMessage matches expected auth-noise text", () => {
  assert.equal(isExpectedMissingSessionErrorMessage("Auth session missing!"), true);
  assert.equal(
    isExpectedMissingSessionErrorMessage("invalid refresh token: token expired"),
    true
  );
  assert.equal(
    isExpectedMissingSessionErrorMessage("permission denied for relation profiles"),
    false
  );
});

void test("resolveSessionUserFromSupabase does not log errors for expected missing-session guest path", async () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const errorLogs: string[] = [];
  const warnLogs: string[] = [];
  console.error = (...args: unknown[]) => {
    errorLogs.push(String(args[0] || ""));
  };
  console.warn = (...args: unknown[]) => {
    warnLogs.push(String(args[0] || ""));
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
    assert.equal(errorLogs.length, 0);
    assert.equal(warnLogs.length, 0);
  } finally {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});

void test("resolveSessionUserFromSupabase keeps unexpected auth failures quiet in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.DEBUG_AUTH_NOISE;
  process.env.NODE_ENV = "production";

  const originalConsoleWarn = console.warn;
  const warnLogs: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnLogs.push(String(args[0] || ""));
  };

  try {
    const user = await resolveSessionUserFromSupabase({
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "network timeout" },
        }),
        refreshSession: async () => ({
          data: { session: null },
          error: null,
        }),
      },
    });

    assert.equal(user, null);
    assert.equal(warnLogs.length, 0);
  } finally {
    console.warn = originalConsoleWarn;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

void test("resolveSessionUserFromSupabase emits diagnostics when DEBUG_AUTH_NOISE=1", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDebugNoise = process.env.DEBUG_AUTH_NOISE;
  process.env.NODE_ENV = "production";
  process.env.DEBUG_AUTH_NOISE = "1";

  const originalConsoleWarn = console.warn;
  const warnLogs: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnLogs.push(String(args[0] || ""));
  };

  try {
    const user = await resolveSessionUserFromSupabase({
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "network timeout" },
        }),
        refreshSession: async () => ({
          data: { session: null },
          error: null,
        }),
      },
    });

    assert.equal(user, null);
    assert.equal(warnLogs.some((entry) => entry.includes("[auth] getUser failed")), true);
  } finally {
    console.warn = originalConsoleWarn;
    process.env.NODE_ENV = previousNodeEnv;
    if (typeof previousDebugNoise === "undefined") {
      delete process.env.DEBUG_AUTH_NOISE;
    } else {
      process.env.DEBUG_AUTH_NOISE = previousDebugNoise;
    }
  }
});
