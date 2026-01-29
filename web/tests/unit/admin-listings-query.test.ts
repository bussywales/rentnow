import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAdminListingsQuery } from "@/lib/admin/admin-listings";

describe("admin listings query parsing", () => {
  it("defaults are applied when params missing", () => {
    const parsed = parseAdminListingsQuery({});
    assert.equal(parsed.q, null);
    assert.equal(parsed.qMode, "title");
    assert.deepEqual(parsed.statuses, []);
    assert.equal(parsed.active, "all");
    assert.equal(parsed.page, 1);
    assert.ok(parsed.pageSize >= 10);
    assert.equal(parsed.sort, "updated_desc");
    assert.equal(parsed.missingCover, false);
    assert.equal(parsed.missingPhotos, false);
    assert.equal(parsed.missingLocation, false);
    assert.equal(parsed.priceMin, null);
    assert.equal(parsed.priceMax, null);
  });

  it("parses provided query params", () => {
    const parsed = parseAdminListingsQuery({
      q: "Lagos",
      qMode: "title",
      status: "live,pending",
      active: "true",
      page: "2",
      pageSize: "25",
      sort: "updated_asc",
      missingCover: "true",
      missingPhotos: "1",
      missingLocation: "yes",
      priceMin: "100",
      priceMax: "999",
    });
    assert.equal(parsed.q, "Lagos");
    assert.equal(parsed.qMode, "title");
    assert.ok(parsed.statuses.includes("live"));
    assert.ok(parsed.statuses.includes("pending"));
    assert.equal(parsed.active, "true");
    assert.equal(parsed.page, 2);
    assert.equal(parsed.pageSize, 25);
    assert.equal(parsed.sort, "updated_asc");
    assert.equal(parsed.missingCover, true);
    assert.equal(parsed.missingPhotos, true);
    assert.equal(parsed.missingLocation, true);
    assert.equal(parsed.priceMin, 100);
    assert.equal(parsed.priceMax, 999);
  });

  it("detects uuid and defaults to id mode when qMode missing", () => {
    const parsed = parseAdminListingsQuery({
      q: "dad2bb26-fe36-4096-b81a-f86d230f9b3d",
    });
    assert.equal(parsed.q, "dad2bb26-fe36-4096-b81a-f86d230f9b3d");
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
});
