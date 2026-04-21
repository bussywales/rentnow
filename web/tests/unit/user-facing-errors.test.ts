import test from "node:test";
import assert from "node:assert/strict";

import {
  isInternalInfrastructureError,
  sanitizeUserFacingErrorMessage,
} from "@/lib/observability/user-facing-errors";

void test("detects schema and postgrest infrastructure errors", () => {
  assert.equal(
    isInternalInfrastructureError(
      'Could not find the "commercial_layout_type" column of "properties" in the schema cache'
    ),
    true
  );
  assert.equal(isInternalInfrastructureError("PGRST204 failed to parse select parameter"), true);
});

void test("sanitizes technical backend messages but preserves user-safe copy", () => {
  assert.equal(
    sanitizeUserFacingErrorMessage(
      'column "commercial_layout_type" does not exist',
      "Fallback copy"
    ),
    "Fallback copy"
  );
  assert.equal(
    sanitizeUserFacingErrorMessage("Please complete the highlighted fields.", "Fallback copy"),
    "Please complete the highlighted fields."
  );
});
