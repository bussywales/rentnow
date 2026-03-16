import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property request responses migration creates response tables with privacy policies", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260316153000_property_request_responses_phase4.sql"
    ),
    "utf8"
  );

  assert.match(source, /create table if not exists public\.property_request_responses/i);
  assert.match(source, /create table if not exists public\.property_request_response_items/i);
  assert.match(source, /property_request_responses_responder_role_check/);
  assert.match(source, /property request responses owner\/admin\/responder select/i);
  assert.match(source, /property request responses responder insert/i);
  assert.match(source, /property request response items select visible parent/i);
  assert.match(source, /property request response items responder insert/i);
});
