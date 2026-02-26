import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomSheet } from "@/components/ui/BottomSheet";

void test("bottom sheet renders accessible dialog markup when open", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      BottomSheet,
      {
        open: true,
        onOpenChange: () => {},
        title: "Quick search",
        description: "Find homes quickly",
      },
      React.createElement("div", null, "Sheet body")
    )
  );

  assert.match(html, /data-testid="bottom-sheet"/);
  assert.match(html, /data-testid="bottom-sheet-panel"/);
  assert.match(html, /data-testid="bottom-sheet-backdrop"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Quick search/);
});

void test("bottom sheet is null when closed", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      BottomSheet,
      {
        open: false,
        onOpenChange: () => {},
        title: "Quick search",
      },
      React.createElement("div", null, "Sheet body")
    )
  );

  assert.equal(html, "");
});

void test("bottom sheet source includes close, escape, focus restore and body scroll lock", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "BottomSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.addEventListener\("keydown"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /trapFocusWithinContainer\(event, panelRef\.current\)/);
  assert.match(source, /previousFocusRef\.current\?\.focus\(\)/);
  assert.match(source, /id=\{sheetId\}/);
  assert.match(source, /data-testid="bottom-sheet-backdrop"/);
});
