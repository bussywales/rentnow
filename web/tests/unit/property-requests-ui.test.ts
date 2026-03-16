import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property requests pages expose discovery and owner management routes", () => {
  const indexPage = fs.readFileSync(
    path.join(process.cwd(), "app", "requests", "page.tsx"),
    "utf8"
  );
  const myPage = fs.readFileSync(path.join(process.cwd(), "app", "requests", "my", "page.tsx"), "utf8");
  const detailPage = fs.readFileSync(
    path.join(process.cwd(), "app", "requests", "[id]", "page.tsx"),
    "utf8"
  );
  const editPage = fs.readFileSync(
    path.join(process.cwd(), "app", "requests", "[id]", "edit", "page.tsx"),
    "utf8"
  );

  assert.match(indexPage, /Request discovery/);
  assert.match(indexPage, /property-request-discovery-board/);
  assert.match(indexPage, /Search city or area/);
  assert.match(myPage, /My requests/);
  assert.match(myPage, /Create property request/);
  assert.match(detailPage, /PropertyRequestManageActions/);
  assert.match(detailPage, /Back to request board/);
  assert.match(detailPage, /Seeker contact information remains private/);
  assert.match(editPage, /Edit property request/);
});

void test("property request form exposes draft publish and save-change actions", () => {
  const formSource = fs.readFileSync(
    path.join(process.cwd(), "components", "requests", "PropertyRequestFormClient.tsx"),
    "utf8"
  );

  assert.match(formSource, /Publish request/);
  assert.match(formSource, /Save draft/);
  assert.match(formSource, /Save changes/);
  assert.match(formSource, /property-request-form-actions/);
});

void test("property request manage actions keep publish pause and close labels together", () => {
  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "components", "requests", "PropertyRequestManageActions.tsx"),
    "utf8"
  );

  assert.match(actionsSource, /Pause request/);
  assert.match(actionsSource, /Close request/);
  assert.match(actionsSource, /Publish request/);
  assert.match(actionsSource, /property-request-manage-actions/);
});
