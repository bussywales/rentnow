import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("root layout batches app settings reads for startup", () => {
  const filePath = path.join(process.cwd(), "app", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /getAppSettingsMap\(\[\.\.\.ROOT_LAYOUT_SETTING_KEYS\], supabase\)/);
  assert.match(source, /Promise\.all\(\[\s*getAppSettingsMap\(/);
  assert.doesNotMatch(source, /\bgetAppSettingBool\(/);
});

void test("root layout seeds nav auth from refresh-capable server session resolution", () => {
  const filePath = path.join(process.cwd(), "app", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /import \{ getServerAuthUser \} from "@\/lib\/auth\/server-session"/);
  assert.match(source, /const \{ supabase, user \} = await getServerAuthUser\(\)/);
  assert.doesNotMatch(source, /supabase\.auth\.getUser\(/);
});

void test("main nav remains lightweight without server-side data fetch awaits", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "MainNav.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.doesNotMatch(source, /\basync function MainNav\b/);
  assert.doesNotMatch(source, /createServerSupabaseClient/);
  assert.doesNotMatch(source, /fetchHostAwaitingApprovalBookingsCount/);
  assert.doesNotMatch(source, /supabase\.auth\.getUser\(/);
});
