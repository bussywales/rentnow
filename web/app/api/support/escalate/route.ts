import { NextResponse } from "next/server";
import { z } from "zod";
import { BRAND_SUPPORT_EMAIL } from "@/lib/brand";
import { buildSupportEscalationEmail } from "@/lib/email/templates/support-escalation";
import { normalizeRole } from "@/lib/roles";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const bodySchema = z.object({
  category: z.enum(["general", "account", "listing", "safety", "billing"]).default("general"),
  name: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  role: z.string().max(60).optional().nullable(),
  message: z.string().min(10).max(5000),
  pageUrl: z.string().url().optional().nullable(),
  bookingId: z.string().max(120).optional().nullable(),
  propertyId: z.string().max(120).optional().nullable(),
  paymentRef: z.string().max(120).optional().nullable(),
  escalationReason: z.string().max(120).optional().nullable(),
  aiTranscript: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(60)
    .optional()
    .default([]),
});

type SupportRequestClient = {
  from: (table: "support_requests") => {
    insert: (
      row: Record<string, unknown>
    ) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: { id?: string | null } | null; error: { message?: string | null } | null }>;
      };
    };
  };
};

export type SupportEscalateDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  getServerAuthUser: typeof getServerAuthUser;
  now: () => Date;
  sendSupportEscalationEmail: (input: {
    requestId: string;
    category: string;
    role: string;
    name: string | null;
    email: string | null;
    message: string;
    metadata: Record<string, unknown>;
  }) => Promise<{ ok: boolean; error?: string }>;
};

async function sendSupportEscalationEmail(input: {
  requestId: string;
  category: string;
  role: string;
  name: string | null;
  email: string | null;
  message: string;
  metadata: Record<string, unknown>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "resend_not_configured" };

  const { subject, html } = buildSupportEscalationEmail(input);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
      to: BRAND_SUPPORT_EMAIL,
      subject,
      html,
    }),
  }).catch(() => null);

  if (!response) return { ok: false, error: "resend_request_failed" };
  if (!response.ok) return { ok: false, error: `resend_${response.status}` };
  return { ok: true };
}

const defaultDeps: SupportEscalateDeps = {
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  getServerAuthUser,
  now: () => new Date(),
  sendSupportEscalationEmail,
};

async function insertSupportRequest(
  client: SupportRequestClient,
  payload: {
    userId: string | null;
    category: string;
    name: string | null;
    email: string;
    message: string;
    metadata: Record<string, unknown>;
  }
) {
  const primary = await client
    .from("support_requests")
    .insert({
      user_id: payload.userId,
      category: payload.category,
      name: payload.name,
      email: payload.email,
      message: payload.message,
      status: "new",
      metadata: payload.metadata,
    })
    .select("id")
    .maybeSingle();

  if (!primary.error) return primary;
  const message = String(primary.error.message || "");
  if (!message.toLowerCase().includes("metadata")) {
    return primary;
  }

  // Fallback when metadata column has not been applied yet.
  return client
    .from("support_requests")
    .insert({
      user_id: payload.userId,
      category: payload.category,
      name: payload.name,
      email: payload.email,
      message: `${payload.message}\n\nContext: ${JSON.stringify(payload.metadata)}`,
      status: "new",
    })
    .select("id")
    .maybeSingle();
}

export async function postSupportEscalateResponse(
  request: Request,
  deps: SupportEscalateDeps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Support is unavailable." }, { status: 503 });
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const auth = await deps.getServerAuthUser();
  const user = auth.user;
  const authedSupabase = auth.supabase as unknown as {
    from: (table: "profiles") => {
      select: (columns: string) => {
        eq: (column: "id", value: string) => {
          maybeSingle: () => Promise<{ data: { full_name?: string | null; role?: string | null } | null }>;
        };
      };
    };
  };

  let profile: { full_name?: string | null; role?: string | null } | null = null;
  if (user?.id) {
    const profileResponse = await authedSupabase
      .from("profiles")
      .select("full_name,role")
      .eq("id", user.id)
      .maybeSingle();
    profile = profileResponse.data ?? null;
  }

  const resolvedEmail = (body.data.email ?? user?.email ?? "").trim();
  if (!resolvedEmail) {
    return NextResponse.json({ error: "Email is required for escalation." }, { status: 400 });
  }

  const resolvedRole = normalizeRole(body.data.role ?? profile?.role) ?? (user ? "tenant" : "guest");
  const resolvedName = (body.data.name ?? profile?.full_name ?? "").trim() || null;
  const message = body.data.message.trim();
  const metadata: Record<string, unknown> = {
    pageUrl: body.data.pageUrl ?? null,
    bookingId: body.data.bookingId ?? null,
    propertyId: body.data.propertyId ?? null,
    paymentRef: body.data.paymentRef ?? null,
    escalationReason: body.data.escalationReason ?? null,
    aiTranscript: body.data.aiTranscript ?? [],
    submittedAt: deps.now().toISOString(),
  };

  const dbClient = (deps.hasServiceRoleEnv()
    ? deps.createServiceRoleClient()
    : await deps.createServerSupabaseClient()) as unknown as SupportRequestClient;

  const insertResult = await insertSupportRequest(dbClient, {
    userId: user?.id ?? null,
    category: body.data.category,
    name: resolvedName,
    email: resolvedEmail,
    message,
    metadata,
  });

  if (insertResult.error) {
    return NextResponse.json(
      { error: insertResult.error.message || "Unable to create support request." },
      { status: 400 }
    );
  }

  const requestId = String(insertResult.data?.id || "");
  const emailResult = await deps.sendSupportEscalationEmail({
    requestId,
    category: body.data.category,
    role: resolvedRole,
    name: resolvedName,
    email: resolvedEmail,
    message,
    metadata,
  });

  return NextResponse.json({
    ok: true,
    requestId,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? null : emailResult.error || "email_failed",
  });
}

export async function POST(request: Request) {
  return postSupportEscalateResponse(request, defaultDeps);
}

