import test from "node:test";
import assert from "node:assert/strict";
import { resolveBackHref } from "@/lib/properties/back-href";

void test("resolveBackHref accepts encoded /shortlets back route", () => {
  const resolved = resolveBackHref(
    { back: encodeURIComponent("/shortlets?market=NG") },
    null
  );
  assert.equal(resolved, "/shortlets?market=NG");
});

void test("resolveBackHref accepts encoded /properties back route", () => {
  const resolved = resolveBackHref(
    { back: encodeURIComponent("/properties?stay=shortlet") },
    null
  );
  assert.equal(resolved, "/properties?stay=shortlet");
});

void test("resolveBackHref rejects external URL values", () => {
  assert.equal(resolveBackHref({ back: "https://evil.com" }, null), null);
  assert.equal(resolveBackHref({ back: "//evil.com/path" }, null), null);
});

void test("resolveBackHref rejects javascript and api routes", () => {
  assert.equal(resolveBackHref({ back: "javascript:alert(1)" }, null), null);
  assert.equal(resolveBackHref({ back: "/api/shortlets/search" }, null), null);
});

void test("resolveBackHref rejects empty and malformed values", () => {
  assert.equal(resolveBackHref({ back: "" }, null), null);
  assert.equal(resolveBackHref({ back: "   " }, null), null);
  assert.equal(resolveBackHref({ back: "%E0%A4%A" }, null), null);
});

void test("resolveBackHref supports referer fallback for /properties and /shortlets", () => {
  assert.equal(
    resolveBackHref(undefined, "https://www.propatyhub.com/properties?stay=shortlet"),
    "/properties?stay=shortlet"
  );
  assert.equal(
    resolveBackHref(undefined, "https://www.propatyhub.com/shortlets?where=Abuja"),
    "/shortlets?where=Abuja"
  );
});

