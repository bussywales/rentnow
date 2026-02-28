import test from "node:test";
import assert from "node:assert/strict";
import { resolveAgentsDirectoryHref } from "@/lib/agents/agents-directory.server";

void test("resolveAgentsDirectoryHref prefers slug and falls back to /agents/u/[id]", () => {
  assert.equal(
    resolveAgentsDirectoryHref({
      advertiserId: "agent-1",
      publicSlug: "xthetic-studio",
    }),
    "/agents/xthetic-studio"
  );

  assert.equal(
    resolveAgentsDirectoryHref({
      advertiserId: "agent-2",
      publicSlug: null,
    }),
    "/agents/u/agent-2"
  );
});
