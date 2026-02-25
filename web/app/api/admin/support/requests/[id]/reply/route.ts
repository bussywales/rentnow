import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { buildSupportReplyEmail } from "@/lib/email/templates/support-reply";
import { getSupportCannedReplyTemplate } from "@/lib/support/canned-replies";

const routeLabel = "/api/admin/support/requests/[id]/reply";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  templateId: z.string().max(80).optional().nullable(),
  subject: z.string().min(3).max(220),
  body: z.string().min(10).max(8000),
});

type SupportRequestRow = {
  id: string;
  email: string | null;
  name: string | null;
  metadata: Record<string, unknown> | null;
};

type ReplyAuditEntry = {
  event: "reply_sent";
  sentAt: string;
  subject: string;
  templateId: string | null;
  sentBy: string;
};

export type AdminSupportReplyDeps = {
  requireRole: typeof requireRole;
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  createServiceRoleClient: typeof createServiceRoleClient;
  now: () => Date;
  loadRequest: (client: UntypedAdminClient, id: string) => Promise<SupportRequestRow | null>;
  updateRequestMetadata: (
    client: UntypedAdminClient,
    id: string,
    metadata: Record<string, unknown>
  ) => Promise<SupportRequestRow | null>;
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<{ ok: boolean; error?: string }>;
};

async function sendEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "resend_not_configured" };

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "PropatyHub <no-reply@propatyhub.com>",
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  }).catch(() => null);

  if (!response) return { ok: false, error: "resend_request_failed" };
  if (!response.ok) return { ok: false, error: `resend_${response.status}` };
  return { ok: true };
}

const defaultDeps: AdminSupportReplyDeps = {
  requireRole,
  hasServerSupabaseEnv,
  hasServiceRoleEnv,
  createServerSupabaseClient,
  createServiceRoleClient,
  now: () => new Date(),
  async loadRequest(client, id) {
    const { data, error } = await client
      .from<SupportRequestRow>("support_requests")
      .select("id,email,name,metadata")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      metadata:
        data.metadata && typeof data.metadata === "object"
          ? (data.metadata as Record<string, unknown>)
          : {},
    };
  },
  async updateRequestMetadata(client, id, metadata) {
    const { data, error } = await client
      .from<SupportRequestRow>("support_requests")
      .update({ metadata })
      .eq("id", id)
      .select("id,email,name,metadata")
      .maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      metadata:
        data.metadata && typeof data.metadata === "object"
          ? (data.metadata as Record<string, unknown>)
          : {},
    };
  },
  sendEmail,
};

function toReplyHistory(metadata: Record<string, unknown>) {
  const current = metadata.replyHistory;
  if (!Array.isArray(current)) return [] as ReplyAuditEntry[];
  return current
    .filter((item): item is ReplyAuditEntry => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        record.event === "reply_sent" &&
        typeof record.sentAt === "string" &&
        typeof record.subject === "string" &&
        (typeof record.templateId === "string" || record.templateId === null) &&
        typeof record.sentBy === "string"
      );
    })
    .slice(-19);
}

export function appendSupportReplyMetadata(input: {
  metadata: Record<string, unknown> | null | undefined;
  entry: ReplyAuditEntry;
}) {
  const base = input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {};
  const replyHistory = [...toReplyHistory(base), input.entry];

  return {
    ...base,
    lastReplyAt: input.entry.sentAt,
    lastReplySubject: input.entry.subject,
    lastReplyTemplateId: input.entry.templateId,
    lastReplyBy: input.entry.sentBy,
    replyHistory,
  };
}

export async function postAdminSupportRequestReplyResponse(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
  deps: AdminSupportReplyDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Support request id is required." }, { status: 422 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 422 });
  }

  const db = deps.hasServiceRoleEnv()
    ? (deps.createServiceRoleClient() as unknown as UntypedAdminClient)
    : ((await deps.createServerSupabaseClient()) as unknown as UntypedAdminClient);

  const row = await deps.loadRequest(db, id);
  if (!row) {
    return NextResponse.json({ error: "Support request not found." }, { status: 404 });
  }

  const recipientEmail = String(row.email || "").trim();
  if (!recipientEmail) {
    return NextResponse.json({ error: "Requester email is required before sending a reply." }, { status: 422 });
  }

  const subject = parsed.data.subject.trim();
  const body = parsed.data.body.trim();
  const requestedTemplateId = String(parsed.data.templateId || "").trim();
  const resolvedTemplateId = getSupportCannedReplyTemplate(requestedTemplateId)?.id ?? null;

  const emailTemplate = buildSupportReplyEmail({
    requestId: row.id,
    recipientName: row.name,
    subject,
    body,
  });
  const emailResult = await deps.sendEmail({
    to: recipientEmail,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
  });

  if (!emailResult.ok) {
    return NextResponse.json(
      {
        error: "Unable to send support reply email.",
        code: emailResult.error || "email_failed",
      },
      { status: 502 }
    );
  }

  const sentAt = deps.now().toISOString();
  const metadata = appendSupportReplyMetadata({
    metadata: row.metadata,
    entry: {
      event: "reply_sent",
      sentAt,
      subject,
      templateId: resolvedTemplateId,
      sentBy: auth.user.id,
    },
  });
  const updated = await deps.updateRequestMetadata(db, row.id, metadata);
  if (!updated) {
    return NextResponse.json({ error: "Reply sent but audit metadata update failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      email: updated.email,
      metadata: updated.metadata || {},
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return postAdminSupportRequestReplyResponse(request, context, defaultDeps);
}
