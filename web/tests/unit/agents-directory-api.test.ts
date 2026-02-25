import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  getAgentsSearchResponse,
  type AgentsDirectorySearchRouteDeps,
} from "@/app/api/agents/search/route";

function makeRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

void test("agents search api defaults to verified-only and returns safe fields", async () => {
  let receivedInput: Parameters<AgentsDirectorySearchRouteDeps["searchAgentsDirectory"]>[0] | null =
    null;

  const deps: AgentsDirectorySearchRouteDeps = {
    searchAgentsDirectory: async (input) => {
      receivedInput = input;
      return {
        items: [
          {
            id: "agent-1",
            displayName: "Ada Agent",
            slug: "ada-agent",
            location: "Lagos, Nigeria",
            verified: true,
            avatarUrl: "https://example.com/avatar.png",
            href: "/agents/ada-agent",
          },
        ],
        total: 1,
        hasMore: false,
        limit: input.limit ?? 24,
        offset: input.offset ?? 0,
      };
    },
  };

  const response = await getAgentsSearchResponse(
    makeRequest("http://localhost/api/agents/search?q=ada"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(receivedInput?.verifiedOnly, true);
  assert.equal(receivedInput?.q, "ada");
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].displayName, "Ada Agent");
  assert.equal(body.items[0].href, "/agents/ada-agent");
  assert.equal("email" in body.items[0], false);
  assert.equal("phone" in body.items[0], false);
  assert.equal("first_name" in body.items[0], false);
  assert.equal("last_name" in body.items[0], false);
});

void test("agents search api respects verified=0 and pagination params", async () => {
  let receivedInput: Parameters<AgentsDirectorySearchRouteDeps["searchAgentsDirectory"]>[0] | null =
    null;

  const deps: AgentsDirectorySearchRouteDeps = {
    searchAgentsDirectory: async (input) => {
      receivedInput = input;
      return {
        items: [],
        total: 0,
        hasMore: false,
        limit: input.limit ?? 24,
        offset: input.offset ?? 0,
      };
    },
  };

  const response = await getAgentsSearchResponse(
    makeRequest(
      "http://localhost/api/agents/search?q=lagos&location=nigeria&verified=0&limit=10&offset=20"
    ),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedInput?.verifiedOnly, false);
  assert.equal(receivedInput?.q, "lagos");
  assert.equal(receivedInput?.location, "nigeria");
  assert.equal(receivedInput?.limit, 10);
  assert.equal(receivedInput?.offset, 20);
  assert.equal(body.limit, 10);
  assert.equal(body.offset, 20);
});

void test("agents search api returns 500 when lookup throws", async () => {
  const deps: AgentsDirectorySearchRouteDeps = {
    searchAgentsDirectory: async () => {
      throw new Error("boom");
    },
  };

  const response = await getAgentsSearchResponse(
    makeRequest("http://localhost/api/agents/search"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(String(body.error || ""), /boom/i);
});
