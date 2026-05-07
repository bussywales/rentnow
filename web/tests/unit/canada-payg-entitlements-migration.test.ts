import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

void test("Canada listing PAYG entitlements migration creates the listing-scoped extra-slot table with guardrails", () => {
  const sql = read("supabase/migrations/20260507103000_canada_listing_payg_entitlements_v1.sql");

  assert.match(sql, /create table if not exists public\.canada_listing_payg_entitlements/i);
  assert.match(sql, /listing_id uuid not null references public\.properties/i);
  assert.match(sql, /owner_id uuid not null references public\.profiles/i);
  assert.match(sql, /market_country text not null default 'CA'/i);
  assert.match(sql, /provider text not null default 'stripe'/i);
  assert.match(sql, /purpose text not null default 'listing_submission'/i);
  assert.match(sql, /currency text not null default 'CAD'/i);
  assert.match(sql, /idempotency_key text not null/i);
  assert.match(sql, /status text not null/i);
  assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);

  assert.match(sql, /market_country = 'CA'/i);
  assert.match(sql, /provider = 'stripe'/i);
  assert.match(sql, /purpose = 'listing_submission'/i);
  assert.match(sql, /currency = 'CAD'/i);
  assert.match(sql, /role in \('landlord', 'agent'\)/i);
  assert.match(sql, /tier in \('free', 'pro'\)/i);
  assert.match(sql, /role = 'agent' and tier in \('free', 'pro'\)/i);
  assert.doesNotMatch(sql, /enterprise/i);
  assert.match(sql, /status in \('granted', 'consumed', 'revoked', 'expired'\)/i);

  assert.match(sql, /unique index if not exists idx_canada_listing_payg_entitlements_idempotency_key/i);
  assert.match(sql, /unique index if not exists idx_canada_listing_payg_entitlements_checkout_session/i);
  assert.match(sql, /unique index if not exists idx_canada_listing_payg_entitlements_payment_intent/i);
  assert.match(sql, /unique index if not exists idx_canada_listing_payg_entitlements_event_id/i);
  assert.match(sql, /unique index if not exists idx_canada_listing_payg_entitlements_listing_active_granted/i);

  assert.match(sql, /alter table public\.canada_listing_payg_entitlements enable row level security;/i);
  assert.match(sql, /alter table public\.canada_listing_payg_entitlements force row level security;/i);
  assert.match(sql, /create policy "canada listing payg entitlements admin select"/i);
  assert.match(sql, /create policy "canada listing payg entitlements service write"/i);
  assert.match(sql, /create policy "canada listing payg entitlements admin write"/i);
});

void test("Canada listing PAYG entitlements policies are mirrored in the consolidated RLS policy file", () => {
  const rlsPolicies = read("supabase/rls_policies.sql");

  assert.match(rlsPolicies, /ALTER TABLE public\.canada_listing_payg_entitlements ENABLE ROW LEVEL SECURITY;/);
  assert.match(rlsPolicies, /ALTER TABLE public\.canada_listing_payg_entitlements FORCE ROW LEVEL SECURITY;/);
  assert.match(rlsPolicies, /CREATE POLICY "canada listing payg entitlements admin select"/);
  assert.match(rlsPolicies, /CREATE POLICY "canada listing payg entitlements service write"/);
  assert.match(rlsPolicies, /CREATE POLICY "canada listing payg entitlements admin write"/);
});
