type PushSubscriptionQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

export type AdminPushSubscriptionStatus = {
  available: boolean;
  activeCount: number;
  hasActiveSubscription: boolean;
  error: string | null;
};

export async function getAdminPushSubscriptionStatus(input: {
  supabase: SupabaseLike;
  userId: string;
}): Promise<AdminPushSubscriptionStatus> {
  try {
    const { count, error } = (await input.supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", input.userId)
      .eq("is_active", true)) as PushSubscriptionQueryResult;

    if (error) {
      return {
        available: false,
        activeCount: 0,
        hasActiveSubscription: false,
        error: error.message,
      };
    }

    const activeCount = count ?? 0;
    return {
      available: true,
      activeCount,
      hasActiveSubscription: activeCount > 0,
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      activeCount: 0,
      hasActiveSubscription: false,
      error: err instanceof Error ? err.message : "Unable to load subscription",
    };
  }
}
