import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("root layout includes startup shell with env kill switch", () => {
  const filePath = path.join(process.cwd(), "app", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /NEXT_PUBLIC_SPLASH_SHELL_DISABLED !== "false"/);
  assert.match(source, /!startupShellDisabled \?/);
  assert.match(source, /id="app-startup-shell"/);
  assert.match(source, /<AppStartupShellRemover \/>/);
  assert.match(source, /STARTUP_SHELL_CRITICAL_CSS/);
});
