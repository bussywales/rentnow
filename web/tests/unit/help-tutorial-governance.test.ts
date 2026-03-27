import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260327142608_help_tutorial_governance_and_seo.sql"
);

void test("tutorial governance docs make authored tutorials the default", () => {
  const readme = fs.readFileSync("docs/help/README.md", "utf8");
  const publishingGuide = fs.readFileSync("app/help/admin/help-publishing/page.tsx", "utf8");

  assert.match(readme, /Default to the authored tutorial platform at `\/admin\/help\/tutorials`/);
  assert.match(readme, /Use file-backed markdown when:/);
  assert.match(publishingGuide, /Tutorial-style help now defaults to the authored tutorial editor/);
  assert.match(publishingGuide, /Use \/admin\/help\/tutorials by default for new tutorials/);
});

void test("governance migration adds seo fields and seeds the admin listings tutorial", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.match(sql, /add column if not exists seo_title text/i);
  assert.match(sql, /add column if not exists meta_description text/i);
  assert.match(sql, /admin-listings-registry-video-tutorial/);
  assert.match(sql, /https:\/\/youtu\.be\/_jWHH5MQMAk/);
  assert.match(sql, /on conflict \(audience, slug\) do update/i);
});

void test("file-backed admin listings registry tutorial is retired after authored migration", () => {
  assert.equal(
    fs.existsSync("docs/help/admin/admin-listings-registry-video-tutorial.md"),
    false,
    "expected the old markdown tutorial to be removed after the authored migration"
  );
});

void test("admin help layout keeps internal tutorials non-indexable", () => {
  const layout = fs.readFileSync("app/help/admin/layout.tsx", "utf8");
  assert.match(layout, /robots:\s*\{/);
  assert.match(layout, /index:\s*false/);
  assert.match(layout, /follow:\s*false/);
});
