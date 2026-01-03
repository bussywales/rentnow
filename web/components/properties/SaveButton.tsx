"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  propertyId: string;
  initialSaved?: boolean;
};

export function SaveButton({ propertyId, initialSaved = false }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabaseEnabled =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDemoSave = propertyId.startsWith("mock-") || !supabaseEnabled;

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  const toggle = () => {
    const nextSaved = !saved;
    const previousSaved = saved;
    startTransition(async () => {
      setError(null);
      setNotice(null);

      if (isDemoSave) {
        setSaved(nextSaved);
        setNotice("Saved in demo mode. Connect Supabase and log in to sync.");
        return;
      }

      try {
        setSaved(nextSaved);
        const trimmedId = propertyId.trim();
        if (!trimmedId) {
          throw new Error("Unable to save: missing property id. Please refresh and try again.");
        }

        const method = nextSaved ? "POST" : "DELETE";
        const url =
          method === "DELETE"
            ? `/api/saved-properties?property_id=${propertyId}`
            : "/api/saved-properties";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ property_id: trimmedId }) : undefined,
        });
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("Please log in to save this listing.");
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to update saved state");
        }
      } catch (err) {
        setSaved(previousSaved);
        const message = err instanceof Error ? err.message : "Unable to update saved state";
        setError(message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={saved ? "secondary" : "primary"}
        size="sm"
        onClick={toggle}
        disabled={loading}
        aria-pressed={saved}
      >
        {loading ? "Saving..." : saved ? "Saved" : "Save property"}
      </Button>
      {notice && !error && (
        <p className="text-xs text-slate-600" aria-live="polite">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-600" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
