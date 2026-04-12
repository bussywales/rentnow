import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildSupportTicketNotificationEmail } from "@/lib/email/templates/support-ticket-notification";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type AdminProfileRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  support_request_email_enabled?: boolean | null;
  support_escalation_email_enabled?: boolean | null;
};

type AdminEmailLookupClient = {
  auth: {
    admin: {
      getUserById: (
        userId: string
      ) => Promise<{ data?: { user?: { email?: string | null } | null } | null }>;
    };
  };
};

type AdminProfileClient = {
  from: (table: "profiles") => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string | boolean
      ) => Promise<{ data: AdminProfileRow[] | null; error: { message?: string | null } | null }>;
    };
  };
};

export type SupportTicketNotificationInput = {
  requestId: string;
  category: string;
  role: string;
  name: string | null;
  email: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  escalated: boolean;
};

export type SupportTicketNotificationDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSiteUrl: typeof getSiteUrl;
  loadAdminProfiles: (client: AdminProfileClient) => Promise<AdminProfileRow[]>;
  getAdminEmail: (
    client: AdminEmailLookupClient,
    userId: string
  ) => Promise<string | null>;
  sendEmail: (input: {
    to: string;
    subject: string;
    html: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

const defaultDeps: SupportTicketNotificationDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getSiteUrl,
  async loadAdminProfiles(client) {
    const { data } = await client
      .from("profiles")
      .select(
        "id, role, display_name, full_name, support_request_email_enabled, support_escalation_email_enabled"
      )
      .eq("role", "admin");
    return Array.isArray(data) ? data : [];
  },
  async getAdminEmail(client, userId) {
    const response = await client.auth.admin.getUserById(userId);
    const email = response.data?.user?.email ?? null;
    const normalized = String(email || "").trim();
    return normalized || null;
  },
  async sendEmail(input) {
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
  },
};

function shouldNotifyProfile(profile: AdminProfileRow, escalated: boolean) {
  if (profile.role !== "admin") return false;
  if (profile.support_request_email_enabled === true) return true;
  return escalated && profile.support_escalation_email_enabled === true;
}

export async function notifyAdminsOfSupportTicket(
  input: SupportTicketNotificationInput,
  deps: SupportTicketNotificationDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return { ok: false as const, attempted: 0, sent: 0, skipped: 0, reason: "service_role_missing" };
  }

  const adminClient = deps.createServiceRoleClient();
  const profiles = await deps.loadAdminProfiles(adminClient as unknown as AdminProfileClient);
  const recipients = profiles.filter((profile) => shouldNotifyProfile(profile, input.escalated));

  if (recipients.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: profiles.length };
  }

  const siteUrl = await deps.getSiteUrl({ allowFallback: true });
  const queueUrl = `${siteUrl.replace(/\/$/, "")}/admin/support`;
  const email = buildSupportTicketNotificationEmail({
    requestId: input.requestId,
    category: input.category,
    role: input.role,
    name: input.name,
    email: input.email,
    message: input.message,
    metadata: input.metadata ?? null,
    queueUrl,
    escalated: input.escalated,
  });

  let attempted = 0;
  let sent = 0;
  let skipped = profiles.length - recipients.length;

  for (const recipient of recipients) {
    const recipientEmail = await deps.getAdminEmail(
      adminClient as unknown as AdminEmailLookupClient,
      recipient.id
    );
    if (!recipientEmail) {
      skipped += 1;
      continue;
    }
    attempted += 1;
    const result = await deps.sendEmail({
      to: recipientEmail,
      subject: email.subject,
      html: email.html,
    });
    if (result.ok) sent += 1;
  }

  return {
    ok: true as const,
    attempted,
    sent,
    skipped,
  };
}
