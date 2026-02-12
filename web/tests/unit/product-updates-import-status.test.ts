import test from "node:test";
import assert from "node:assert/strict";
import { summarizeUpdateImportStates } from "@/lib/product-updates/import-status";

void test("summarizeUpdateImportStates buckets new, needs sync, and up-to-date notes", () => {
  const summary = summarizeUpdateImportStates([
    {
      audiences: ["tenant", "host"],
      importedAudiences: ["tenant"],
      syncedAudiences: ["tenant"],
    },
    {
      audiences: ["admin"],
      importedAudiences: ["admin"],
      syncedAudiences: [],
    },
    {
      audiences: ["all"],
      importedAudiences: ["all"],
      syncedAudiences: ["all"],
    },
  ]);

  assert.deepEqual(summary, {
    newSinceImport: 1,
    needsSync: 1,
    upToDate: 1,
  });
});
