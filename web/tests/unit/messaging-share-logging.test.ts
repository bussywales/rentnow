import test from "node:test";
import assert from "node:assert/strict";

import { logShareAccess } from "../../lib/messaging/share-logging";

void test("logShareAccess does not include tokens", () => {
  const lines: string[] = [];
  logShareAccess(
    { result: "invalid", actorProfileId: "user-123" } as unknown as {
      result: "invalid";
      actorProfileId: string;
      token: string;
    },
    (line) => {
      lines.push(line);
    }
  );

  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes("\"share_access_attempt\""));
  assert.ok(!lines[0].includes("\"token\""));
});
