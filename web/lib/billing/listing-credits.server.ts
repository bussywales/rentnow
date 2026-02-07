import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";

export type ConsumeListingCreditResult =
  | {
      ok: true;
      consumed: boolean;
      source: string | null;
      creditId: string | null;
      idempotencyKey: string | null;
      alreadyConsumed?: boolean;
    }
  | { ok: false; reason: string };

type RpcResult = {
  ok?: boolean;
  consumed?: boolean;
  source?: string | null;
  credit_id?: string | null;
  idempotency_key?: string | null;
  already_consumed?: boolean;
  reason?: string | null;
};

export async function consumeListingCredit({
  client,
  userId,
  listingId,
  idempotencyKey,
}: {
  client: SupabaseClient;
  userId: string;
  listingId: string;
  idempotencyKey: string;
}): Promise<ConsumeListingCreditResult> {
  const { data, error } = await client.rpc("consume_listing_credit", {
    in_user_id: userId,
    in_listing_id: listingId,
    in_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { ok: false, reason: error.message };
  }

  const payload = (data ?? {}) as RpcResult;
  if (!payload.ok) {
    return { ok: false, reason: payload.reason ?? "NO_CREDITS" };
  }

  return {
    ok: true,
    consumed: payload.consumed ?? false,
    source: payload.source ?? null,
    creditId: payload.credit_id ?? null,
    idempotencyKey: payload.idempotency_key ?? null,
    alreadyConsumed: payload.already_consumed ?? false,
  };
}

export async function issueTrialCreditsIfEligible({
  client,
  userId,
  role,
  credits,
}: {
  client: SupabaseClient;
  userId: string;
  role: UserRole;
  credits: number;
}): Promise<{ issued: boolean }> {
  if (!credits || credits <= 0) return { issued: false };
  if (!userId) return { issued: false };
  if (role !== "agent" && role !== "landlord") return { issued: false };

  const { data: existing } = await client
    .from("listing_credits")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "trial")
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { issued: false };
  }

  const now = new Date().toISOString();
  const { error } = await client.from("listing_credits").insert({
    user_id: userId,
    source: "trial",
    credits_total: credits,
    credits_used: 0,
    created_at: now,
    updated_at: now,
  });

  if (error) {
    return { issued: false };
  }
  return { issued: true };
}
