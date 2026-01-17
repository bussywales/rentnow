"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequestViewingButton } from "@/components/viewings/RequestViewingButton";
import { SaveButton } from "@/components/properties/SaveButton";

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
};

type ContextCopy = {
  title: string;
  body?: string;
};

function mapContext(status: string | null): ContextCopy {
  const normalized = (status || "").toLowerCase();
  if (normalized === "declined") {
    return {
      title: "Request declined",
      body: "Pick new times and we’ll ask the host again.",
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

export function RequestViewingCtaSection({ propertyId, timezoneLabel }: Props) {
  const [latest, setLatest] = useState<LatestStatus | null>(null);

  useEffect(() => {
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
  }, [propertyId]);

  const context = mapContext(latest?.status ?? null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{context.title}</p>
        {context.body && <p className="text-sm text-slate-600">{context.body}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <RequestViewingButton propertyId={propertyId} />
        <Link
          href="/tenant/viewings"
          className="text-sm font-semibold text-sky-700 hover:underline"
        >
          Track requests
        </Link>
      </div>
      {timezoneLabel && <p className="text-xs text-slate-500">{timezoneLabel}</p>}
      <div className="pt-2">
        <SaveButton propertyId={propertyId} />
      </div>
    </div>
  );
}
