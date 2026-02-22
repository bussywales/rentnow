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

void test("resolveSessionUserFromSupabase still logs unexpected auth failures", async () => {
  const originalConsoleError = console.error;
  const errorLogs: string[] = [];
  console.error = (...args: unknown[]) => {
    errorLogs.push(String(args[0] || ""));
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
    assert.equal(errorLogs.includes("Error fetching session user"), true);
  } finally {
    console.error = originalConsoleError;
  }
});
