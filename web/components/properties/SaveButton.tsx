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

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  const toggle = () => {
    startTransition(async () => {
      setError(null);
      try {
        const method = saved ? "DELETE" : "POST";
        const url =
          method === "DELETE"
            ? `/api/saved-properties?property_id=${propertyId}`
            : "/api/saved-properties";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: method === "POST" ? JSON.stringify({ property_id: propertyId }) : undefined,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Unable to update saved state");
        }
        setSaved(!saved);
      } catch (err) {
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
      >
        {loading ? "Saving..." : saved ? "Saved" : "Save property"}
      </Button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
