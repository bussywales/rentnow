import test from "node:test";
import assert from "node:assert/strict";
import { resolveWwwCanonicalRedirect } from "@/lib/routing/canonical-host";

void test("host=propatyhub.com redirects to https://www.propatyhub.com with path and query preserved", () => {
  const redirect = resolveWwwCanonicalRedirect(
    new URL("https://propatyhub.com/dashboard/properties/abc?x=1"),
    "production"
  );
  assert.ok(redirect, "expected canonical redirect");
  assert.equal(
    redirect?.toString(),
    "https://www.propatyhub.com/dashboard/properties/abc?x=1"
  );
});

void test("host=www.propatyhub.com does not redirect", () => {
  const redirect = resolveWwwCanonicalRedirect(
    new URL("https://www.propatyhub.com/dashboard/properties/abc?x=1"),
    "production"
  );
  assert.equal(redirect, null);
});

void test("host=localhost does not redirect", () => {
  const redirect = resolveWwwCanonicalRedirect(
    new URL("http://localhost:3000/dashboard/properties/abc?x=1"),
    "development"
  );
  assert.equal(redirect, null);
});

void test("preview hosts are not redirected by canonical rule", () => {
  const redirect = resolveWwwCanonicalRedirect(
    new URL("https://rentnow-ashem.vercel.app/dashboard/properties/abc?x=1"),
    "production"
  );
  assert.equal(redirect, null);
});
