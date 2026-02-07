import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canAttributeLeadToClientPage,
  insertLeadAttribution,
} from "@/lib/leads/lead-attribution";

void test("canAttributeLeadToClientPage checks owner and publish state", () => {
  const valid = canAttributeLeadToClientPage({
    clientPage: {
      id: "page-1",
      agent_user_id: "agent-1",
      published: true,
      expires_at: "2099-01-01T00:00:00Z",
    },
    propertyOwnerId: "agent-1",
  });
  assert.equal(valid, true);

  const invalid = canAttributeLeadToClientPage({
    clientPage: {
      id: "page-2",
      agent_user_id: "agent-2",
      published: false,
      expires_at: null,
    },
    propertyOwnerId: "agent-2",
  });
  assert.equal(invalid, false);
});

void test("canAttributeLeadToClientPage blocks when owner mismatches or page missing", () => {
  const mismatch = canAttributeLeadToClientPage({
    clientPage: {
      id: "page-3",
      agent_user_id: "agent-3",
      published: true,
      expires_at: null,
    },
    propertyOwnerId: "agent-99",
  });
  assert.equal(mismatch, false);

  const missing = canAttributeLeadToClientPage({
    clientPage: null,
    propertyOwnerId: "agent-1",
  });
  assert.equal(missing, false);
});

void test("insertLeadAttribution writes row", async () => {
  let payload: any = null;
  const adminClient = {
    from: () => ({
      insert: async (values: unknown) => {
        payload = values;
        return { error: null };
      },
    }),
  } as unknown as {
    from: (table: string) => {
      insert: (values: unknown) => Promise<{ error?: { message?: string } | null }>;
    };
  };

  const result = await insertLeadAttribution(adminClient as any, {
    lead_id: "lead-1",
    agent_user_id: "agent-1",
    client_page_id: "page-1",
    source: "agent_client_page",
  });

  assert.equal(result.ok, true);
  assert.equal(payload.lead_id, "lead-1");
  assert.equal(payload.client_page_id, "page-1");
});

void test("lead_attributions policies restrict agent reads", () => {
  const rlsPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(rlsPath, "utf8");
  assert.ok(
    contents.includes('CREATE POLICY "lead_attributions_agent_select"'),
    "expected lead_attributions agent select policy"
  );
  assert.ok(
    contents.includes("agent_user_id = auth.uid()"),
    "expected agent select policy to scope to agent_user_id"
  );
});
