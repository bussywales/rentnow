import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper photo previews bypass Next optimizer for Supabase URLs", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes('import { shouldBypassNextImageOptimizer } from "@/lib/images/optimizer-bypass";'),
    "expected PropertyStepper to import optimizer bypass helper"
  );
  assert.ok(
    contents.includes("unoptimized={shouldBypassNextImageOptimizer(recommended.url)}"),
    "expected recommended cover preview to bypass optimizer for Supabase URLs"
  );
  assert.ok(
    contents.includes("unoptimized={shouldBypassNextImageOptimizer(url)}"),
    "expected gallery previews to bypass optimizer for Supabase URLs"
  );
});
