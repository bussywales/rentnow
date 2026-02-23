import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host layout uses shared sidebar shell for host routes", () => {
  const layoutPath = path.join(process.cwd(), "app", "host", "layout.tsx");
  const source = fs.readFileSync(layoutPath, "utf8");

  assert.match(source, /HostSidebar/);
  assert.match(source, /awaitingApprovalCount/);
  assert.match(source, /unreadMessages/);
});

void test("host sidebar includes required persistent navigation links", () => {
  const sidebarPath = path.join(process.cwd(), "components", "host", "HostSidebar.tsx");
  const source = fs.readFileSync(sidebarPath, "utf8");

  assert.match(source, /host:sidebar:collapsed:v1/);
  assert.match(source, /href: "\/host"/);
  assert.match(source, /href: "\/host\/bookings"/);
  assert.match(source, /href: "\/host\/calendar"/);
  assert.match(source, /href: "\/host\/listings"/);
  assert.match(source, /href: "\/host\/earnings"/);
});

