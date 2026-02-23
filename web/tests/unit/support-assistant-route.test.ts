import test from "node:test";
import assert from "node:assert/strict";
import {
  postSupportAssistantResponse,
  type SupportAssistantDeps,
} from "@/app/api/support/assistant/route";

function makeRequest(payload: unknown) {
  return new Request("http://localhost/api/support/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

void test("support assistant escalates on critical chargeback keyword", async () => {
  const deps: SupportAssistantDeps = {
    searchSupportHelpDocs: async () => [],
    hasOpenAiKey: () => false,
    completeWithContext: async () => null,
  };

  const response = await postSupportAssistantResponse(
    makeRequest({ message: "I need help with a chargeback and possible fraud." }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.shouldEscalate, true);
  assert.equal(body.escalationReason, "critical_keyword");
  assert.equal(body.confidence, "low");
});

void test("support assistant keeps normal help query as non-escalation", async () => {
  const deps: SupportAssistantDeps = {
    searchSupportHelpDocs: async () => [
      {
        title: "Shortlet trips timeline",
        snippet: "Host has up to 12 hours to approve request bookings.",
        href: "/help/tenant/shortlets-trips-timeline",
        score: 11,
      },
    ],
    hasOpenAiKey: () => false,
    completeWithContext: async () => null,
  };

  const response = await postSupportAssistantResponse(
    makeRequest({ message: "How long does host approval take?" }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.shouldEscalate, false);
  assert.equal(body.escalationReason, null);
  assert.equal(Array.isArray(body.suggestedArticles), true);
  assert.equal(body.suggestedArticles.length, 1);
});

void test("support assistant schema stays stable for repeated still-not-working path", async () => {
  const deps: SupportAssistantDeps = {
    searchSupportHelpDocs: async () => [
      {
        title: "Troubleshooting",
        snippet: "Try sign out and sign back in.",
        href: "/help/troubleshooting/getting-started",
        score: 5,
      },
    ],
    hasOpenAiKey: () => false,
    completeWithContext: async () => null,
  };

  const response = await postSupportAssistantResponse(
    makeRequest({
      message: "still not working after refresh",
      history: [{ role: "user", content: "still not working" }],
    }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.answer, "string");
  assert.equal(body.shouldEscalate, true);
  assert.equal(body.escalationReason, "repeat_failure_reported");
  assert.ok(["high", "med", "low"].includes(body.confidence));
});

