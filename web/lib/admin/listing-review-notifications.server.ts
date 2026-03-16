import { getSiteUrl } from "@/lib/env";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildAdminListingReviewEmail } from "@/lib/email/templates/admin-listing-review";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type AdminProfileRow = {
  id: string;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  listing_review_email_enabled?: boolean | null;
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
      eq: (column: string, value: string | boolean) => {
        eq: (
          column: string,
          value: string | boolean
        ) => Promise<{ data: AdminProfileRow[] | null; error: { message?: string | null } | null }>;
      };
    };
  };
};

export type ListingReviewNotificationInput = {
  propertyId: string;
  listingTitle: string | null;
  marketLabel?: string | null;
  propertyTypeLabel?: string | null;
  intentLabel?: string | null;
  ownerName?: string | null;
  submittedAt: string;
};

export type ListingReviewNotificationDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getSiteUrl: typeof getSiteUrl;
  loadOptedInAdminProfiles: (
    client: AdminProfileClient
  ) => Promise<AdminProfileRow[]>;
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

const defaultDeps: ListingReviewNotificationDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
  getSiteUrl,
  async loadOptedInAdminProfiles(client) {
    const { data } = await client
      .from("profiles")
      .select("id, role, display_name, full_name, listing_review_email_enabled")
      .eq("role", "admin")
      .eq("listing_review_email_enabled", true);
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

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatListingIntentLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "shortlet" || normalized === "short_let") return "Shortlet";
  if (normalized === "rent") return "Rent";
  if (normalized === "buy" || normalized === "sale") return "Buy";
  return toTitleCase(normalized);
}

export function formatListingPropertyTypeLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized ? toTitleCase(normalized) : null;
}

export async function notifyAdminsOfListingReviewSubmission(
  input: ListingReviewNotificationInput,
  deps: ListingReviewNotificationDeps = defaultDeps
) {
  if (!deps.hasServiceRoleEnv()) {
    return { ok: false as const, attempted: 0, sent: 0, skipped: 0, reason: "service_role_missing" };
  }

  const adminClient = deps.createServiceRoleClient();
  const profiles = await deps.loadOptedInAdminProfiles(
    adminClient as unknown as AdminProfileClient
  );
  if (profiles.length === 0) {
    return { ok: true as const, attempted: 0, sent: 0, skipped: 0 };
  }

  const siteUrl = await deps.getSiteUrl({ allowFallback: true });
  const reviewUrl = `${siteUrl.replace(/\/$/, "")}/admin/review/${encodeURIComponent(input.propertyId)}`;
  const baseEmail = buildAdminListingReviewEmail({
    listingTitle: String(input.listingTitle || "").trim() || "Untitled listing",
    marketLabel: input.marketLabel ?? null,
    propertyTypeLabel: input.propertyTypeLabel ?? null,
    intentLabel: input.intentLabel ?? null,
    ownerName: input.ownerName ?? null,
    submittedAt: input.submittedAt,
    reviewUrl,
  });

  let attempted = 0;
  let sent = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (profile.role !== "admin" || profile.listing_review_email_enabled !== true) {
      skipped += 1;
      continue;
    }
    const recipientEmail = await deps.getAdminEmail(
      adminClient as unknown as AdminEmailLookupClient,
      profile.id
    );
    if (!recipientEmail) {
      skipped += 1;
      continue;
    }
    attempted += 1;
    const result = await deps.sendEmail({
      to: recipientEmail,
      subject: baseEmail.subject,
      html: baseEmail.html,
    });
    if (result.ok) {
      sent += 1;
    }
  }

  return {
    ok: true as const,
    attempted,
    sent,
    skipped,
  };
}
