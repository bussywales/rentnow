import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PRIVATE_NAME_PATTERN = /\b(first_name|last_name)\b/;

const PUBLIC_SURFACE_FILES = [
  path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
  path.join(process.cwd(), "app", "agents", "[slug]", "page.tsx"),
  path.join(process.cwd(), "app", "u", "[id]", "page.tsx"),
  path.join(process.cwd(), "components", "properties", "PropertyCard.tsx"),
  path.join(process.cwd(), "components", "advertisers", "PublicAdvertiserProfilePage.tsx"),
  path.join(process.cwd(), "lib", "advertisers", "public-profile.ts"),
];

void test("public surfaces do not reference private profile name fields", () => {
  for (const filePath of PUBLIC_SURFACE_FILES) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(
      PRIVATE_NAME_PATTERN.test(source),
      false,
      `Expected no private name field usage in ${filePath}`
    );
  }
});

void test("private name fields remain scoped to profile settings and profile helper", () => {
  const profileForm = fs.readFileSync(
    path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx"),
    "utf8"
  );
  assert.equal(PRIVATE_NAME_PATTERN.test(profileForm), true);

  const profileHelper = fs.readFileSync(
    path.join(process.cwd(), "lib", "profile", "ensure-profile.ts"),
    "utf8"
  );
  assert.equal(PRIVATE_NAME_PATTERN.test(profileHelper), true);
});
