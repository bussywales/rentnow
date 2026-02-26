import test from "node:test";
import assert from "node:assert/strict";
import { resolveRecoReasonLabel } from "@/lib/reco";

void test("reco reason labels map stable copy for signal-derived reasons", () => {
  assert.equal(resolveRecoReasonLabel({ code: "SAVED", marketCountry: "US" }), "Because you saved similar homes");
  assert.equal(resolveRecoReasonLabel({ code: "VIEWED", marketCountry: "US" }), "Because you viewed similar homes");
  assert.equal(
    resolveRecoReasonLabel({ code: "CONTINUE_BROWSING", marketCountry: "US" }),
    "Continue browsing this search"
  );
});

void test("fallback popular reason resolves market label and normalizes UK to GB", () => {
  assert.equal(resolveRecoReasonLabel({ code: "FALLBACK_POPULAR", marketCountry: "US" }), "Popular in United States");
  assert.equal(resolveRecoReasonLabel({ code: "FALLBACK_POPULAR", marketCountry: "UK" }), "Popular in United Kingdom");
  assert.equal(resolveRecoReasonLabel({ code: "FALLBACK_POPULAR", marketCountry: "ZZ" }), "Popular in your market");
});
