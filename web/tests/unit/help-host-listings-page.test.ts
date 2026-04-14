import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HostListingsHelpPage from "@/app/help/host/listings/page";

void test("host listings help documents the qr sign kit flow", () => {
  const html = renderToStaticMarkup(React.createElement(HostListingsHelpPage));
  assert.match(html, /Open QR sign kits for live listings/);
  assert.match(html, /Open sign kit/);
  assert.match(html, /tracked share link/);
  assert.match(html, /Only live listings can generate sign kits/);
  assert.match(html, /generic QR generator/);
});
