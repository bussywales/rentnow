import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const webRoot = process.cwd();
const guardScriptPath = path.join(webRoot, "scripts", "guard-next-image-optimisation.mjs");
const fixtureRoot = path.join(webRoot, "tests", "fixtures", "next-image-optimisation-guard");

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

void test("guard fails when next.config enables unoptimized images", () => {
  const result = runGuardForFixture("next-config-unoptimized.ts");
  assert.notEqual(result.code, 0);
  assert.match(result.output, /next-config-unoptimized\.ts/);
  assert.match(result.output, /Forbidden Next image fallback detected/);
});

void test("guard fails for raw img usage on guarded surface", () => {
  const result = runGuardForFixture("component-raw-img.tsx");
  assert.notEqual(result.code, 0);
  assert.match(result.output, /component-raw-img\.tsx/);
  assert.match(result.output, /Raw <img> detected on guarded image surface/);
});

void test("guard passes when guarded surface uses next/image", () => {
  const result = runGuardForFixture("component-next-image.tsx");
  assert.equal(result.code, 0);
  assert.match(result.output, /Next image optimisation guard passed\./);
});
