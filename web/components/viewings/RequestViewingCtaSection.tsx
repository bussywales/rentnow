"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequestViewingButton } from "@/components/viewings/RequestViewingButton";
import { EnquireToBuyButton } from "@/components/leads/EnquireToBuyButton";

type LatestStatus = {
  id: string;
  status: string;
  created_at?: string | null;
  decided_at?: string | null;
  no_show_reported_at?: string | null;
};

type Props = {
  propertyId: string;
  timezoneLabel?: string;
  listingIntent?: "rent" | "buy";
};

type ContextCopy = {
  title: string;
  body?: string;
};

function mapContext(status: string | null): ContextCopy {
  const normalized = (status || "").toLowerCase();
  if (normalized === "declined") {
    return {
      title: "Request declined.",
      body: "Pick new times and we’ll ask the host again.",
    };
  }
  if (normalized === "no_show") {
    return {
      title: "Last request was marked as no-show.",
      body: "You can request another time.",
    };
  }
  if (normalized === "pending" || normalized === "requested") {
    return {
      title: "Request sent — waiting for host.",
    };
  }
  if (normalized === "approved" || normalized === "confirmed") {
    return { title: "Viewing confirmed." };
  }
  if (normalized === "proposed") {
    return { title: "Host suggested new times." };
  }
  return {
    title: "Ready to view this home?",
    body: "Pick up to 3 time slots and we’ll notify the host.",
  };
}

export function RequestViewingCtaSection({
  propertyId,
  timezoneLabel,
  listingIntent = "rent",
}: Props) {
  const [latest, setLatest] = useState<LatestStatus | null>(null);

  useEffect(() => {
    if (listingIntent === "buy") return;
    const load = async () => {
      try {
        const res = await fetch(`/api/viewings/tenant/latest?propertyId=${propertyId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.ok) setLatest(json.latest || null);
      } catch {
        // ignore; button logic will still work
      }
    };
    load();
  }, [listingIntent, propertyId]);

  const context =
    listingIntent === "buy"
      ? { title: "Ready to buy?", body: "Send a verified enquiry to the host or agent." }
      : mapContext(latest?.status ?? null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{context.title}</p>
        {context.body && <p className="text-sm text-slate-600">{context.body}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {listingIntent === "buy" ? (
          <EnquireToBuyButton propertyId={propertyId} />
        ) : (
          <>
            <RequestViewingButton propertyId={propertyId} />
            <Link
              href="/tenant/viewings"
              className="text-sm font-semibold text-sky-700 hover:underline"
            >
              Track viewings
            </Link>
          </>
        )}
      </div>
      {timezoneLabel && <p className="text-xs text-slate-500">{timezoneLabel}</p>}
    </div>
  );
}
