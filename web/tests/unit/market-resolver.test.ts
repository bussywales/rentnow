import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MARKET_SETTINGS,
  formatCurrencySymbol,
  resolveMarketFromRequest,
  serializeMarketCookieValue,
} from "@/lib/market/market";

void test("resolveMarketFromRequest prioritizes cookie over geo and defaults", () => {
  const headers = new Headers({
    cookie: `ph_market=${encodeURIComponent(serializeMarketCookieValue("GB", "GBP"))}`,
    "x-vercel-ip-country": "NG",
  });
  const resolved = resolveMarketFromRequest({
    headers,
    appSettings: {
      defaultCountry: "NG",
      defaultCurrency: "NGN",
      autoDetectEnabled: true,
      selectorEnabled: true,
    },
  });
  assert.deepEqual(resolved, {
    country: "GB",
    currency: "GBP",
    source: "cookie",
  });
});

void test("resolveMarketFromRequest uses geo country when enabled and cookie missing", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "NG",
  });
  const resolved = resolveMarketFromRequest({
    headers,
    appSettings: {
      defaultCountry: "GB",
      defaultCurrency: "GBP",
      autoDetectEnabled: true,
      selectorEnabled: true,
    },
  });
  assert.deepEqual(resolved, {
    country: "NG",
    currency: "NGN",
    source: "geo",
  });
});

void test("resolveMarketFromRequest falls back to default for unsupported geo", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "US",
  });
  const resolved = resolveMarketFromRequest({
    headers,
    appSettings: {
      defaultCountry: "NG",
      defaultCurrency: "NGN",
      autoDetectEnabled: true,
      selectorEnabled: true,
    },
  });
  assert.deepEqual(resolved, {
    country: "NG",
    currency: "NGN",
    source: "default",
  });
});

void test("resolveMarketFromRequest ignores geo when auto-detect disabled", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "NG",
  });
  const resolved = resolveMarketFromRequest({
    headers,
    appSettings: {
      defaultCountry: "GB",
      defaultCurrency: "GBP",
      autoDetectEnabled: false,
      selectorEnabled: true,
    },
  });
  assert.deepEqual(resolved, {
    country: "GB",
    currency: "GBP",
    source: "default",
  });
});

void test("formatCurrencySymbol supports core symbols", () => {
  assert.equal(formatCurrencySymbol("NGN"), "\u20A6");
  assert.equal(formatCurrencySymbol("GBP"), "\u00A3");
  assert.equal(formatCurrencySymbol("USD"), "$");
  assert.equal(formatCurrencySymbol("EUR"), "\u20AC");
  assert.equal(formatCurrencySymbol(""), DEFAULT_MARKET_SETTINGS.defaultCurrency);
});

