import { createClient } from "@supabase/supabase-js";

const email = process.env.PLAYWRIGHT_USER_EMAIL;
const password = process.env.PLAYWRIGHT_USER_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!email || !password || !supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[cleanup-playwright] missing env. Required: PLAYWRIGHT_USER_EMAIL, PLAYWRIGHT_USER_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !authData.session?.user) {
    console.error("[cleanup-playwright] sign-in failed", signInError?.message);
    process.exit(1);
  }
  const userId = authData.session.user.id;

  const { data, error } = await supabase
    .from("viewing_requests")
    .delete()
    .eq("tenant_id", userId)
    .ilike("note", "%Playwright e2e test request%");

  if (error) {
    console.error("[cleanup-playwright] delete failed", error.message);
    process.exit(1);
  }

  const count = Array.isArray(data) ? data.length : 0;
  console.log(`[cleanup-playwright] removed ${count} test viewing requests`);
}

main().catch((err) => {
  console.error("[cleanup-playwright] unhandled error", err);
  process.exit(1);
});
