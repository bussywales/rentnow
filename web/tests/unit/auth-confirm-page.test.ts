import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("confirm page prioritizes auth-code exchange over an existing session", () => {
  const confirmPath = path.join(process.cwd(), "app", "auth", "confirm", "page.tsx");
  const contents = fs.readFileSync(confirmPath, "utf8");

  assert.match(
    contents,
    /const run = async \(\) => \{[\s\S]*if \(code\) \{[\s\S]*exchangeCodeForSession\(code\)[\s\S]*return;[\s\S]*const \{\s*data: \{ session \},\s*\} = await supabase\.auth\.getSession\(\);[\s\S]*if \(session\?\.user\) \{/,
    "incoming auth codes must be exchanged before any existing session short-circuit"
  );
  assert.ok(contents.includes("exchangeCodeForSession"));
  assert.ok(contents.includes('router.replace(redirectTarget)'));
});
