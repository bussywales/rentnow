"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type FxFetchNowResponse = {
  ok: boolean;
  fetchedAt?: string | null;
  base?: string | null;
  count?: number;
  provider?: string | null;
  date?: string | null;
  error?: string;
};

type Status = "idle" | "loading" | "success" | "error";

export function AdminFxActions() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const handleFetchNow = async () => {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/fx/fetch-now", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as FxFetchNowResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus("error");
        setMessage(payload?.error || "Unable to fetch FX rates right now.");
        return;
      }

      setStatus("success");
      setLastFetchedAt(payload.fetchedAt ?? null);
      setMessage(
        `FX rates fetched (${payload.base ?? "base unknown"}, ${payload.count ?? 0} currencies, ${payload.provider ?? "provider unknown"})`
      );
    } catch {
      setStatus("error");
      setMessage("Unable to fetch FX rates right now.");
    }
  };

  const variant = status === "error" ? "error" : "success";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-fx-actions">
      <h2 className="text-sm font-semibold text-slate-900">FX</h2>
      <p className="mt-1 text-xs text-slate-500">
        Runs the daily FX fetch job immediately (admin-only).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={handleFetchNow}
          disabled={status === "loading"}
          data-testid="admin-fx-fetch-now"
        >
          {status === "loading" ? "Fetching..." : "Fetch FX rates now"}
        </Button>
        {lastFetchedAt ? (
          <p className="text-xs text-slate-600" data-testid="admin-fx-last-fetched">
            Last fetched: {lastFetchedAt}
          </p>
        ) : null}
      </div>

      {message ? (
        <Alert
          className="mt-3"
          title={status === "error" ? "Fetch failed" : "FX updated"}
          description={message}
          variant={variant}
        />
      ) : null}
    </section>
  );
}
