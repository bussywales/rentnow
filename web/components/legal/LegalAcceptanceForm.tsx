"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Props = {
  jurisdiction: string;
  redirectTo?: string | null;
};

export function LegalAcceptanceForm({ jurisdiction, redirectTo }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!checked) {
      setError("You must agree to continue.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const missing = Array.isArray(data?.missing_audiences)
          ? data.missing_audiences.join(", ")
          : null;
        const message = data?.error || "Unable to record acceptance";
        setError(missing ? `${message} (Missing: ${missing})` : message);
        return;
      }
      router.replace(redirectTo || "/dashboard");
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1"
          disabled={pending}
        />
        <span>
          I have read and agree to the Terms & Conditions, policies, and acceptable use
          requirements listed above.
        </span>
      </label>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          {pending ? "Saving..." : "I agree"}
        </Button>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
