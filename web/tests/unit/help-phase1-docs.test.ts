import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getHelpDocsForRole } from "@/lib/help/docs";
import HostListingsHelpPage from "@/app/help/host/listings/page";
import HostServicesHelpPage from "@/app/help/host/services/page";

void test("landlord role help includes phase 1 monetisation, qr, and move-ready guides", async () => {
  const docs = await getHelpDocsForRole("landlord");
  const slugs = docs.map((doc) => doc.slug);

  assert.ok(slugs.includes("listing-monetisation"));
  assert.ok(slugs.includes("qr-sign-kit"));
  assert.ok(slugs.includes("move-ready-services"));
});

void test("agent role help includes phase 1 monetisation, qr, move-ready, and referrals guides", async () => {
  const docs = await getHelpDocsForRole("agent");
  const slugs = docs.map((doc) => doc.slug);

  assert.ok(slugs.includes("listing-monetisation"));
  assert.ok(slugs.includes("qr-sign-kit"));
  assert.ok(slugs.includes("move-ready-services"));
  assert.ok(slugs.includes("referrals"));
});

void test("host listings help links to the durable qr and billing guides", () => {
  const html = renderToStaticMarkup(React.createElement(HostListingsHelpPage));
  assert.ok(html.includes("/help/landlord/listing-monetisation"));
  assert.ok(html.includes("/help/landlord/qr-sign-kit"));
});

void test("host services help links to the durable landlord-host move-ready guide", () => {
  const html = renderToStaticMarkup(React.createElement(HostServicesHelpPage));
  assert.ok(html.includes("/help/landlord/move-ready-services"));
});
