import { countAwaitingApprovalBookings, resolveHostBookingInboxFilter } from "@/lib/shortlet/host-bookings-inbox";
import { listHostShortletBookings } from "@/lib/shortlet/shortlet.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type WorkspaceHomeRole = "agent" | "landlord";

export type WorkspaceHomePrioritySummary = {
  newLeadsCount: number | null;
  bookingsAwaitingApprovalCount: number | null;
  upcomingCheckInsCount: number | null;
};

async function getAgentLeadsAwaitingResponseCount(
  client: SupabaseClient,
  userId: string
): Promise<number | null> {
  const { count, error } = await client
    .from("listing_leads")
    .select("id", { head: true, count: "exact" })
    .eq("owner_id", userId)
    .eq("status", "NEW");

  if (error) return null;
  return typeof count === "number" ? count : 0;
}

async function getLandlordBookingPriorityCounts(
  client: SupabaseClient,
  userId: string
): Promise<Pick<WorkspaceHomePrioritySummary, "bookingsAwaitingApprovalCount" | "upcomingCheckInsCount">> {
  try {
    const rows = await listHostShortletBookings({
      client,
      hostUserId: userId,
      limit: 120,
    });

    const now = new Date();
    const bookingsAwaitingApprovalCount = countAwaitingApprovalBookings(rows, now);
    const upcomingCheckInsCount = rows.filter(
      (row) => resolveHostBookingInboxFilter(row, now) === "upcoming"
    ).length;

    return {
      bookingsAwaitingApprovalCount,
      upcomingCheckInsCount,
    };
  } catch {
    return {
      bookingsAwaitingApprovalCount: null,
      upcomingCheckInsCount: null,
    };
  }
}

export async function getWorkspaceHomePrioritySummary(input: {
  client: SupabaseClient;
  userId: string;
  role: WorkspaceHomeRole;
}): Promise<WorkspaceHomePrioritySummary> {
  if (input.role === "agent") {
    const newLeadsCount = await getAgentLeadsAwaitingResponseCount(input.client, input.userId);
    return {
      newLeadsCount,
      bookingsAwaitingApprovalCount: null,
      upcomingCheckInsCount: null,
    };
  }

  const bookingCounts = await getLandlordBookingPriorityCounts(input.client, input.userId);
  return {
    newLeadsCount: null,
    bookingsAwaitingApprovalCount: bookingCounts.bookingsAwaitingApprovalCount,
    upcomingCheckInsCount: bookingCounts.upcomingCheckInsCount,
  };
}
