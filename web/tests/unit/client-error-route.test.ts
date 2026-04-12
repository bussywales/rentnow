import test from "node:test";
import assert from "node:assert/strict";
import { postClientErrorReportResponse } from "@/app/api/client-errors/route";

void test("client error route records valid runtime error payloads", async () => {
  const originalConsoleError = console.error;
  const logs: string[] = [];
  console.error = (value?: unknown) => {
    logs.push(String(value ?? ""));
  };

  try {
    const response = await postClientErrorReportResponse(
      new Request("http://localhost/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-request-id": "req_test" },
        body: JSON.stringify({
          digest: "digest_123",
          message: "Unhandled client exception",
          stack: "Error: boom",
          pathname: "/properties/123",
          href: "http://localhost/properties/123",
          userAgent: "test-agent",
        }),
      })
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /"event":"client_runtime_error"/);
    assert.match(logs[0], /"digest":"digest_123"/);
    assert.match(logs[0], /"reportedRoute":"\/properties\/123"/);
  } finally {
    console.error = originalConsoleError;
  }
});

void test("client error route rejects invalid payloads", async () => {
  const response = await postClientErrorReportResponse(
    new Request("http://localhost/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    })
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Invalid payload");
});
