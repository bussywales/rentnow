import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketPreferenceProvider } from "@/components/layout/MarketPreferenceProvider";
import { MarketSelector } from "@/components/layout/MarketSelector";

void test("market selector does not render when disabled", () => {
  const html = renderToStaticMarkup(
    createElement(
      MarketPreferenceProvider,
      {
        initialMarket: { country: "NG", currency: "NGN", source: "default" },
      },
      createElement(MarketSelector, { enabled: false })
    )
  );
  assert.equal(html, "");
});

void test("market selector renders when enabled", () => {
  const html = renderToStaticMarkup(
    createElement(
      MarketPreferenceProvider,
      {
        initialMarket: { country: "NG", currency: "NGN", source: "default" },
      },
      createElement(MarketSelector, { enabled: true })
    )
  );
  assert.match(html, /Select market/i);
  assert.match(html, /Nigeria/i);
});

