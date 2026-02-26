import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  dispatchMarketChanged,
  subscribeMarketChanged,
} from "@/lib/market/market-events";

type WindowLike = EventTarget & {
  addEventListener: EventTarget["addEventListener"];
  removeEventListener: EventTarget["removeEventListener"];
  dispatchEvent: EventTarget["dispatchEvent"];
};

function withMockWindow(run: (win: WindowLike) => void) {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const mockWindow = new EventTarget() as WindowLike;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: mockWindow,
  });
  try {
    run(mockWindow);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  }
}

void test("market change event wiring publishes and subscribes safely", () => {
  withMockWindow(() => {
    const received: string[] = [];
    const unsubscribe = subscribeMarketChanged((detail) => {
      received.push(`${detail.country}|${detail.currency}|${detail.label}`);
    });

    dispatchMarketChanged({
      country: "CA",
      currency: "CAD",
      label: "Canada",
    });
    unsubscribe();
    dispatchMarketChanged({
      country: "US",
      currency: "USD",
      label: "United States",
    });

    assert.deepEqual(received, ["CA|CAD|Canada"]);
  });
});

void test("market switch toast source shows toast from market-change event and auto-dismisses", () => {
  const sourcePath = path.join(process.cwd(), "components", "market", "MarketSwitchToast.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="market-switch-toast"/);
  assert.match(source, /subscribeMarketChanged/);
  assert.match(source, /Now showing picks for/);
  assert.match(source, /setTimeout\(/);
  assert.match(source, /TOAST_DURATION_MS/);
});

void test("market selector source dispatches market-change event and avoids hard reload", () => {
  const sourcePath = path.join(process.cwd(), "components", "layout", "MarketSelector.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /dispatchMarketChanged/);
  assert.match(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
});
