import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home keeps host-side roles on the visual landing while redirecting tenant/admin", () => {
  const homePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(homePath, "utf8");

  assert.ok(
    contents.includes('if (role === "tenant")'),
    "expected tenant role branch"
  );
  assert.ok(
    contents.includes('redirect("/tenant/home")'),
    "expected tenant redirect to /tenant/home"
  );
  assert.ok(
    contents.includes('if (role === "admin")'),
    "expected admin role branch"
  );
  assert.ok(
    contents.includes('redirect("/admin")'),
    "expected admin redirect to /admin"
  );
  assert.ok(
    !contents.includes('redirect("/host")'),
    "expected host-side roles to stay on /home"
  );
  assert.ok(
    contents.includes("data-testid=\"home-visual-landing\""),
    "expected visual landing marker on /home"
  );
});
