import test from "node:test";
import assert from "node:assert/strict";
import { buildNextBestActions } from "@/lib/checklists/next-best-actions";
import type { ChecklistItem } from "@/lib/checklists/role-checklists";

void test("buildNextBestActions orders high-impact items first and limits to three", () => {
  const items: ChecklistItem[] = [
    { id: "tenant-contact", label: "Contact host", href: "/dashboard/messages", status: "todo" },
    { id: "tenant-collection", label: "Create collection", href: "/favourites", status: "todo" },
    { id: "tenant-verification", label: "Complete verification", href: "/account/verification", status: "todo" },
    { id: "tenant-alerts", label: "Enable alerts", href: "/tenant/saved-searches", status: "todo" },
    { id: "tenant-saved-search", label: "Save search", href: "/properties", status: "todo" },
  ];

  const model = buildNextBestActions(items, 3);
  assert.equal(model.actions.length, 3);
  assert.equal(model.actions[0]?.id, "tenant-verification");
  assert.equal(model.actions[1]?.id, "tenant-alerts");
  assert.equal(model.actions[2]?.id, "tenant-saved-search");
});

void test("buildNextBestActions returns allComplete when checklist is done", () => {
  const items: ChecklistItem[] = [
    { id: "tenant-verification", label: "Complete verification", href: "/account/verification", status: "done" },
    { id: "tenant-saved-search", label: "Save search", href: "/properties", status: "done" },
  ];

  const model = buildNextBestActions(items, 3);
  assert.equal(model.allComplete, true);
  assert.equal(model.actions.length, 0);
  assert.equal(model.progressPercent, 100);
});
