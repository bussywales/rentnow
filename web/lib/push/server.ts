import webpush from "web-push";

if (typeof window !== "undefined") {
  throw new Error("Push server helpers are server-only.");
}

type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult =
  | { ok: true }
  | { ok: false; statusCode?: number; error: string };

export type PushConfig = {
  configured: boolean;
  publicKey: string | null;
  privateKey: string | null;
  subject: string;
};

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
}

export function getPushConfig(): PushConfig {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY || null;
  const subject =
    process.env.VAPID_SUBJECT ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://www.rentnow.space";
  return {
    configured: !!publicKey && !!privateKey,
    publicKey,
    privateKey,
    subject,
  };
}

export function buildPushSubscription(row: PushSubscriptionRow) {
  const keys: PushSubscriptionKeys = {
    p256dh: row.p256dh,
    auth: row.auth,
  };
  return {
    endpoint: row.endpoint,
    keys,
  };
}

export async function sendPushNotification(input: {
  subscription: PushSubscriptionRow;
  payload: Record<string, unknown>;
  ttlSeconds?: number;
}): Promise<PushSendResult> {
  const config = getPushConfig();
  if (!config.configured || !config.publicKey || !config.privateKey) {
    return { ok: false, error: "Push not configured" };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  try {
    await webpush.sendNotification(
      buildPushSubscription(input.subscription),
      JSON.stringify(input.payload),
      { TTL: input.ttlSeconds ?? 300 }
    );
    return { ok: true };
  } catch (err) {
    const statusCode =
      typeof err === "object" && err && "statusCode" in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : undefined;
    const message = err instanceof Error ? err.message : "Push delivery failed";
    return { ok: false, statusCode, error: message };
  }
}
