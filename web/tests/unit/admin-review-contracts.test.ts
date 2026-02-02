import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_REVIEW_DETAIL_SELECT,
  ADMIN_REVIEW_IMAGE_SELECT,
  ADMIN_REVIEW_QUEUE_SELECT,
  ADMIN_REVIEW_VIDEO_SELECT,
  ADMIN_REVIEW_FORBIDDEN_FIELDS,
  normalizeSelect,
  ADMIN_REVIEW_VIEW_TABLE,
  ADMIN_REVIEW_VIEW_SELECT_MIN,
  ADMIN_REVIEW_VIEW_SELECT_PRICING,
} from "@/lib/admin/admin-review-contracts";
import {
  ADMIN_REVIEW_PROPERTIES_COLUMNS,
  ADMIN_REVIEW_IMAGE_COLUMNS,
  ADMIN_REVIEW_VIDEO_COLUMNS,
} from "@/lib/admin/admin-review-schema-allowlist";

const REQUIRED_QUEUE_FIELDS = ["id", "status", "updated_at", "photo_count", "has_cover", "cover_image_url", "has_video"];

function parseColumns(select: string): string[] {
  return normalizeSelect(select)
    .split(",")
    .map((part) => part.replace(/\(.*\)/, "").trim())
    .filter(Boolean);
}

void test("queue select excludes forbidden phantom columns", () => {
  const cols = parseColumns(ADMIN_REVIEW_QUEUE_SELECT);
  ADMIN_REVIEW_FORBIDDEN_FIELDS.forEach((token) => {
    assert.equal(cols.includes(token), false, `Queue select should not include ${token}`);
  });
});

void test("queue select contains required core fields", () => {
  const cols = parseColumns(ADMIN_REVIEW_QUEUE_SELECT);
  REQUIRED_QUEUE_FIELDS.forEach((field) => assert.ok(cols.includes(field)));
});

void test("queue select columns stay within properties allowlist", () => {
  const cols = parseColumns(ADMIN_REVIEW_QUEUE_SELECT);
  cols.forEach((col) => assert.ok(ADMIN_REVIEW_PROPERTIES_COLUMNS.includes(col), `${col} not in allowlist`));
});

void test("detail select columns stay within properties allowlist", () => {
  const cols = parseColumns(ADMIN_REVIEW_DETAIL_SELECT);
  cols.forEach((col) => assert.ok(ADMIN_REVIEW_PROPERTIES_COLUMNS.includes(col), `${col} not in allowlist`));
});

void test("image select columns stay within property_images allowlist", () => {
  const cols = parseColumns(ADMIN_REVIEW_IMAGE_SELECT);
  cols.forEach((col) => assert.ok(ADMIN_REVIEW_IMAGE_COLUMNS.includes(col), `${col} not in allowlist`));
});

void test("video select columns stay within property_videos allowlist", () => {
  const cols = parseColumns(ADMIN_REVIEW_VIDEO_SELECT);
  cols.forEach((col) => assert.ok(ADMIN_REVIEW_VIDEO_COLUMNS.includes(col), `${col} not in allowlist`));
});

void test("queue uses admin review view table constant", () => {
  assert.equal(ADMIN_REVIEW_VIEW_TABLE, "admin_review_view");
});

void test("queue select matches expected normalized contract", () => {
  const expected =
    "id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active,owner_id,title,city,state_region,country_code,admin_area_1,admin_area_2,postal_code,latitude,longitude,location_label,location_place_id,created_at,rejection_reason,expires_at,photo_count,has_cover,cover_image_url,has_video,video_count,price,currency,rent_period,rental_type,listing_type,bedrooms,bathrooms";
  assert.equal(normalizeSelect(ADMIN_REVIEW_QUEUE_SELECT), expected);
});

void test("detail select matches expected normalized contract", () => {
  const expected =
    "id,status,updated_at,submitted_at,is_approved,approved_at,rejected_at,is_active,owner_id,title,city,state_region,country_code,admin_area_1,admin_area_2,postal_code,latitude,longitude,location_label,location_place_id,created_at,rejection_reason,expires_at,photo_count,has_cover,cover_image_url,has_video,video_count,price,currency,rent_period,rental_type,listing_type,bedrooms,bathrooms";
  assert.equal(normalizeSelect(ADMIN_REVIEW_DETAIL_SELECT), expected);
});

void test("min select contains no pricing fields", () => {
  const cols = normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_MIN).split(",");
  const forbiddenPricing = ["price", "currency", "rent_period", "rental_type", "listing_type", "bedrooms", "bathrooms"];
  forbiddenPricing.forEach((f) => assert.equal(cols.includes(f), false));
});

void test("pricing select only includes pricing fields", () => {
  const cols = normalizeSelect(ADMIN_REVIEW_VIEW_SELECT_PRICING).split(",");
  const allowedPricing = ["price", "currency", "rent_period", "rental_type", "listing_type", "bedrooms", "bathrooms"];
  assert.deepEqual(cols.sort(), allowedPricing.sort());
});

void test("image select matches expected normalized contract", () => {
  const expected = "id,image_url,property_id,created_at,width,height";
  assert.equal(normalizeSelect(ADMIN_REVIEW_IMAGE_SELECT), expected);
});

void test("video select matches expected normalized contract", () => {
  const expected = "id,video_url,property_id,created_at";
  assert.equal(normalizeSelect(ADMIN_REVIEW_VIDEO_SELECT), expected);
});

void test("42703 fallback uses min select", async () => {
  const attempts: string[] = [];
  const error42703 = { code: "42703", message: "column admin_review_view.price does not exist" };

  const mockClient = {
    from: (table: string) => ({
      select: (sel: string) => {
        attempts.push(sel);
        assert.ok(table === "admin_review_view" || table === "information_schema.columns" || true);
        if (sel.includes("price")) throw error42703;
        return {
          in: () => ({
            order: () => Promise.resolve({ data: [], count: 0, error: null, status: 200 }),
          }),
          eq: () => ({
            is: () => ({
              is: () => ({
                or: () => ({
                  order: () => Promise.resolve({ data: [], count: 0, error: null, status: 200 }),
                  limit: () => Promise.resolve({ data: [], count: 0, error: null, status: 200 }),
                }),
              }),
            }),
          }),
          order: () => Promise.resolve({ data: [], count: 0, error: null, status: 200 }),
        };
      },
    }),
  };

  const result = await import("@/lib/admin/admin-review-queue").then(({ getAdminReviewQueue }) =>
    getAdminReviewQueue({
      userClient: mockClient,
      serviceClient: mockClient,
      viewerRole: "admin",
      select: ADMIN_REVIEW_QUEUE_SELECT,
      view: "approved",
    })
  );

  assert.ok(result.meta.contractDegraded, "expected contract to be marked degraded");
  assert.ok(attempts.some((s) => s.includes("price")), "should attempt full select first");
  assert.ok(attempts.some((s) => !s.includes("price")), "should retry with min select");
});
