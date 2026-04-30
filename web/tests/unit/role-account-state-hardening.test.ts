import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) => fs.readFileSync(path.join(root, ...segments), "utf8");

void test("onboarding role picker is first-time only and does not advertise self-service role switching", () => {
  const page = read("app", "onboarding", "page.tsx");
  const client = read("components", "onboarding", "OnboardingRoleClient.tsx");

  assert.match(page, /if \(user && role\) \{\s*redirect\(resolvePostLoginRedirect\(\{ role \}\)\);\s*\}/s);
  assert.match(client, /This sets your account role\. If you need to change it later, contact support\./);
  assert.doesNotMatch(client, /You can change this later in your profile/);
});

void test("role-specific onboarding pages reject cross-role transitions", () => {
  const agentPage = read("app", "onboarding", "agent", "page.tsx");
  const landlordPage = read("app", "onboarding", "landlord", "page.tsx");

  assert.match(agentPage, /if \(role !== "agent"\) \{\s*redirect\(resolvePostLoginRedirect\(\{ role \}\)\);\s*\}/s);
  assert.match(landlordPage, /if \(role !== "landlord"\) \{\s*redirect\(resolvePostLoginRedirect\(\{ role \}\)\);\s*\}/s);
  assert.match(agentPage, /if \(!role\) \{\s*redirect\("\/onboarding"\);\s*\}/s);
  assert.match(landlordPage, /if \(!role\) \{\s*redirect\("\/onboarding"\);\s*\}/s);
});

void test("role detail onboarding clients no longer mutate account role", () => {
  const agentClient = read("components", "onboarding", "AgentOnboardingClient.tsx");
  const landlordClient = read("components", "onboarding", "LandlordOnboardingClient.tsx");

  assert.doesNotMatch(agentClient, /role:\s*"agent"/);
  assert.doesNotMatch(landlordClient, /role:\s*"landlord"/);
  assert.match(agentClient, /onboarding_completed:\s*true/);
  assert.match(landlordClient, /onboarding_completed:\s*true/);
});

void test("profile role transition migration blocks self-service role changes after initial claim", () => {
  const migration = read("supabase", "migrations", "20260430110000_profile_role_transition_hardening.sql");

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.prevent_self_service_profile_role_transition\(\)/);
  assert.match(migration, /auth\.role\(\) = 'service_role'/);
  assert.match(migration, /OLD\.role IS NULL/);
  assert.match(migration, /NEW\.role::TEXT IN \('tenant', 'landlord', 'agent'\)/);
  assert.match(migration, /RAISE EXCEPTION 'unsupported profile role transition'/);
  assert.match(migration, /BEFORE UPDATE OF role ON public\.profiles/);
});
