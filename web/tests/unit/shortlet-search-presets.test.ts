import test from "node:test";
import assert from "node:assert/strict";
import {
  addPresetToList,
  buildShortletPresetLabel,
  createPresetParamsFromSearchParams,
  presetParamsToSearchParams,
} from "@/lib/shortlet/search-presets";

void test("preset labels stay readable for where, guests, and dates", () => {
  const label = buildShortletPresetLabel({
    where: "Lekki",
    guests: "2",
    checkIn: "2026-03-02",
    checkOut: "2026-03-05",
  });

  assert.equal(label.includes("Lekki"), true);
  assert.equal(label.includes("2 guests"), true);
  assert.equal(label.includes("2026-03-02"), true);
});

void test("adding presets de-dupes by params and keeps newest first", () => {
  const first = addPresetToList({
    existing: [],
    params: { where: "Lekki", guests: "1" },
    limit: 8,
    now: "2026-02-19T10:00:00.000Z",
  });
  const deduped = addPresetToList({
    existing: first,
    params: { where: "Lekki", guests: "1" },
    limit: 8,
    now: "2026-02-19T10:05:00.000Z",
  });

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.createdAt, "2026-02-19T10:05:00.000Z");
});

void test("preset params extraction keeps allowed keys and normalized guests", () => {
  const params = new URLSearchParams(
    "where=Abuja&checkIn=2026-03-01&checkOut=2026-03-03&guests=3&foo=bar"
  );
  const picked = createPresetParamsFromSearchParams(params);
  assert.equal(picked.where, "Abuja");
  assert.equal(picked.guests, "3");
  assert.equal(Object.hasOwn(picked, "foo"), false);

  const back = presetParamsToSearchParams(picked);
  assert.equal(back.get("where"), "Abuja");
  assert.equal(back.get("guests"), "3");
});
