import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type VerificationStatus = {
  email: { verified: boolean; verifiedAt?: string | null };
  phone: { verified: boolean; verifiedAt?: string | null; phoneE164?: string | null };
  bank: { verified: boolean; verifiedAt?: string | null; provider?: string | null };
  overall: "verified" | "pending";
};

export type VerificationStatusResult = VerificationStatus & {
  userId: string;
  updated: boolean;
};

export function computeVerificationStatus(input: {
  userId: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  phoneE164: string | null;
  bankVerifiedAt: string | null;
  bankProvider: string | null;
}): VerificationStatusResult {
  const emailVerified = !!input.emailVerifiedAt;
  const phoneVerified = !!input.phoneVerifiedAt;
  const bankVerified = !!input.bankVerifiedAt;
  const overall = emailVerified && phoneVerified ? "verified" : "pending";

  return {
    userId: input.userId,
    updated: false,
    overall,
    email: { verified: emailVerified, verifiedAt: input.emailVerifiedAt ?? null },
    phone: {
      verified: phoneVerified,
      verifiedAt: input.phoneVerifiedAt ?? null,
      phoneE164: input.phoneE164 ?? null,
    },
    bank: {
      verified: bankVerified,
      verifiedAt: input.bankVerifiedAt ?? null,
      provider: input.bankProvider ?? null,
    },
  };
}

export async function getVerificationStatus(input: {
  userId: string;
}): Promise<VerificationStatusResult> {
  const supabase = await createServerSupabaseClient();
  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;

  const { data: verifications } = await client
    .from("user_verifications")
    .select("email_verified_at, phone_verified_at, phone_e164, bank_verified_at, bank_provider")
    .eq("user_id", input.userId)
    .maybeSingle();

  let emailVerifiedAt = verifications?.email_verified_at ?? null;
  const phoneVerifiedAt = verifications?.phone_verified_at ?? null;
  const bankVerifiedAt = verifications?.bank_verified_at ?? null;
  const phoneE164 = verifications?.phone_e164 ?? null;
  const bankProvider = verifications?.bank_provider ?? null;

  let updated = false;

  if (hasServiceRoleEnv()) {
    type AdminUpdateBuilder = {
      eq: (column: string, value: string | boolean) => AdminUpdateBuilder;
      neq: (column: string, value: boolean) => AdminUpdateBuilder;
      not: (column: string, operator: string, value: boolean) => AdminUpdateBuilder;
    };
    type AdminClient = {
      auth: { admin: { getUserById: (id: string) => Promise<{ data?: { user?: { email_confirmed_at?: string | null } } }> } };
      from: (table: string) => {
        upsert: (values: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<unknown>;
        update: (values: Record<string, unknown>) => AdminUpdateBuilder;
      };
    };

    const admin = createServiceRoleClient() as unknown as AdminClient;
    const { data: authUser } = await admin.auth.admin.getUserById(input.userId);
    const confirmedAt = authUser?.user?.email_confirmed_at ?? null;

    if (confirmedAt !== emailVerifiedAt) {
      emailVerifiedAt = confirmedAt;
      updated = true;
      await admin
        .from("user_verifications")
        .upsert({
          user_id: input.userId,
          email_verified_at: confirmedAt,
        }, { onConflict: "user_id" });

      await admin
        .from("profiles")
        .update({ email_verified: !!confirmedAt })
        .eq("id", input.userId);
    }

    if (phoneVerifiedAt) {
      await admin
        .from("profiles")
        .update({ phone_verified: true })
        .eq("id", input.userId)
        .neq("phone_verified", true);
    }

    if (bankVerifiedAt !== null) {
      await admin
        .from("profiles")
        .update({ bank_verified: !!bankVerifiedAt })
        .eq("id", input.userId)
        .neq("bank_verified", !!bankVerifiedAt);
    }
  }

  const result = computeVerificationStatus({
    userId: input.userId,
    emailVerifiedAt,
    phoneVerifiedAt,
    phoneE164,
    bankVerifiedAt,
    bankProvider,
  });

  return { ...result, updated };
}

export function deriveOverallStatus(status: Pick<VerificationStatus, "email" | "phone">): "verified" | "pending" {
  return status.email.verified && status.phone.verified ? "verified" : "pending";
}
