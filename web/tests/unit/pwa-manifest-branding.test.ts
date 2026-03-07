import test from "node:test";
import assert from "node:assert/strict";
import manifest from "@/app/manifest";

void test("manifest keeps aligned splash colors and explicit icon purposes", () => {
  const metadata = manifest();

  assert.equal(metadata.theme_color, "#0f172a");
  assert.equal(metadata.background_color, "#f8fafc");

  const any192 = metadata.icons?.find((icon) => icon.src === "/icon-192.png");
  const any512 = metadata.icons?.find((icon) => icon.src === "/icon-512.png");
  const mask192 = metadata.icons?.find((icon) => icon.src === "/icon-192-maskable.png");
  const mask512 = metadata.icons?.find((icon) => icon.src === "/icon-512-maskable.png");

  assert.equal(any192?.purpose, "any");
  assert.equal(any512?.purpose, "any");
  assert.equal(mask192?.purpose, "maskable");
  assert.equal(mask512?.purpose, "maskable");
});
