import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsumeFeaturedCreditResult =
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

export async function consumeFeaturedCredit({
  client,
  userId,
  listingId,
  idempotencyKey,
}: {
  client: SupabaseClient;
  userId: string;
  listingId: string;
  idempotencyKey: string;
}): Promise<ConsumeFeaturedCreditResult> {
  const { data, error } = await client.rpc("consume_featured_credit", {
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
