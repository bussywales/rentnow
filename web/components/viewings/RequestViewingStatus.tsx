"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type StatusPayload = {
  id: string;
  status: string;
  created_at?: string | null;
  decided_at?: string | null;
  no_show_reported_at?: string | null;
};

type Props = {
  propertyId: string;
};

function formatStatusMessage(status: string | null): { title: string; body?: string } {
  const normalized = (status || "").toLowerCase();
  if (normalized === "approved" || normalized === "confirmed") {
    return {
      title: "Your viewing is confirmed.",
      body: "Need to change it? Message the host.",
    };
  }
  if (normalized === "pending" || normalized === "requested") {
    return {
      title: "Your request is with the host.",
      body: "You’ll be notified when they respond.",
    };
  }
  if (normalized === "proposed") {
    return { title: "The host suggested times.", body: "Review and choose one." };
  }
  if (normalized === "declined") {
    return {
      title: "Suggest up to 3 new times.",
      body: "The host will confirm one.",
    };
  }
  return {
    title: "Viewing requests",
    body: "Request a viewing to get started.",
  };
}

export function RequestViewingStatus({ propertyId }: Props) {
  const [latest, setLatest] = useState<StatusPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/viewings/tenant/latest?propertyId=${propertyId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.ok) {
          setLatest(json.latest || null);
        }
      } catch {
        // ignore; purely informational
      }
    };
    load();
  }, [propertyId]);

  const message = formatStatusMessage(latest?.status ?? null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-900">{message.title}</p>
      {message.body && <p className="text-sm text-slate-600">{message.body}</p>}
      <div className="text-sm text-slate-600">
        <Link href="/tenant/viewings" className="font-semibold text-sky-700 hover:underline">
          View my requests
        </Link>
      </div>
    </div>
  );
}
