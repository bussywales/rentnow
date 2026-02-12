import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

type InitializeTransactionInput = {
  secretKey: string;
  amountMinor: number;
  email: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  currency?: string;
};

type VerifyTransactionResult = {
  ok: boolean;
  status: string;
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  authorizationCode: string | null;
  email: string | null;
  raw: Record<string, unknown> | null;
};

function readString(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed ? trimmed : null;
}

function getPaystackSecretKey() {
  return readString(process.env.PAYSTACK_SECRET_KEY);
}

export function getPaystackPublicKey() {
  return readString(process.env.PAYSTACK_PUBLIC_KEY);
}

export function getPaystackWebhookSecret() {
  return readString(process.env.PAYSTACK_WEBHOOK_SECRET) || getPaystackSecretKey();
}

export function hasPaystackServerEnv() {
  return Boolean(getPaystackSecretKey());
}

export function validateWebhookSignature(input: {
  rawBody: string;
  signature: string | null | undefined;
  secret: string | null | undefined;
}) {
  const signature = readString(input.signature);
  const secret = readString(input.secret);
  if (!signature || !secret) return false;
  const computed = crypto.createHmac("sha512", secret).update(input.rawBody).digest("hex");
  return computed === signature;
}

export async function initializeTransaction(input: InitializeTransactionInput) {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.secretKey}`,
    },
    body: JSON.stringify({
      amount: input.amountMinor,
      email: input.email,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata || {},
      currency: input.currency || "NGN",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: boolean;
        message?: string;
        data?: {
          authorization_url?: string;
          access_code?: string;
          reference?: string;
        } | null;
      }
    | null;

  if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
    const message = payload?.message || "Unable to initialize Paystack transaction.";
    throw new Error(message);
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code || null,
    reference: payload.data.reference || input.reference,
  };
}

export async function verifyTransaction(input: { secretKey: string; reference: string }): Promise<VerifyTransactionResult> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${input.secretKey}`,
      },
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        status?: boolean;
        message?: string;
        data?: {
          status?: string | null;
          amount?: number | null;
          currency?: string | null;
          paid_at?: string | null;
          customer?: { email?: string | null } | null;
          authorization?: { authorization_code?: string | null } | null;
        } | null;
      }
    | null;

  if (!response.ok || !payload?.status || !payload?.data) {
    const message = payload?.message || "Unable to verify Paystack transaction.";
    throw new Error(message);
  }

  const data = payload.data;
  return {
    ok: data.status === "success",
    status: data.status || "unknown",
    amountMinor: Number(data.amount || 0),
    currency: readString(data.currency) || "NGN",
    paidAt: readString(data.paid_at),
    authorizationCode: readString(data.authorization?.authorization_code),
    email: readString(data.customer?.email),
    raw: (payload as unknown as Record<string, unknown>) || null,
  };
}

export function getPaystackServerConfig() {
  return {
    secretKey: getPaystackSecretKey(),
    publicKey: getPaystackPublicKey(),
    webhookSecret: getPaystackWebhookSecret(),
  };
}
