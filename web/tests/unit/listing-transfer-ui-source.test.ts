import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = "/Users/olubusayoadewale/rentnow/web";

void test("host listing edit page exposes transfer ownership panel and transfers workspace", () => {
  const editPage = fs.readFileSync(path.join(repoRoot, "app", "host", "properties", "[id]", "edit", "page.tsx"), "utf8");
  const transfersPage = fs.readFileSync(path.join(repoRoot, "app", "host", "transfers", "page.tsx"), "utf8");
  const panel = fs.readFileSync(path.join(repoRoot, "components", "host", "ListingOwnershipTransferPanel.tsx"), "utf8");

  assert.match(editPage, /ListingOwnershipTransferPanel/);
  assert.match(panel, /Transfer ownership/);
  assert.match(panel, /Ownership stays with you until the recipient accepts/);
  assert.match(transfersPage, /Listing transfers/);
  assert.match(transfersPage, /Accept, reject, or cancel controlled listing ownership transfers/);
});

void test("admin visibility and sidebar expose listing transfer audit surface", () => {
  const adminPage = fs.readFileSync(path.join(repoRoot, "app", "admin", "page.tsx"), "utf8");
  const adminTransfersPage = fs.readFileSync(path.join(repoRoot, "app", "admin", "listing-transfers", "page.tsx"), "utf8");
  const sidebar = fs.readFileSync(path.join(repoRoot, "lib", "workspace", "sidebar-model.ts"), "utf8");

  assert.match(adminPage, /href="\/admin\/listing-transfers"/);
  assert.match(adminTransfersPage, /Lightweight audit visibility for ownership transfer requests/);
  assert.match(sidebar, /label: "Listing transfers", href: "\/host\/transfers"/);
  assert.match(sidebar, /label: "Listing transfers", href: "\/admin\/listing-transfers"/);
});
