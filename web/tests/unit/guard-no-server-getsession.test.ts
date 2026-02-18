import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const webRoot = process.cwd();
const guardScriptPath = path.join(webRoot, "scripts", "guard-no-server-getsession.mjs");
const fixtureRoot = path.join(webRoot, "tests", "fixtures", "getsession-guard");

function runGuardForFixture(filename: string) {
  const fixturePath = path.join(fixtureRoot, filename);
  const result = spawnSync(
    process.execPath,
    [guardScriptPath, "--root", webRoot, "--paths", fixturePath],
    {
      encoding: "utf8",
      cwd: webRoot,
    }
  );
  return {
    code: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`,
  };
}

for (const fixture of [
  "server-route-destructure.ts",
  "server-route-alias.ts",
  "server-route-bracket.ts",
  "server-route-direct.ts",
] as const) {
  void test(`guard fails for ${fixture}`, () => {
    const result = runGuardForFixture(fixture);
    assert.notEqual(result.code, 0);
    assert.match(result.output, new RegExp(fixture.replace(".", "\\.")));
  });
}

void test("guard passes for client-ok.tsx", () => {
  const result = runGuardForFixture("client-ok.tsx");
  assert.equal(result.code, 0);
  assert.match(result.output, /No server-side getSession usage found\./);
});
