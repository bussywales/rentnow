import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("confirm page restores hash-token sessions and prioritizes auth-code exchange over an existing session", () => {
  const confirmPath = path.join(process.cwd(), "app", "auth", "confirm", "page.tsx");
  const contents = fs.readFileSync(confirmPath, "utf8");

  assert.ok(contents.includes("const parseHashTokens = () => {"));
  assert.ok(contents.includes("await supabase.auth.setSession({"));
  assert.ok(contents.includes("window.history.replaceState"));
  assert.match(
    contents,
    /const run = async \(\) => \{[\s\S]*const hashTokens = parseHashTokens\(\);[\s\S]*await supabase\.auth\.setSession\(\{[\s\S]*if \(code\) \{[\s\S]*exchangeCodeForSession\(code\)[\s\S]*return;[\s\S]*const \{\s*data: \{ session \},\s*\} = await supabase\.auth\.getSession\(\);[\s\S]*if \(session\?\.user\) \{/,
    "hash-token sessions and incoming auth codes must both be applied before any existing session short-circuit"
  );
  assert.ok(contents.includes("exchangeCodeForSession"));
  assert.ok(contents.includes('router.replace(redirectTarget)'));
});
