import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin property requests pages expose analytics and moderation contracts", () => {
  const indexPage = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "requests", "page.tsx"),
    "utf8"
  );
  const detailPage = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "requests", "[id]", "page.tsx"),
    "utf8"
  );
  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "components", "admin", "AdminPropertyRequestModerationActions.tsx"),
    "utf8"
  );

  assert.match(indexPage, /Property requests/);
  assert.match(indexPage, /admin-requests-page/);
  assert.match(indexPage, /admin-requests-analytics/);
  assert.match(indexPage, /Zero-response/);
  assert.match(indexPage, /Responses sent/);
  assert.match(detailPage, /Admin inspection view for request moderation/);
  assert.match(detailPage, /PropertyRequestResponsesSection/);
  assert.match(detailPage, /Request controls/);
  assert.match(actionsSource, /Close request/);
  assert.match(actionsSource, /Expire request/);
  assert.match(actionsSource, /Remove request/);
  assert.match(actionsSource, /admin-property-request-moderation-actions/);
});
