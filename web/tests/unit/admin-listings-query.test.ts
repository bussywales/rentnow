import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminListingsQuery,
  serializeAdminListingsQuery,
} from "@/lib/admin/admin-listings-query";

describe("admin listings query parsing", () => {
  it("defaults are applied when params missing", () => {
    const parsed = parseAdminListingsQuery({});
    assert.equal(parsed.q, null);
    assert.equal(parsed.qMode, "title");
    assert.deepEqual(parsed.statuses, []);
    assert.equal(parsed.active, "all");
    assert.equal(parsed.demo, "all");
    assert.equal(parsed.featured, "all");
    assert.equal(parsed.page, 1);
    assert.ok(parsed.pageSize >= 10);
    assert.equal(parsed.sort, "updated_desc");
    assert.equal(parsed.missingCover, false);
    assert.equal(parsed.missingPhotos, false);
    assert.equal(parsed.missingLocation, false);
    assert.equal(parsed.priceMin, null);
    assert.equal(parsed.priceMax, null);
    assert.equal(parsed.listing_type, null);
    assert.equal(parsed.bedroomsMin, null);
    assert.equal(parsed.bedroomsMax, null);
    assert.equal(parsed.bathroomsMin, null);
    assert.equal(parsed.bathroomsMax, null);
  });

  it("parses provided query params", () => {
    const parsed = parseAdminListingsQuery({
      q: "Lagos",
      qMode: "title",
      status: "live,pending",
      active: "true",
      demo: "true",
      featured: "1",
      page: "2",
      pageSize: "25",
      sort: "updated_asc",
      missingCover: "true",
      missingPhotos: "1",
      missingLocation: "yes",
      priceMin: "100",
      priceMax: "999",
      listing_type: "apartment",
      bedroomsMin: "2",
      bedroomsMax: "4",
      bathroomsMin: "1",
      bathroomsMax: "3",
    });
    assert.equal(parsed.q, "Lagos");
    assert.equal(parsed.qMode, "title");
    assert.ok(parsed.statuses.includes("live"));
    assert.ok(parsed.statuses.includes("pending"));
    assert.equal(parsed.active, "true");
    assert.equal(parsed.demo, "true");
    assert.equal(parsed.featured, "active");
    assert.equal(parsed.page, 2);
    assert.equal(parsed.pageSize, 25);
    assert.equal(parsed.sort, "updated_asc");
    assert.equal(parsed.missingCover, true);
    assert.equal(parsed.missingPhotos, true);
    assert.equal(parsed.missingLocation, true);
    assert.equal(parsed.priceMin, 100);
    assert.equal(parsed.priceMax, 999);
    assert.equal(parsed.listing_type, "apartment");
    assert.equal(parsed.bedroomsMin, 2);
    assert.equal(parsed.bedroomsMax, 4);
    assert.equal(parsed.bathroomsMin, 1);
    assert.equal(parsed.bathroomsMax, 3);
  });

  it("parses status from single or comma-separated values", () => {
    const single = parseAdminListingsQuery({ status: "draft" });
    assert.deepEqual(single.statuses, ["draft"]);

    const multi = parseAdminListingsQuery({ status: "draft,pending" });
    assert.deepEqual(multi.statuses.sort(), ["draft", "pending"]);
  });

  it("parses status from repeated params", () => {
    const parsed = parseAdminListingsQuery({ status: ["draft", "pending"] });
    assert.deepEqual(parsed.statuses.sort(), ["draft", "pending"]);
  });

  it("parses status from alternate keys", () => {
    const parsed = parseAdminListingsQuery({ statuses: "draft,pending" });
    assert.deepEqual(parsed.statuses.sort(), ["draft", "pending"]);
  });

  it("parses featured filters", () => {
    const featured = parseAdminListingsQuery({ featured: "1" });
    assert.equal(featured.featured, "active");

    const expiring = parseAdminListingsQuery({ expiring: "1" });
    assert.equal(expiring.featured, "expiring");

    const expired = parseAdminListingsQuery({ expired: "1" });
    assert.equal(expired.featured, "expired");
  });

  it("parses demo filter", () => {
    const onlyDemo = parseAdminListingsQuery({ demo: "true" });
    assert.equal(onlyDemo.demo, "true");

    const notDemo = parseAdminListingsQuery({ demo: "false" });
    assert.equal(notDemo.demo, "false");

    const all = parseAdminListingsQuery({ demo: "all" });
    assert.equal(all.demo, "all");
  });

  it("ignores empty or invalid status values", () => {
    const empty = parseAdminListingsQuery({ status: "" });
    assert.deepEqual(empty.statuses, []);

    const mixed = parseAdminListingsQuery({ status: "draft,NOPE" });
    assert.deepEqual(mixed.statuses, ["draft"]);
  });

  it("detects uuid and defaults to id mode when qMode missing", () => {
    const parsed = parseAdminListingsQuery({
      q: "dad2bb26-fe36-4096-b81a-f86d230f9b3d",
    });
    assert.equal(parsed.q, "dad2bb26-fe36-4096-b81a-f86d230f9b3d");
    assert.equal(parsed.qMode, "id");
  });

  it("detects uuid even when qMode is title", () => {
    const parsed = parseAdminListingsQuery({
      q: "dad2bb26-fe36-4096-b81a-f86d230f9b3d",
      qMode: "title",
    });
    assert.equal(parsed.qMode, "id");
  });

  it("invalid status and active fall back safely", () => {
    const parsed = parseAdminListingsQuery({
      status: "bogus",
      active: "nope",
      page: "-1",
    });
    assert.deepEqual(parsed.statuses, []);
    assert.equal(parsed.active, "all");
    assert.equal(parsed.page, 1);
  });

  it("round-trips serialize -> parse for full filters", () => {
    const original = parseAdminListingsQuery({
      q: "Lagos",
      qMode: "title",
      status: ["pending", "live"],
      active: "false",
      demo: "false",
      featured: "1",
      missingCover: "true",
      missingPhotos: "true",
      missingLocation: "true",
      priceMin: "500",
      priceMax: "1500",
      listing_type: "studio",
      bedroomsMin: "1",
      bedroomsMax: "2",
      bathroomsMin: "1",
      bathroomsMax: "2",
      sort: "created_desc",
      page: "3",
      pageSize: "25",
    });

    const roundTrip = parseAdminListingsQuery(
      serializeAdminListingsQuery(original)
    );

    assert.deepEqual(roundTrip.statuses.sort(), original.statuses.sort());
    assert.equal(roundTrip.q, original.q);
    assert.equal(roundTrip.qMode, original.qMode);
    assert.equal(roundTrip.active, original.active);
    assert.equal(roundTrip.demo, original.demo);
    assert.equal(roundTrip.featured, original.featured);
    assert.equal(roundTrip.missingCover, original.missingCover);
    assert.equal(roundTrip.missingPhotos, original.missingPhotos);
    assert.equal(roundTrip.missingLocation, original.missingLocation);
    assert.equal(roundTrip.priceMin, original.priceMin);
    assert.equal(roundTrip.priceMax, original.priceMax);
    assert.equal(roundTrip.listing_type, original.listing_type);
    assert.equal(roundTrip.bedroomsMin, original.bedroomsMin);
    assert.equal(roundTrip.bedroomsMax, original.bedroomsMax);
    assert.equal(roundTrip.bathroomsMin, original.bathroomsMin);
    assert.equal(roundTrip.bathroomsMax, original.bathroomsMax);
    assert.equal(roundTrip.sort, original.sort);
    assert.equal(roundTrip.page, original.page);
    assert.equal(roundTrip.pageSize, original.pageSize);
  });
});
