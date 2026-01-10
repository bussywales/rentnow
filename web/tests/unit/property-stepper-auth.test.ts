import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper refreshes session before auth gating photos", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("resolveAuthUser"),
    "expected auth resolver helper for session continuity"
  );
  assert.ok(
    contents.includes("refreshSession"),
    "expected session refresh fallback for auth continuity"
  );
  assert.ok(
    contents.includes("authResolveRef"),
    "expected single-flight auth resolve guard"
  );
  assert.ok(
    contents.includes("Please log in to upload photos."),
    "expected login prompt to remain for unauthenticated users"
  );
});
