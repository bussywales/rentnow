import { resolveShortletBookingMode } from "@/lib/shortlet/discovery";
import {
  isWithinBounds,
  matchesFreeCancellationFilter,
  matchesShortletDestination,
  matchesTrustFilters,
  type ShortletSearchFilters,
} from "@/lib/shortlet/search";
import type { Property } from "@/lib/types";

export type ShortletPipelineDebugReason =
  | "destination_mismatch"
  | "bbox_mismatch"
  | "trust_filter_mismatch"
  | "booking_mode_mismatch"
  | "free_cancellation_mismatch";

export type ShortletPipelineStageCounts = {
  baselineCount: number;
  destinationFilteredCount: number;
  bboxFilteredCount: number;
  providerFilteredCount: number;
};

type ShortletPipelineBaseInput = {
  filters: ShortletSearchFilters;
  debugEnabled: boolean;
};

export function appendShortletPipelineReason<TReason extends string>(
  map: Map<string, Set<TReason>>,
  propertyId: string,
  reason: TReason
) {
  const existing = map.get(propertyId);
  if (existing) {
    existing.add(reason);
    return;
  }
  map.set(propertyId, new Set([reason]));
}

export function runShortletLocationPipeline(input: {
  baselineRows: Property[];
} & ShortletPipelineBaseInput) {
  const debugReasons = new Map<string, Set<ShortletPipelineDebugReason>>();

  const destinationFilteredRows = input.baselineRows.filter((property) => {
    const matchesDestination = matchesShortletDestination(property, input.filters.where);
    if (!matchesDestination && input.debugEnabled) {
      appendShortletPipelineReason(debugReasons, property.id, "destination_mismatch");
    }
    return matchesDestination;
  });

  const bboxFilteredRows = destinationFilteredRows.filter((property) => {
    const withinBounds = isWithinBounds(property, input.filters.bounds);
    if (!withinBounds && input.debugEnabled) {
      appendShortletPipelineReason(debugReasons, property.id, "bbox_mismatch");
    }
    return withinBounds;
  });

  return {
    destinationFilteredRows,
    bboxFilteredRows,
    debugReasons,
  };
}

export function runShortletProviderPipeline(input: {
  rows: Property[];
  verifiedHostIds: ReadonlySet<string>;
  debugReasons: Map<string, Set<ShortletPipelineDebugReason>>;
} & ShortletPipelineBaseInput) {
  const providerFilteredRows = input.rows.filter((property) => {
    if (
      !matchesTrustFilters({
        property,
        trustFilters: input.filters.trust,
        verifiedHostIds: input.verifiedHostIds,
      })
    ) {
      if (input.debugEnabled) {
        appendShortletPipelineReason(input.debugReasons, property.id, "trust_filter_mismatch");
      }
      return false;
    }

    if (input.filters.provider.bookingMode) {
      const bookingMode = resolveShortletBookingMode(property);
      if (bookingMode !== input.filters.provider.bookingMode) {
        if (input.debugEnabled) {
          appendShortletPipelineReason(input.debugReasons, property.id, "booking_mode_mismatch");
        }
        return false;
      }
    }

    if (
      !matchesFreeCancellationFilter({
        property,
        freeCancellationOnly: input.filters.provider.freeCancellation,
      })
    ) {
      if (input.debugEnabled) {
        appendShortletPipelineReason(input.debugReasons, property.id, "free_cancellation_mismatch");
      }
      return false;
    }

    return true;
  });

  return { providerFilteredRows, debugReasons: input.debugReasons };
}

export function runShortletPreAvailabilityPipeline(input: {
  baselineRows: Property[];
  filters: ShortletSearchFilters;
  verifiedHostIds: ReadonlySet<string>;
  debugEnabled: boolean;
}) {
  const locationPipeline = runShortletLocationPipeline(input);
  const providerPipeline = runShortletProviderPipeline({
    rows: locationPipeline.bboxFilteredRows,
    verifiedHostIds: input.verifiedHostIds,
    debugReasons: locationPipeline.debugReasons,
    filters: input.filters,
    debugEnabled: input.debugEnabled,
  });

  return {
    destinationFilteredRows: locationPipeline.destinationFilteredRows,
    bboxFilteredRows: locationPipeline.bboxFilteredRows,
    providerFilteredRows: providerPipeline.providerFilteredRows,
    debugReasons: providerPipeline.debugReasons,
    stageCounts: {
      baselineCount: input.baselineRows.length,
      destinationFilteredCount: locationPipeline.destinationFilteredRows.length,
      bboxFilteredCount: locationPipeline.bboxFilteredRows.length,
      providerFilteredCount: providerPipeline.providerFilteredRows.length,
    } satisfies ShortletPipelineStageCounts,
  };
}
