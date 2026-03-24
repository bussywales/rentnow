import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("public desktop home hero exposes Make a Request alongside browse CTA", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");

  assert.match(source, /getPropertyRequestQuickStartEntry\(role\)/);
  assert.match(source, /getSignedInHeroCta\(role\)/);
  assert.match(source, /data-testid="desktop-home-cta-browse"/);
  assert.match(source, /data-testid="desktop-home-cta-request"/);
  assert.match(source, /data-testid="desktop-home-cta-get-started"/);
  assert.match(source, /href="\/auth\/register"/);
  assert.match(source, /Browse homes/);
  assert.match(source, /requestQuickStartEntry\.label/);
});

void test("desktop home hero swaps Get started for signed-in continuation CTA", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");

  assert.match(source, /function getSignedInHeroCta/);
  assert.match(source, /role === "tenant"/);
  assert.match(source, /label: "Open your home", href: "\/tenant\/home"/);
  assert.match(source, /label: "Go to workspace", href: "\/home"/);
  assert.match(source, /label: "Open admin", href: "\/admin"/);
  assert.match(source, /signedInHeroCta \? \(/);
  assert.match(source, /data-testid="desktop-home-cta-signed-in"/);
  assert.match(source, /\{signedInHeroCta\.label\}/);
});

void test("tenant home hero exposes Make a Request as a first-row seeker CTA", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "tenant", "home", "page.tsx"), "utf8");

  assert.match(source, /getPropertyRequestQuickStartEntry\(role\)/);
  assert.match(source, /requestAction=\{requestQuickStartEntry\}/);
  assert.match(source, /requestActionTestId="tenant-home-cta-request"/);
  assert.match(source, /ContinueSearchCard/);
  assert.match(source, /HomeBrowseCtaClient/);
});

void test("browse CTA client can render Make a Request without displacing browse and continue actions", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components", "market", "HomeBrowseCtaClient.tsx"),
    "utf8"
  );

  assert.match(source, /requestAction\?: PropertyRequestQuickStartEntry \| null/);
  assert.match(source, /requestActionTestId\?: string/);
  assert.match(source, /data-testid=\{requestActionTestId\}/);
  assert.match(source, /Browse all homes/);
  assert.match(source, /Continue browsing/);
  assert.match(source, /Start in \{fallbackLabel\}/);
});
