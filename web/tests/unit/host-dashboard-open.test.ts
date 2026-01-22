import test from "node:test";
import assert from "node:assert/strict";
import { openListings } from "@/lib/host/bulk-triage";

void test("openListings opens all urls and reports opened count", () => {
  const calls: Array<{ url: string; target?: string | null; features?: string | null }> = [];
  const opener = (url: string, target?: string, features?: string) => {
    calls.push({ url, target, features });
    return {} as Window;
  };
  const { opened, blocked } = openListings(["a", "b"], opener);
  assert.equal(opened, 2);
  assert.equal(blocked, 0);
  assert.deepEqual(
    calls.map((c) => [c.url, c.target, c.features]),
    [
      ["a", "_blank", "noopener,noreferrer"],
      ["b", "_blank", "noopener,noreferrer"],
    ]
  );
});

void test("openListings counts blocked popups", () => {
  const opener = (url: string) => {
    return url === "block" ? null : ({} as Window);
  };
  const { opened, blocked } = openListings(["ok", "block", "ok2"], opener);
  assert.equal(opened, 2);
  assert.equal(blocked, 1);
});
