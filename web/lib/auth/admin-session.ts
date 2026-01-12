import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { logFailure } from "@/lib/observability";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type SupabaseDatabase = {
  public: {
    Tables: {
      profiles: Table<{
        role: string | null;
      }>;
      push_subscriptions: Table<{
        endpoint: string;
        p256dh: string;
        auth: string;
        profile_id: string;
        is_active: boolean;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
type SupabaseClient = ReturnType<typeof createClient<SupabaseDatabase, "public">>;

type ParsedSession = {
  access_token: string;
  refresh_token: string;
  [key: string]: unknown;
};

type RequireRoleResult =
  | { ok: true; supabase: SupabaseClient; user: User; role: UserRole }
  | { ok: false; response: NextResponse };

type RequireRoleInput = {
  request: Request;
  route: string;
  startTime: number;
  roles?: UserRole[];
};

const DEFAULT_ROLES: UserRole[] = ["admin"];

const getEnv = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

function decodeBase64Url(value: string): string | null {
  try {
    const padded = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function parseJsonSession(raw: string): ParsedSession | null {
  try {
    const parsed = JSON.parse(raw) as ParsedSession;
    if (
      parsed &&
      typeof parsed.access_token === "string" &&
      typeof parsed.refresh_token === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseSupabaseAuthCookieValue(
  value: string
): ParsedSession | null {
  const candidates: string[] = [];

  if (value.startsWith("base64-")) {
    const decoded = decodeBase64Url(value.slice("base64-".length));
    if (decoded) candidates.push(decoded);
  }

  if (value.startsWith("{")) {
    candidates.push(value);
  }

  if (value.includes("%")) {
    try {
      const decoded = decodeURIComponent(value);
      candidates.push(decoded);
    } catch {
      /* ignore decode errors */
    }
  }

  if (/^[A-Za-z0-9_-]+$/.test(value)) {
    const decoded = decodeBase64Url(value);
    if (decoded) candidates.push(decoded);
  }

  for (const candidate of candidates) {
    const parsed = parseJsonSession(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function parseCookieHeader(header: string): Array<{ name: string; value: string }> {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return { name: part, value: "" };
      return { name: part.slice(0, idx), value: part.slice(idx + 1) };
    });
}

export function extractAuthSessionFromRequest(request: Request): {
  session: ParsedSession | null;
  parseError: boolean;
} {
  const header = request.headers.get("cookie");
  if (!header) {
    return { session: null, parseError: false };
  }

  const cookies = parseCookieHeader(header);
  const authCookies = cookies.filter((cookie) =>
    cookie.name.includes("auth-token")
  );

  let parseError = false;
  for (const cookie of authCookies) {
    const session = parseSupabaseAuthCookieValue(cookie.value);
    if (session) {
      return { session, parseError: false };
    }
    parseError = true;
  }

  return { session: null, parseError };
}

function deny({
  request,
  route,
  startTime,
  status,
  reason,
}: {
  request: Request;
  route: string;
  startTime: number;
  status: 401 | 403 | 500;
  reason: string;
}) {
  logFailure({
    request,
    route,
    status,
    startTime,
    level: "warn",
    error: `deny:${reason}`,
  });
  const message = status === 401 ? "Unauthorized" : "Forbidden";
  return NextResponse.json({ error: message }, { status });
}

export async function requireAdminRole({
  request,
  route,
  startTime,
  roles = DEFAULT_ROLES,
}: RequireRoleInput): Promise<RequireRoleResult> {
  const env = getEnv();
  if (!env) {
    return { ok: false, response: deny({ request, route, startTime, status: 500, reason: "env_missing" }) };
  }

  const { session, parseError } = extractAuthSessionFromRequest(request);
  if (parseError) {
    return { ok: false, response: deny({ request, route, startTime, status: 401, reason: "invalid_cookie" }) };
  }

  const supabase = createClient<SupabaseDatabase, "public">(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  if (session) {
    try {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } catch {
      return { ok: false, response: deny({ request, route, startTime, status: 401, reason: "session_set_failed" }) };
    }
  }

  const {
    data: { session: activeSession },
  } = await supabase.auth.getSession();
  let user = activeSession?.user ?? null;

  if (!user) {
    const {
      data: { session: refreshedSession },
    } = await supabase.auth.refreshSession();
    user = refreshedSession?.user ?? null;
  }

  if (!user) {
    const {
      data: { user: fallbackUser },
    } = await supabase.auth.getUser();
    user = fallbackUser ?? null;
  }

  if (!user) {
    return { ok: false, response: deny({ request, route, startTime, status: 401, reason: "missing_user" }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = normalizeRole(profile?.role) ?? null;

  if (!role) {
    return { ok: false, response: deny({ request, route, startTime, status: 403, reason: "role_missing" }) };
  }

  if (!roles.includes(role)) {
    return { ok: false, response: deny({ request, route, startTime, status: 403, reason: "role_forbidden" }) };
  }

  return { ok: true, supabase, user, role };
}
