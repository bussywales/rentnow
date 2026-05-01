import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

void test("admin request surfaces expose dispatch progress and operator outcome controls", () => {
  const listSource = read("app/admin/services/requests/page.tsx");
  const detailSource = read("app/admin/services/requests/[id]/page.tsx");
  const outcomeSource = read("components/services/AdminMoveReadyOutcomeForm.tsx");
  const hubSource = read("app/admin/services/page.tsx");

  assert.match(listSource, /getMoveReadyRequestProgressLabel/);
  assert.match(listSource, /Operator decision needed/);
  assert.match(detailSource, /Operator outcome/);
  assert.match(detailSource, /Indicative quote/);
  assert.match(outcomeSource, /Award request/);
  assert.match(outcomeSource, /Close as no match/);
  assert.match(hubSource, /Operational movement/);
  assert.match(hubSource, /Awaiting operator decision/);
});

void test("provider response surface supports quote summary and need-more-information flow", () => {
  const responsePageSource = read("app/services/respond/[token]/page.tsx");
  const responseFormSource = read("components/services/MoveReadyProviderResponseForm.tsx");

  assert.match(responseFormSource, /Need more information/);
  assert.match(responseFormSource, /Indicative quote or range/);
  assert.match(responsePageSource, /existingQuoteSummary/);
});

void test("host request detail keeps PropatyHub as intermediary and avoids direct supplier contact reveal", () => {
  const hostDetailSource = read("app/host/services/requests/[id]/page.tsx");

  assert.match(hostDetailSource, /PropatyHub remains the intermediary/);
  assert.doesNotMatch(hostDetailSource, /move_ready_service_providers\?\.email/);
  assert.doesNotMatch(hostDetailSource, /move_ready_service_providers\?\.phone/);
});
