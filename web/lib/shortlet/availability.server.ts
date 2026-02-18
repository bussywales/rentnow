import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  addDaysToDateKey,
  resolveAvailabilityConflicts,
  type ShortletUnavailableRange,
} from "@/lib/shortlet/availability";
import {
  getShortletSettingsForProperty,
  listBlockedRangesForProperty,
} from "@/lib/shortlet/shortlet.server";

export type ShortletAvailabilityConflictCheck = {
  hasConflict: boolean;
  conflictingDates: string[];
  conflictingRanges: ShortletUnavailableRange[];
  prepDays: number;
};

type ResolveAvailabilityConflictInput = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  excludeBookingId?: string | null;
  client?: SupabaseClient;
};

function getClient(inputClient?: SupabaseClient) {
  if (inputClient) return inputClient;
  if (!hasServiceRoleEnv()) {
    throw new Error("Service role not configured");
  }
  return createServiceRoleClient() as unknown as SupabaseClient;
}

export async function resolveShortletAvailabilityConflict(
  input: ResolveAvailabilityConflictInput
): Promise<ShortletAvailabilityConflictCheck> {
  const client = getClient(input.client);
  const settings = await getShortletSettingsForProperty(client, input.propertyId);
  const prepDays = Math.max(0, Math.trunc(settings?.prep_days ?? 0));
  const rangeFrom = prepDays > 0 ? addDaysToDateKey(input.checkIn, -prepDays) : input.checkIn;

  const blocked = await listBlockedRangesForProperty({
    client,
    propertyId: input.propertyId,
    from: rangeFrom,
    to: input.checkOut,
  });

  const ranges: ShortletUnavailableRange[] = [
    ...blocked.bookings
      .filter((row) => row.id !== input.excludeBookingId)
      .map((row) => ({
        start: row.from,
        end: row.to,
        source: "booking",
        bookingId: row.id,
      })),
    ...blocked.blocks.map((row) => ({
      start: row.from,
      end: row.to,
      source: "host_block",
    })),
  ];

  const conflicts = resolveAvailabilityConflicts({
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    unavailableRanges: ranges,
    prepDays,
  });

  return {
    hasConflict: conflicts.hasConflict,
    conflictingDates: conflicts.conflictingDates,
    conflictingRanges: conflicts.conflictingRanges,
    prepDays,
  };
}
