export const CONTACT_EXCHANGE_MODES = ["off", "redact", "block"] as const;
export type ContactExchangeMode = (typeof CONTACT_EXCHANGE_MODES)[number];

export function parseAppSettingBool(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return defaultValue;
}

export function parseAppSettingInt(value: unknown, defaultValue: number) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value);
    if (Number.isFinite(num)) return Math.trunc(num);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const candidates = [record.days, record.value];
    for (const candidate of candidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate)) return Math.trunc(candidate);
      if (typeof candidate === "string" && candidate.trim() !== "") {
        const num = Number(candidate);
        if (Number.isFinite(num)) return Math.trunc(num);
      }
    }
  }
  return defaultValue;
}

export function parseContactExchangeMode(
  value: unknown,
  defaultValue: ContactExchangeMode
): ContactExchangeMode {
  if (typeof value === "string" && CONTACT_EXCHANGE_MODES.includes(value as ContactExchangeMode)) {
    return value as ContactExchangeMode;
  }
  if (typeof value === "object" && value !== null && "mode" in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (typeof mode === "string" && CONTACT_EXCHANGE_MODES.includes(mode as ContactExchangeMode)) {
      return mode as ContactExchangeMode;
    }
  }
  return defaultValue;
}
