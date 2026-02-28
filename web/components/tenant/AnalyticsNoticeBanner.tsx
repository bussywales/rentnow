"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  dismissExploreAnalyticsNotice,
  setExploreAnalyticsConsentAccepted,
  shouldShowExploreAnalyticsNotice,
} from "@/lib/analytics/consent";

type ExploreAnalyticsSettingsResponse = {
  ok?: boolean;
  settings?: {
    enabled?: boolean;
    consentRequired?: boolean;
    noticeEnabled?: boolean;
  };
};

export function AnalyticsNoticeBanner() {
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/analytics/explore/settings", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setVisible(false);
            setLoading(false);
          }
          return;
        }
        const payload = (await response.json().catch(() => null)) as ExploreAnalyticsSettingsResponse | null;
        if (!payload?.settings || cancelled) {
          if (!cancelled) {
            setVisible(false);
            setLoading(false);
          }
          return;
        }
        const enabled = payload.settings.enabled !== false;
        const required = payload.settings.consentRequired === true;
        const noticeEnabled = payload.settings.noticeEnabled !== false;
        setConsentRequired(required);
        setVisible(
          enabled &&
            shouldShowExploreAnalyticsNotice({
              noticeEnabled,
              consentRequired: required,
            })
        );
        setLoading(false);
      } catch {
        if (!cancelled) {
          setVisible(false);
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const headline = useMemo(
    () =>
      consentRequired
        ? "Help improve Explore with anonymous analytics"
        : "Explore uses anonymous product analytics",
    [consentRequired]
  );

  if (loading || !visible) return null;

  return (
    <div
      className="mb-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-sm"
      data-testid="tenant-analytics-notice"
    >
      <p className="font-semibold text-slate-900">{headline}</p>
      <p className="mt-1 text-xs text-slate-600">
        We use anonymous product analytics to improve Explore. No message content is collected.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {consentRequired ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                setExploreAnalyticsConsentAccepted();
                setVisible(false);
              }}
              data-testid="tenant-analytics-consent-accept"
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                dismissExploreAnalyticsNotice();
                setVisible(false);
              }}
              data-testid="tenant-analytics-consent-not-now"
            >
              Not now
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              dismissExploreAnalyticsNotice();
              setVisible(false);
            }}
            data-testid="tenant-analytics-notice-dismiss"
          >
            Got it
          </Button>
        )}
      </div>
    </div>
  );
}
