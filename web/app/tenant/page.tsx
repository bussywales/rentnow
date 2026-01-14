import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { SavedSearch } from "@/lib/types";
import { ActivityFeed } from "@/components/tenant/ActivityFeed";
import { SavedSearchPreview } from "@/components/tenant/SavedSearchPreview";
import { SummaryCard } from "@/components/tenant/SummaryCard";
import { TenantHero } from "@/components/tenant/TenantHero";
import { TenantProgress } from "@/components/tenant/TenantProgress";

export const dynamic = "force-dynamic";

type ActivityItem = {
  id: string;
  title: string;
  description?: string | null;
  timestamp?: string | null;
  href?: string;
};

type MessageRow = {
  id: string;
  body: string | null;
  created_at?: string | null;
  sender_id: string;
  recipient_id: string;
};

type ViewingRow = {
  id: string;
  preferred_date: string | null;
  preferred_time_window?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AlertRow = {
  id: string;
  created_at?: string | null;
  status?: string | null;
  saved_searches?: { name?: string | null } | null;
};

function formatCount(value: number | null) {
  if (value === null) return "-";
  return value.toString();
}

function truncate(value: string | null | undefined, max = 80) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max).trim()}...`;
}

function buildActivityItems(input: {
  latestSearch?: SavedSearch | null;
  latestAlert?: AlertRow | null;
  latestMessage?: MessageRow | null;
  latestViewing?: ViewingRow | null;
  userId: string;
}) {
  const items: ActivityItem[] = [];

  if (input.latestAlert?.created_at) {
    const searchName =
      input.latestAlert.saved_searches?.name ?? "your saved search";
    items.push({
      id: `alert-${input.latestAlert.id}`,
      title: "New match alert",
      description: `We found a match for ${searchName}.`,
      timestamp: input.latestAlert.created_at,
      href: "/dashboard/saved-searches",
    });
  }

  if (input.latestMessage?.created_at) {
    const isSender = input.latestMessage.sender_id === input.userId;
    items.push({
      id: `message-${input.latestMessage.id}`,
      title: isSender ? "You messaged a host" : "New message from a host",
      description: truncate(input.latestMessage.body, 90),
      timestamp: input.latestMessage.created_at,
      href: "/dashboard/messages",
    });
  }

  if (input.latestViewing?.created_at) {
    const date = input.latestViewing.preferred_date
      ? ` for ${input.latestViewing.preferred_date}`
      : "";
    items.push({
      id: `viewing-${input.latestViewing.id}`,
      title: "Viewing request",
      description: `Request${date} (${input.latestViewing.status ?? "pending"})`,
      timestamp: input.latestViewing.created_at,
      href: "/dashboard/viewings",
    });
  }

  if (input.latestSearch?.created_at) {
    items.push({
      id: `search-${input.latestSearch.id}`,
      title: "Saved search created",
      description: input.latestSearch.name,
      timestamp: input.latestSearch.created_at,
      href: "/dashboard/saved-searches",
    });
  }

  return items
    .filter((item) => item.timestamp)
    .sort((a, b) => {
      const aTime = new Date(a.timestamp ?? "").getTime();
      const bTime = new Date(b.timestamp ?? "").getTime();
      return bTime - aTime;
    })
    .slice(0, 4);
}

export default async function TenantWorkspace() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Tenant workspace</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so tenant tools are unavailable.
        </p>
      </div>
    );
  }

  const { supabase, user, role } = await resolveServerRole();

  if (!user) {
    logAuthRedirect("/tenant");
    redirect("/auth/login?reason=auth");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
  }

  const [
    profileResult,
    savedSearchesResult,
    messageCountResult,
    unreadCountResult,
    latestMessageResult,
    viewingCountResult,
    upcomingViewingResult,
    latestViewingResult,
  ] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("saved_searches")
      .select("id, name, query_params, created_at, last_checked_at, last_notified_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .neq("delivery_state", "read"),
    supabase
      .from("messages")
      .select("id, body, created_at, sender_id, recipient_id")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("viewing_requests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id),
    supabase
      .from("viewing_requests")
      .select("id, preferred_date, preferred_time_window, status")
      .eq("tenant_id", user.id)
      .in("status", ["pending", "accepted"])
      .gte("preferred_date", new Date().toISOString().slice(0, 10))
      .order("preferred_date", { ascending: true })
      .limit(1),
    supabase
      .from("viewing_requests")
      .select("id, preferred_date, preferred_time_window, status, created_at")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const fullName = profileResult.data?.full_name ?? null;
  const savedSearches = (savedSearchesResult.data as SavedSearch[]) ?? [];
  const savedSearchCount = savedSearches.length;

  const matchCountResult =
    savedSearchCount > 0
      ? await supabase
          .from("saved_search_alerts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
      : null;
  const matchCount =
    matchCountResult && !matchCountResult.error
      ? matchCountResult.count ?? 0
      : null;

  const latestAlertResult =
    savedSearchCount > 0
      ? await supabase
          .from("saved_search_alerts")
          .select("id, created_at, status, saved_searches(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
      : null;
  const latestAlert = Array.isArray(latestAlertResult?.data)
    ? (latestAlertResult?.data[0] as AlertRow | undefined) ?? null
    : null;

  const messageCount = messageCountResult.error
    ? null
    : messageCountResult.count ?? 0;
  const unreadCount = unreadCountResult.error
    ? null
    : unreadCountResult.count ?? 0;
  const latestMessage = Array.isArray(latestMessageResult.data)
    ? ((latestMessageResult.data[0] ?? null) as MessageRow | null)
    : null;

  const viewingCount = viewingCountResult.error
    ? null
    : viewingCountResult.count ?? 0;
  const upcomingViewing = Array.isArray(upcomingViewingResult.data)
    ? ((upcomingViewingResult.data[0] ?? null) as ViewingRow | null)
    : null;
  const latestViewing = Array.isArray(latestViewingResult.data)
    ? ((latestViewingResult.data[0] ?? null) as ViewingRow | null)
    : null;

  const activityItems = buildActivityItems({
    latestSearch: savedSearches[0] ?? null,
    latestAlert,
    latestMessage,
    latestViewing,
    userId: user.id,
  });

  const fallbackActivity: ActivityItem[] = [
    {
      id: "activity-search",
      title: "Save a search to track new listings",
      description: "Browse homes and save your filters for automatic alerts.",
      href: "/properties",
    },
    {
      id: "activity-message",
      title: "Message a host directly from a listing",
      description: "Ask about availability, pricing, and viewing times.",
      href: "/properties",
    },
    {
      id: "activity-viewing",
      title: "Request a viewing when you find a match",
      description: "Schedule tours and keep everything in one place.",
      href: "/dashboard/viewings",
    },
  ];

  const hasSavedSearches = savedSearchCount > 0;
  const primaryCta = hasSavedSearches
    ? { href: "/dashboard/saved-searches", label: "View matching listings" }
    : { href: "/properties", label: "Create saved search" };
  const secondaryCta = { href: "/properties", label: "Browse homes" };
  const quickActions = [
    { href: "/properties", label: "Browse homes" },
    { href: "/dashboard/saved-searches", label: "View saved searches" },
    { href: "/dashboard/messages", label: "View messages" },
  ];

  const progressSteps = [
    {
      label: "Account",
      description: "Signed in",
      complete: true,
    },
    {
      label: "Saved search",
      description: hasSavedSearches ? "Search saved" : "Create your first search",
      complete: hasSavedSearches,
    },
    {
      label: "Viewing request",
      description:
        (viewingCount ?? 0) > 0
          ? "Request submitted"
          : "Request a viewing",
      complete: (viewingCount ?? 0) > 0,
    },
  ];

  const messageValue =
    unreadCount !== null && unreadCount > 0
      ? formatCount(unreadCount)
      : formatCount(messageCount);
  const hasMessages = (messageCount ?? 0) > 0;
  const messageHelper =
    unreadCount !== null && unreadCount > 0
      ? "Unread messages"
      : "Total conversations";

  const hasViewings = (viewingCount ?? 0) > 0 || !!upcomingViewing;
  const viewingValue = formatCount(upcomingViewing ? 1 : viewingCount);
  const viewingHelper = upcomingViewing?.preferred_date
      ? `Next: ${upcomingViewing.preferred_date}${
        upcomingViewing.preferred_time_window
          ? ` | ${upcomingViewing.preferred_time_window}`
          : ""
      }`
      : "No upcoming viewings yet";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
      <div className="space-y-4">
        <TenantHero
          name={fullName}
          savedSearchCount={savedSearchCount}
          primaryCta={primaryCta}
          secondaryCta={secondaryCta}
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick actions
          </p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <TenantProgress steps={progressSteps} />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="New matches"
          value={hasSavedSearches ? formatCount(matchCount) : "-"}
          description={
            hasSavedSearches
              ? "Listings that match your saved searches."
              : "Save a search and we'll alert you when new homes match."
          }
          helper={hasSavedSearches ? "Matches found" : null}
          cta={{
            href: hasSavedSearches ? "/dashboard/saved-searches" : "/properties",
            label: hasSavedSearches ? "View saved searches" : "Create saved search",
          }}
        />
        <SummaryCard
          title="Messages"
          value={messageValue}
          description={
            hasMessages
              ? "Keep the conversation moving with hosts."
              : "Messages let you chat with hosts about availability and viewings."
          }
          helper={messageHelper}
          cta={{
            href: hasMessages ? "/dashboard/messages" : "/properties",
            label: hasMessages ? "View messages" : "Browse homes",
          }}
        />
        <SummaryCard
          title="Viewings"
          value={viewingValue}
          description={
            hasViewings
              ? "Track upcoming viewing requests."
              : "Request a viewing to schedule tours and keep details here."
          }
          helper={viewingHelper}
          cta={{
            href: hasViewings ? "/dashboard/viewings" : "/properties",
            label: hasViewings ? "Review viewings" : "Browse homes",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ActivityFeed items={activityItems.length ? activityItems : fallbackActivity} />
        <SavedSearchPreview searches={savedSearches} />
      </div>
    </div>
  );
}
