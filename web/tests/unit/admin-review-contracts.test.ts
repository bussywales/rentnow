import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_REVIEW_DETAIL_SELECT,
  ADMIN_REVIEW_IMAGE_SELECT,
  ADMIN_REVIEW_QUEUE_SELECT,
  ADMIN_REVIEW_VIDEO_SELECT,
} from "@/lib/admin/admin-review-contracts";
import {
  ADMIN_REVIEW_PROPERTIES_COLUMNS,
  ADMIN_REVIEW_IMAGE_COLUMNS,
  ADMIN_REVIEW_VIDEO_COLUMNS,
} from "@/lib/admin/admin-review-schema-allowlist";

const FORBIDDEN_QUEUE_TOKENS = ["photo_count", "has_cover", "cover_image_url", "property_images", "property_videos", "width", "height"];
const REQUIRED_QUEUE_FIELDS = ["id", "status", "updated_at"];

function parseColumns(select: string): string[] {
  return select
    .split(",")
    .map((part) => part.replace(/\(.*\)/, "").trim())
    .filter(Boolean);
}

void test("queue select excludes forbidden phantom columns", () => {
  const cols = parseColumns(ADMIN_REVIEW_QUEUE_SELECT);
  FORBIDDEN_QUEUE_TOKENS.forEach((token) => {
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
