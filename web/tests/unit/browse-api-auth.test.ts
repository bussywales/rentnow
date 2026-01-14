import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("browse API fetch forwards cookies when available", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("await cookies()"),
    "expected browse page to build cookie header"
  );
  assert.ok(
    contents.includes("headers: cookieHeader ? { cookie: cookieHeader }"),
    "expected browse page to forward cookie header"
  );
  assert.ok(
    contents.includes("cache: \"no-store\""),
    "expected authed browse fetch to bypass cache"
  );
});
