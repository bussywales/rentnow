import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("reporting views migration creates the minimum reporting schema and views from real analytics columns", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260407170000_reporting_views.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /create schema if not exists reporting/);
  assert.match(sql, /create or replace view reporting\.checkout_funnel_daily as/);
  assert.match(sql, /create or replace view reporting\.paid_host_activation_daily as/);
  assert.match(sql, /create or replace view reporting\.campaign_conversion_daily as/);
  assert.match(sql, /created_at at time zone 'utc'/);
  assert.match(sql, /user_role/);
  assert.match(sql, /utm_source/);
  assert.match(sql, /utm_medium/);
  assert.match(sql, /utm_campaign/);
  assert.match(sql, /utm_content/);
  assert.match(sql, /landing_path/);
  assert.doesNotMatch(sql, /occurred_at/);
  assert.doesNotMatch(sql, /session_id/);
  assert.doesNotMatch(sql, /\brole\b =/);
});

void test("paid host activation view is explicit about first successful host checkout and post-payment listing events", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260407170000_reporting_views.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /with first_paid_host_checkout as/);
  assert.match(sql, /where pae\.event_name = 'checkout_succeeded'/);
  assert.match(sql, /pae\.user_role in \('landlord', 'agent'\)/);
  assert.match(sql, /listing_created/);
  assert.match(sql, /listing_submitted_for_review/);
  assert.match(sql, /listing_published_live/);
  assert.match(sql, /created_within_7d_count/);
  assert.match(sql, /live_within_14d_count/);
});
