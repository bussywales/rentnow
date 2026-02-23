import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildHostGettingStartedShowStorageKey,
  resolveHostGettingStartedHidden,
  isHostGettingStartedComplete,
} from "@/lib/host/getting-started-preferences";
import type { ChecklistItem } from "@/lib/checklists/role-checklists";

const completeItems: ChecklistItem[] = [
  { id: "a", label: "A", href: "/a", status: "done" },
  { id: "b", label: "B", href: "/b", status: "coming_soon" },
];

void test("completed host checklist hides by default and can be shown again", () => {
  assert.equal(isHostGettingStartedComplete(completeItems), true);
  assert.equal(
    resolveHostGettingStartedHidden({ items: completeItems, showCompleted: false }),
    true
  );
  assert.equal(
    resolveHostGettingStartedHidden({ items: completeItems, showCompleted: true }),
    false
  );
});

void test("incomplete host checklist stays visible", () => {
  const items: ChecklistItem[] = [
    { id: "a", label: "A", href: "/a", status: "done" },
    { id: "b", label: "B", href: "/b", status: "todo" },
  ];

  assert.equal(isHostGettingStartedComplete(items), false);
  assert.equal(resolveHostGettingStartedHidden({ items, showCompleted: false }), false);
});

void test("host getting-started preference key is scoped per host", () => {
  assert.equal(
    buildHostGettingStartedShowStorageKey("host-123"),
    "home:host:getting-started:show-complete:v1:host-123"
  );
  assert.equal(
    buildHostGettingStartedShowStorageKey(null),
    "home:host:getting-started:show-complete:v1:anon"
  );
});

void test("host checklist component renders checklist complete show-again affordance", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostGettingStartedSection.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Checklist complete/);
  assert.match(source, /Show again/);
  assert.match(source, /host-home-getting-started-complete-chip/);
});
