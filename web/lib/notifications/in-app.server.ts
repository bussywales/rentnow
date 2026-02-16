import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export type InAppNotificationType =
  | "shortlet_booking_request_sent"
  | "shortlet_booking_approved"
  | "shortlet_booking_declined"
  | "shortlet_booking_instant_confirmed"
  | "shortlet_booking_host_update";

export type InAppNotificationInput = {
  userId: string | null;
  type: InAppNotificationType;
  title: string;
  body: string;
  href: string;
  dedupeKey: string;
};

type NotificationInsertClient = {
  from: (table: "notifications") => {
    insert: (
      row: {
        user_id: string;
        type: string;
        title: string;
        body: string;
        href: string;
        dedupe_key: string;
        is_read: boolean;
      }
    ) => Promise<{ error: { code?: string | null; message?: string | null } | null }>;
  };
};

export type CreateInAppNotificationDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
};

const defaultDeps: CreateInAppNotificationDeps = {
  hasServiceRoleEnv,
  createServiceRoleClient,
};

export async function createInAppNotification(
  input: InAppNotificationInput,
  deps: CreateInAppNotificationDeps = defaultDeps
) {
  if (!input.userId) return { inserted: false, duplicate: false };
  if (!deps.hasServiceRoleEnv()) return { inserted: false, duplicate: false };

  try {
    const client = deps.createServiceRoleClient() as unknown as NotificationInsertClient;
    const { error } = await client.from("notifications").insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      dedupe_key: input.dedupeKey,
      is_read: false,
    });

    if (!error) return { inserted: true, duplicate: false };
    if (error.code === "23505") return { inserted: false, duplicate: true };

    console.warn("Unable to insert in-app notification", {
      dedupeKey: input.dedupeKey,
      message: error.message || "insert_failed",
    });
    return { inserted: false, duplicate: false };
  } catch (error) {
    console.warn("Unable to insert in-app notification", {
      dedupeKey: input.dedupeKey,
      message: error instanceof Error ? error.message : "insert_failed",
    });
    return { inserted: false, duplicate: false };
  }
}

function formatMoney(amountMinor: number, currency: string) {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

export function buildShortletNotificationBody(input: {
  checkIn: string;
  checkOut: string;
  nights: number;
  amountMinor: number;
  currency: string;
}) {
  const nightsLabel = `${input.nights} night${input.nights === 1 ? "" : "s"}`;
  const totalLabel = formatMoney(input.amountMinor, input.currency);
  return `${input.checkIn} to ${input.checkOut} · ${nightsLabel} · ${totalLabel}`;
}
