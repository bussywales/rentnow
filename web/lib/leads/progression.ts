export type LeadProgressionSnapshot = {
  repliedAt: string | null;
  viewingRequestedAt: string | null;
  viewingConfirmedAt: string | null;
  offPlatformHandoffAt: string | null;
  contactExchangeFlags?: Record<string, unknown> | null;
};

export type LeadProgressionTone = "neutral" | "positive" | "warning";

export type LeadProgressionSignal = {
  key: "replied" | "viewing_requested" | "viewing_confirmed" | "off_platform";
  label: string;
  tone: LeadProgressionTone;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mergeUniqueStrings(existing: unknown, next: string[]) {
  const current = Array.isArray(existing)
    ? existing.filter((value): value is string => typeof value === "string")
    : [];
  return Array.from(new Set([...current, ...next]));
}

export function mergeLeadContactExchangeFlags(input: {
  existing: Record<string, unknown> | null | undefined;
  moderationMeta?: Record<string, unknown> | null;
  occurredAt: string;
}) {
  const base = { ...(input.existing ?? {}) };
  const handoff = asObject(base.handoff) ?? {};
  const moderation = input.moderationMeta ?? null;
  const types = Array.isArray(moderation?.types)
    ? moderation.types.filter((value): value is string => typeof value === "string")
    : [];
  const phrases = Array.isArray(moderation?.phrases)
    ? moderation.phrases.filter((value): value is string => typeof value === "string")
    : [];

  return {
    ...base,
    moderation: moderation ?? base.moderation ?? null,
    handoff: {
      attempted: true,
      attempted_at: input.occurredAt,
      channels: mergeUniqueStrings(handoff.channels, types),
      phrases: mergeUniqueStrings(handoff.phrases, phrases),
      count:
        typeof handoff.count === "number" && Number.isFinite(handoff.count)
          ? Math.trunc(handoff.count) + 1
          : 1,
    },
  };
}

export function resolveLeadProgressionSignals(input: LeadProgressionSnapshot): LeadProgressionSignal[] {
  const signals: LeadProgressionSignal[] = [];
  if (input.repliedAt) {
    signals.push({ key: "replied", label: "Replied", tone: "positive" });
  }
  if (input.viewingRequestedAt) {
    signals.push({ key: "viewing_requested", label: "Viewing requested", tone: "neutral" });
  }
  if (input.viewingConfirmedAt) {
    signals.push({ key: "viewing_confirmed", label: "Viewing confirmed", tone: "positive" });
  }
  if (input.offPlatformHandoffAt) {
    signals.push({ key: "off_platform", label: "Contact exchange attempted", tone: "warning" });
  }
  return signals;
}
