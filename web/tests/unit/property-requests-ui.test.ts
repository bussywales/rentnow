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
  const requestHelpers = fs.readFileSync(
    path.join(process.cwd(), "lib", "requests", "property-requests.ts"),
    "utf8"
  );
  const editPage = fs.readFileSync(
    path.join(process.cwd(), "app", "requests", "[id]", "edit", "page.tsx"),
    "utf8"
  );

  assert.match(indexPage, /Request discovery/);
  assert.match(indexPage, /property-request-discovery-board/);
  assert.match(indexPage, /Search title, city, or area/);
  assert.match(indexPage, /getPropertyRequestDisplayTitle/);
  assert.match(indexPage, /listPropertyRequestResponderBoardStates/);
  assert.match(indexPage, /getPropertyRequestResponderBoardStateLabel/);
  assert.match(indexPage, /getPropertyRequestBoardActionLabel/);
  assert.match(indexPage, /getPropertyRequestBriefStrengthLabel/);
  assert.match(indexPage, /getPropertyRequestFreshnessLabel/);
  assert.match(indexPage, /getPropertyRequestExpirySignalLabel/);
  assert.match(indexPage, /Bathrooms:/);
  assert.match(indexPage, /Manage request alerts/);
  assert.match(indexPage, /\/dashboard\/saved-searches#request-alerts/);
  assert.match(requestHelpers, /Review and send matches/);
  assert.match(requestHelpers, /View your sent matches/);
  assert.match(indexPage, /access\.role === "landlord" \|\| access\.role === "agent"/);
  assert.match(myPage, /My requests/);
  assert.match(myPage, /Marketplace progress/);
  assert.match(myPage, /Awaiting matches/);
  assert.match(myPage, /Create property request/);
  assert.match(myPage, /listPropertyRequestResponseSummaries/);
  assert.match(detailPage, /PropertyRequestManageActions/);
  assert.match(detailPage, /PropertyRequestResponseComposer/);
  assert.match(detailPage, /PropertyRequestResponsesSection/);
  assert.match(detailPage, /Response activity/);
  assert.match(detailPage, /savedState === "published"/);
  assert.match(detailPage, /Extend 30 days/);
  assert.match(detailPage, /keep this request live/i);
  assert.match(detailPage, /Back to request board/);
  assert.match(detailPage, /Seeker contact details remain private/);
  assert.match(detailPage, /Send matching listings/);
  assert.match(editPage, /Edit property request/);
});

void test("property request form exposes draft publish and save-change actions", () => {
  const formSource = fs.readFileSync(
    path.join(process.cwd(), "components", "requests", "PropertyRequestFormClient.tsx"),
    "utf8"
  );

  assert.match(formSource, /Publish request/);
  assert.match(formSource, /Request headline/);
  assert.match(formSource, /submitInFlightRef/);
  assert.match(formSource, /shouldShowPropertyRequestBedrooms/);
  assert.match(formSource, /Room counts are not needed for this request type/);
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

void test("property request response composer exposes matching listing actions", () => {
  const composerSource = fs.readFileSync(
    path.join(process.cwd(), "components", "requests", "PropertyRequestResponseComposer.tsx"),
    "utf8"
  );
  const responsesSource = fs.readFileSync(
    path.join(process.cwd(), "components", "requests", "PropertyRequestResponsesSection.tsx"),
    "utf8"
  );

  assert.match(composerSource, /Send matching listings/);
  assert.match(composerSource, /property-request-response-composer/);
  assert.match(composerSource, /up to 3 live listings/i);
  assert.match(responsesSource, /Received matches/);
  assert.match(responsesSource, /Your sent matches/);
  assert.match(responsesSource, /property-request-responses-section/);
});
