"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Props = {
  jurisdiction: string;
  redirectTo?: string | null;
};

export function LegalAcceptanceForm({ jurisdiction, redirectTo }: Props) {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!acceptedTerms || !acceptedDisclaimer) {
      setError("Please confirm both the terms and the disclaimer to continue.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jurisdiction,
          accept_terms: true,
          accept_disclaimer: true,
        }),
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
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
          className="mt-1"
          disabled={pending}
        />
        <span>
          I agree to the{" "}
          <Link href="/legal" className="font-semibold text-sky-700 hover:underline">
            Terms & Conditions
          </Link>{" "}
          and acceptable use requirements listed above.
        </span>
      </label>
      <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acceptedDisclaimer}
          onChange={(event) => setAcceptedDisclaimer(event.target.checked)}
          className="mt-1"
          disabled={pending}
        />
        <span>
          I understand the{" "}
          <Link
            href="/legal/disclaimer"
            className="font-semibold text-sky-700 hover:underline"
          >
            marketplace disclaimer
          </Link>{" "}
          and that listings are provided by independent hosts and agents.
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
