import { safeTrim } from "@/lib/agents/agent-storefront";

export type AgentOnboardingProgress = {
  hasListing: boolean;
  hasClientPage: boolean;
  hasSharedPage: boolean;
  completed: boolean;
  completedAt: string | null;
  publishedPageUrl: string | null;
};

type ProgressRow = {
  user_id?: string | null;
  has_listing?: boolean | null;
  has_client_page?: boolean | null;
  has_shared_page?: boolean | null;
  completed_at?: string | null;
};

type ClientPageRow = {
  id?: string | null;
  client_slug?: string | null;
  published?: boolean | null;
  updated_at?: string | null;
  published_at?: string | null;
};

function resolvePublishedPage(pages: ClientPageRow[]) {
  const published = pages.filter((page) => page.published);
  if (published.length === 0) return null;
  return published.sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.published_at || "");
    const bTime = Date.parse(b.updated_at || b.published_at || "");
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  })[0];
}

function buildClientPageUrl(input: {
  siteUrl: string;
  agentSlug?: string | null;
  clientSlug?: string | null;
}) {
  const agentSlug = safeTrim(input.agentSlug);
  const clientSlug = safeTrim(input.clientSlug);
  if (!agentSlug || !clientSlug) return null;
  return `${input.siteUrl.replace(/\/$/, "")}/agents/${agentSlug}/c/${clientSlug}`;
}

async function fetchListingCount(supabase: any, userId: string) {
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", userId);
  return (data as { id?: string | null }[] | null | undefined)?.length ?? 0;
}

async function fetchClientPages(supabase: any, userId: string) {
  const { data } = await supabase
    .from("agent_client_pages")
    .select("id, client_slug, published, updated_at, published_at")
    .eq("agent_user_id", userId);
  return (data as ClientPageRow[] | null | undefined) ?? [];
}

async function fetchProgressRow(supabase: any, userId: string) {
  const { data } = await supabase
    .from("agent_onboarding_progress")
    .select("user_id, has_listing, has_client_page, has_shared_page, completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProgressRow | null) ?? null;
}

function buildProgress(input: {
  listingCount: number;
  clientPageCount: number;
  hasSharedPage: boolean;
  completedAt?: string | null;
}) {
  const hasListing = input.listingCount > 0;
  const hasClientPage = input.clientPageCount > 0;
  const previouslyCompleted = !!input.completedAt;
  const completed = previouslyCompleted || (hasListing && hasClientPage && input.hasSharedPage);
  const completedAt = input.completedAt ?? (completed ? new Date().toISOString() : null);
  return {
    hasListing,
    hasClientPage,
    hasSharedPage: input.hasSharedPage,
    completed,
    completedAt,
  };
}

async function upsertProgressRow(supabase: any, userId: string, progress: ReturnType<typeof buildProgress>) {
  const payload = {
    user_id: userId,
    has_listing: progress.hasListing,
    has_client_page: progress.hasClientPage,
    has_shared_page: progress.hasSharedPage,
    completed_at: progress.completedAt,
    updated_at: new Date().toISOString(),
  };
  await supabase.from("agent_onboarding_progress").upsert(payload, { onConflict: "user_id" });
}

export async function resolveAgentOnboardingProgress(input: {
  supabase: any;
  userId: string;
  agentSlug?: string | null;
  siteUrl: string;
}): Promise<AgentOnboardingProgress> {
  const [listingCount, pages, progressRow] = await Promise.all([
    fetchListingCount(input.supabase, input.userId),
    fetchClientPages(input.supabase, input.userId),
    fetchProgressRow(input.supabase, input.userId),
  ]);

  const hasSharedPage = progressRow?.has_shared_page ?? false;
  const progress = buildProgress({
    listingCount,
    clientPageCount: pages.length,
    hasSharedPage,
    completedAt: progressRow?.completed_at ?? null,
  });

  const shouldUpsert =
    !progressRow ||
    progressRow.has_listing !== progress.hasListing ||
    progressRow.has_client_page !== progress.hasClientPage ||
    progressRow.has_shared_page !== progress.hasSharedPage ||
    (progress.completed && !progressRow.completed_at);

  if (shouldUpsert) {
    await upsertProgressRow(input.supabase, input.userId, progress);
  }

  const publishedPage = resolvePublishedPage(pages);
  const publishedPageUrl = buildClientPageUrl({
    siteUrl: input.siteUrl,
    agentSlug: input.agentSlug,
    clientSlug: publishedPage?.client_slug ?? null,
  });

  return {
    ...progress,
    publishedPageUrl,
  };
}

export async function markAgentSharedPageComplete(input: {
  supabase: any;
  userId: string;
  agentSlug?: string | null;
  siteUrl: string;
}): Promise<AgentOnboardingProgress> {
  const [listingCount, pages, progressRow] = await Promise.all([
    fetchListingCount(input.supabase, input.userId),
    fetchClientPages(input.supabase, input.userId),
    fetchProgressRow(input.supabase, input.userId),
  ]);

  const progress = buildProgress({
    listingCount,
    clientPageCount: pages.length,
    hasSharedPage: true,
    completedAt: progressRow?.completed_at ?? null,
  });

  await upsertProgressRow(input.supabase, input.userId, progress);

  const publishedPage = resolvePublishedPage(pages);
  const publishedPageUrl = buildClientPageUrl({
    siteUrl: input.siteUrl,
    agentSlug: input.agentSlug,
    clientSlug: publishedPage?.client_slug ?? null,
  });

  return {
    ...progress,
    publishedPageUrl,
  };
}
