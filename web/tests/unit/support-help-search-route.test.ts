import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  getSupportHelpSearchResponse,
  type SupportHelpSearchDeps,
} from "@/app/api/support/help-search/route";

function makeRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

void test("support help-search route returns matching rows for query", async () => {
  const deps: SupportHelpSearchDeps = {
    searchSupportHelpDocs: async () => [
      {
        title: "Host approvals for shortlets",
        snippet: "Hosts have 12 hours to respond to pending booking requests.",
        href: "/help/landlord/shortlets-bookings",
        score: 12,
      },
    ],
  };

  const response = await getSupportHelpSearchResponse(
    makeRequest("http://localhost/api/support/help-search?q=pending%20approval"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.results.length, 1);
  assert.equal(body.results[0].href, "/help/landlord/shortlets-bookings");
});

void test("support help-search route returns empty payload for short query", async () => {
  let called = false;
  const deps: SupportHelpSearchDeps = {
    searchSupportHelpDocs: async () => {
      called = true;
      return [];
    },
  };

  const response = await getSupportHelpSearchResponse(
    makeRequest("http://localhost/api/support/help-search?q=a"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.results), true);
  assert.equal(body.results.length, 0);
  assert.equal(called, false);
});

