const EXPLORE_ANALYTICS_CONSENT_KEY = "ph:explore:analytics:consent:v1";
const EXPLORE_ANALYTICS_NOTICE_DISMISSED_AT_KEY = "ph:explore:analytics:notice:dismissed-at:v1";
const NOTICE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export type ExploreAnalyticsConsentState = "accepted" | "unknown";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getExploreAnalyticsConsentState(): ExploreAnalyticsConsentState {
  const storage = getStorage();
  if (!storage) return "unknown";
  const value = (storage.getItem(EXPLORE_ANALYTICS_CONSENT_KEY) || "").trim().toLowerCase();
  return value === "accepted" ? "accepted" : "unknown";
}

export function hasExploreAnalyticsConsent() {
  return getExploreAnalyticsConsentState() === "accepted";
}

export function setExploreAnalyticsConsentAccepted(nowMs = Date.now()) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(EXPLORE_ANALYTICS_CONSENT_KEY, "accepted");
  storage.setItem(EXPLORE_ANALYTICS_NOTICE_DISMISSED_AT_KEY, String(nowMs));
}

export function dismissExploreAnalyticsNotice(nowMs = Date.now()) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(EXPLORE_ANALYTICS_NOTICE_DISMISSED_AT_KEY, String(nowMs));
}

function getDismissedAtMs(): number | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(EXPLORE_ANALYTICS_NOTICE_DISMISSED_AT_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function shouldShowExploreAnalyticsNotice(input: {
  noticeEnabled: boolean;
  consentRequired: boolean;
  nowMs?: number;
}) {
  if (!input.noticeEnabled) return false;
  if (input.consentRequired) {
    return !hasExploreAnalyticsConsent();
  }
  const dismissedAt = getDismissedAtMs();
  if (!dismissedAt) return true;
  const nowMs = input.nowMs ?? Date.now();
  return nowMs - dismissedAt >= NOTICE_COOLDOWN_MS;
}

export function clearExploreAnalyticsConsentForTests() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(EXPLORE_ANALYTICS_CONSENT_KEY);
  storage.removeItem(EXPLORE_ANALYTICS_NOTICE_DISMISSED_AT_KEY);
}
