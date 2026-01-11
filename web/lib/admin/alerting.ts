import type { SupabaseClient } from "@supabase/supabase-js";
import { ALERT_THRESHOLDS, ALERT_WINDOWS } from "@/lib/admin/alerts-config";
import { buildDataQualitySnapshot } from "@/lib/admin/data-quality";

export type AlertSeverity = "info" | "warn" | "critical";

export type AdminAlert = {
  key: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  signal: string;
  window: string;
  recommended_action: string;
  runbook_link: string;
  admin_path: string;
  last_updated_at: string;
};

type AlertSignals = {
  nowIso: string;
  push: {
    configured: boolean;
    failuresLastHour: number;
    unavailableLastHour: number;
    totalPushLastHour: number;
    subscriptionsTotal: number;
    subscriptionsLast24h: number;
  };
  throttle: {
    last15m: number;
    lastHour: number;
  };
  dataQuality: {
    missingPhotos: number | null;
    missingCountryCode: number;
    missingDepositCurrency: number;
    missingSizeUnit: number;
    listingTypeMissing: number;
  };
};

type AlertResult = { alerts: AdminAlert[]; error: string | null };

type PushConfig = { configured: boolean };

const toIsoRangeStart = (windowMs: number) =>
  new Date(Date.now() - windowMs).toISOString();

const sanitizeAlertText = (value: string) =>
  value
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/access_token|refresh_token|token|secret|key|full_name|business_name|email|phone/gi, "[redacted]");

const sanitizeRelativeLink = (link: string) => {
  if (!link.startsWith("/")) return "/admin/alerts";
  if (link.startsWith("http://") || link.startsWith("https://")) return "/admin/alerts";
  return link;
};

const severityRank: Record<AlertSeverity, number> = {
  critical: 3,
  warn: 2,
  info: 1,
};

export function buildAdminAlertsFromSignals(signals: AlertSignals) {
  const alerts: AdminAlert[] = [];
  const now = signals.nowIso;

  const addAlert = (alert: Omit<AdminAlert, "last_updated_at" | "runbook_link" | "admin_path">) => {
    alerts.push({
      ...alert,
      runbook_link: "/admin/alerts#runbook",
      admin_path: "/admin/alerts",
      last_updated_at: now,
    });
  };

  const totalPush = signals.push.totalPushLastHour;
  const pushFailures = signals.push.failuresLastHour;
  const pushUnavailable = signals.push.unavailableLastHour;
  const failureRate = totalPush > 0 ? pushFailures / totalPush : 0;

  if (pushFailures > 0 || failureRate > 0) {
    let severity: AlertSeverity | null = null;
    if (
      pushFailures >= ALERT_THRESHOLDS.push.failureCountCritical ||
      failureRate >= ALERT_THRESHOLDS.push.failureRateCritical
    ) {
      severity = "critical";
    } else if (
      pushFailures >= ALERT_THRESHOLDS.push.failureCountWarn ||
      failureRate >= ALERT_THRESHOLDS.push.failureRateWarn
    ) {
      severity = "warn";
    }

    if (severity) {
      addAlert({
        key: "push-failure-spike",
        severity,
        title: "Push failures spiking",
        summary: "Push delivery errors are elevated in the last hour.",
        signal: `failures=${pushFailures} · total=${totalPush} · rate=${Math.round(failureRate * 100)}%`,
        window: "last 1h",
        recommended_action: "Check push providers and validate subscription health.",
      });
    }
  }

  if (pushUnavailable > 0) {
    let severity: AlertSeverity | null = null;
    if (pushUnavailable >= ALERT_THRESHOLDS.push.unavailableCountCritical) {
      severity = "critical";
    } else if (pushUnavailable >= ALERT_THRESHOLDS.push.unavailableCountWarn) {
      severity = "warn";
    }
    if (severity) {
      addAlert({
        key: "push-unavailable-spike",
        severity,
        title: "Push unavailable markers spiking",
        summary: "Push attempts are being marked as unavailable.",
        signal: `unavailable=${pushUnavailable}`,
        window: "last 1h",
        recommended_action: "Confirm VAPID config and subscription validity.",
      });
    }
  }

  if (
    signals.push.configured &&
    signals.push.subscriptionsTotal === 0 &&
    signals.push.subscriptionsLast24h === 0
  ) {
    addAlert({
      key: "push-subscriptions-zero",
      severity: "warn",
      title: "No active push subscriptions",
      summary: "Push is configured but there are no subscriptions in the last 24h.",
      signal: "subscriptions=0",
      window: "last 24h",
      recommended_action: "Verify saved searches page prompts for push and VAPID envs.",
    });
  }

  if (signals.throttle.last15m >= ALERT_THRESHOLDS.throttle.criticalCountLast15m) {
    addAlert({
      key: "messaging-throttle-critical",
      severity: "critical",
      title: "Messaging throttle spike",
      summary: "Rate-limited sends are spiking in the last 15 minutes.",
      signal: `throttled=${signals.throttle.last15m}`,
      window: "last 15m",
      recommended_action: "Review recent abuse patterns and rate-limit tuning.",
    });
  } else if (signals.throttle.lastHour >= ALERT_THRESHOLDS.throttle.warnCountLastHour) {
    addAlert({
      key: "messaging-throttle-warn",
      severity: "warn",
      title: "Messaging throttle elevated",
      summary: "Rate-limited sends are elevated in the last hour.",
      signal: `throttled=${signals.throttle.lastHour}`,
      window: "last 1h",
      recommended_action: "Monitor sender patterns and adjust limits if needed.",
    });
  }

  const { missingPhotos, missingCountryCode, missingDepositCurrency, missingSizeUnit, listingTypeMissing } =
    signals.dataQuality;

  if (
    missingPhotos !== null &&
    missingPhotos >= ALERT_THRESHOLDS.dataQuality.missingPhotosWarn
  ) {
    addAlert({
      key: "data-quality-missing-photos",
      severity: "warn",
      title: "Listings missing photos",
      summary: "A large number of listings lack photos.",
      signal: `missing=${missingPhotos}`,
      window: "current",
      recommended_action: "Review affected listings and request photo uploads.",
    });
  }

  if (missingCountryCode >= ALERT_THRESHOLDS.dataQuality.missingCountryCodeInfo) {
    addAlert({
      key: "data-quality-missing-country-code",
      severity: "info",
      title: "Country code coverage low",
      summary: "Many listings still lack country_code.",
      signal: `missing=${missingCountryCode}`,
      window: "current",
      recommended_action: "Run backfill and confirm country selection UI writes codes.",
    });
  }

  if (missingDepositCurrency >= ALERT_THRESHOLDS.dataQuality.missingDepositCurrencyInfo) {
    addAlert({
      key: "data-quality-missing-deposit-currency",
      severity: "info",
      title: "Deposit currency missing",
      summary: "Deposit amounts are missing currency metadata.",
      signal: `missing=${missingDepositCurrency}`,
      window: "current",
      recommended_action: "Review listings with deposits and fill currency metadata.",
    });
  }

  if (missingSizeUnit >= ALERT_THRESHOLDS.dataQuality.missingSizeInfo) {
    addAlert({
      key: "data-quality-missing-size-unit",
      severity: "info",
      title: "Size unit missing",
      summary: "Size value/unit mismatches remain.",
      signal: `missing=${missingSizeUnit}`,
      window: "current",
      recommended_action: "Check size fields on affected listings.",
    });
  }

  if (listingTypeMissing >= ALERT_THRESHOLDS.dataQuality.missingListingTypeInfo) {
    addAlert({
      key: "data-quality-missing-listing-type",
      severity: "info",
      title: "Listing type missing",
      summary: "Listings are missing structured type metadata.",
      signal: `missing=${listingTypeMissing}`,
      window: "current",
      recommended_action: "Prompt hosts to complete listing details.",
    });
  }

  return alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
}

export function buildAlertWebhookPayload(alerts: AdminAlert[]) {
  const sanitizedAlerts = alerts.map((alert) => ({
    key: alert.key,
    severity: alert.severity,
    title: sanitizeAlertText(alert.title),
    summary: sanitizeAlertText(alert.summary),
    signal: sanitizeAlertText(alert.signal),
    window: sanitizeAlertText(alert.window),
    recommended_action: sanitizeAlertText(alert.recommended_action),
    runbook_link: sanitizeRelativeLink(alert.runbook_link),
    admin_path: sanitizeRelativeLink(alert.admin_path),
    last_updated_at: alert.last_updated_at,
  }));

  return {
    generated_at: new Date().toISOString(),
    alerts: sanitizedAlerts,
  };
}

export async function buildAdminAlerts(
  adminClient: SupabaseClient,
  pushConfig: PushConfig
): Promise<AlertResult> {
  const errors: string[] = [];

  const [
    pushFailuresLastHour,
    pushUnavailableLastHour,
    totalPushLastHour,
    subscriptionsTotal,
    subscriptionsLast24h,
    throttleLast15m,
    throttleLastHour,
  ] = await Promise.all([
    adminClient
      .from("saved_search_alerts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.lastHourMs))
      .ilike("error", "push_failed:%"),
    adminClient
      .from("saved_search_alerts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.lastHourMs))
      .ilike("error", "push_unavailable:%"),
    adminClient
      .from("saved_search_alerts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.lastHourMs))
      .ilike("channel", "%push%"),
    adminClient
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true }),
    adminClient
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.last24hMs)),
    adminClient
      .from("messaging_throttle_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.last15mMs)),
    adminClient
      .from("messaging_throttle_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", toIsoRangeStart(ALERT_WINDOWS.lastHourMs)),
  ]);

  const collectError = (label: string, result: { error: { message: string } | null }) => {
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  };

  collectError("pushFailuresLastHour", pushFailuresLastHour);
  collectError("pushUnavailableLastHour", pushUnavailableLastHour);
  collectError("totalPushLastHour", totalPushLastHour);
  collectError("subscriptionsTotal", subscriptionsTotal);
  collectError("subscriptionsLast24h", subscriptionsLast24h);
  collectError("throttleLast15m", throttleLast15m);
  collectError("throttleLastHour", throttleLastHour);

  const { snapshot: dataQualitySnapshot, error: dataQualityError } =
    await buildDataQualitySnapshot(adminClient);
  if (dataQualityError) errors.push(`dataQuality: ${dataQualityError}`);

  const alerts = buildAdminAlertsFromSignals({
    nowIso: new Date().toISOString(),
    push: {
      configured: pushConfig.configured,
      failuresLastHour: pushFailuresLastHour.count ?? 0,
      unavailableLastHour: pushUnavailableLastHour.count ?? 0,
      totalPushLastHour: totalPushLastHour.count ?? 0,
      subscriptionsTotal: subscriptionsTotal.count ?? 0,
      subscriptionsLast24h: subscriptionsLast24h.count ?? 0,
    },
    throttle: {
      last15m: throttleLast15m.count ?? 0,
      lastHour: throttleLastHour.count ?? 0,
    },
    dataQuality: {
      missingPhotos: dataQualitySnapshot.counts.missingPhotos,
      missingCountryCode: dataQualitySnapshot.counts.missingCountryCode,
      missingDepositCurrency: dataQualitySnapshot.counts.depositMissingCurrency,
      missingSizeUnit: dataQualitySnapshot.counts.sizeMissingUnit,
      listingTypeMissing: dataQualitySnapshot.counts.listingTypeMissing,
    },
  });

  return {
    alerts,
    error: errors.length ? errors.join(" | ") : null,
  };
}
