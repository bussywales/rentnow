import { test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent, resolveIntent } from "@/lib/search-intent";

test("parseIntent normalizes supported values", () => {
  assert.equal(parseIntent("rent"), "rent");
  assert.equal(parseIntent("buy"), "buy");
  assert.equal(parseIntent("all"), "all");
  assert.equal(parseIntent(" RENT "), "rent");
  assert.equal(parseIntent("BUY"), "buy");
  assert.equal(parseIntent("invalid"), undefined);
  assert.equal(parseIntent(null), undefined);
});

test("resolveIntent honors precedence url > cookie > local > default", () => {
  assert.equal(
    resolveIntent({
      urlIntent: "buy",
      cookieIntent: "rent",
      localIntent: "all",
      defaultIntent: "rent",
    }),
    "buy"
  );

  assert.equal(
    resolveIntent({
      cookieIntent: "all",
      localIntent: "buy",
      defaultIntent: "rent",
    }),
    "all"
  );

  assert.equal(
    resolveIntent({
      localIntent: "buy",
      defaultIntent: "rent",
    }),
    "buy"
  );

  assert.equal(
    resolveIntent({
      defaultIntent: "rent",
    }),
    "rent"
  );
});
