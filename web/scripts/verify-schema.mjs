const baseUrlRaw =
  process.env.VERIFY_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  "http://localhost:3000";
const baseUrl = baseUrlRaw.replace(/\/$/, "");

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL || "";
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const failures = [];

const log = (message) => {
  process.stdout.write(`${message}\n`);
};

const logError = (message) => {
  process.stderr.write(`${message}\n`);
};

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

async function checkHealth() {
  const { res, body } = await fetchJson(`${baseUrl}/api/health/deep`);
  if (!res.ok) {
    failures.push(`health check failed: ${res.status}`);
    logError(`health check failed: ${res.status}`);
    if (body?.error) logError(`health error: ${body.error}`);
    return;
  }
  log("health check: ok");
}

async function getAdminToken() {
  if (!adminEmail || !adminPassword) {
    log("debug/rls: skipped (PLAYWRIGHT_ADMIN_EMAIL/PASSWORD not set)");
    return null;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    log("debug/rls: skipped (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set)");
    return null;
  }

  const { res, body } = await fetchJson(
    `${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    }
  );

  if (!res.ok || !body?.access_token) {
    failures.push(`auth failed: ${res.status}`);
    logError(`auth failed: ${res.status}`);
    return null;
  }

  return body.access_token;
}

async function checkDebugRls() {
  const token = await getAdminToken();
  if (!token) return;

  const { res, body } = await fetchJson(`${baseUrl}/api/debug/rls`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok || !body?.ok) {
    failures.push(`debug/rls failed: ${res.status}`);
    logError(`debug/rls failed: ${res.status}`);
    if (body?.issues) logError(`debug/rls issues: ${body.issues.join(", ")}`);
    return;
  }

  log("debug/rls: ok");
}

await checkHealth();
await checkDebugRls();

if (failures.length) {
  logError(`verify-schema: FAIL (${failures.length} issue(s))`);
  process.exitCode = 1;
} else {
  log("verify-schema: PASS");
}
