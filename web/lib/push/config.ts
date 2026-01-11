export type PushConfigStatus = {
  configured: boolean;
  publicKey: string | null;
  privateKey: string | null;
  subject: string;
  missingKeys: string[];
};

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
}

export function getPushConfigStatus(): PushConfigStatus {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY || null;
  const subject =
    process.env.VAPID_SUBJECT ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://www.rentnow.space";

  const missingKeys: string[] = [];
  if (!publicKey) {
    missingKeys.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PUBLIC_KEY");
  }
  if (!privateKey) {
    missingKeys.push("VAPID_PRIVATE_KEY");
  }

  return {
    configured: !!publicKey && !!privateKey,
    publicKey,
    privateKey,
    subject,
    missingKeys,
  };
}
