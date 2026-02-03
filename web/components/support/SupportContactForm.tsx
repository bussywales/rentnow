"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SUPPORT_CATEGORY_HELP,
  SUPPORT_CATEGORY_OPTIONS,
  type SupportCategory,
} from "@/lib/support/support-content";

type Props = {
  prefillName?: string | null;
  prefillEmail?: string | null;
  category: SupportCategory;
  helperText?: string | null;
  onCategoryChange: (value: SupportCategory) => void;
};

const urgencyOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

export default function SupportContactForm({
  prefillName,
  prefillEmail,
  category,
  helperText,
  onCategoryChange,
}: Props) {
  const [name, setName] = useState(prefillName ?? "");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [message, setMessage] = useState("");
  const [listingRef, setListingRef] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const showListingField = category === "listing" || category === "safety";
  const helperCopy = helperText || SUPPORT_CATEGORY_HELP[category];

  const composedMessage = useMemo(() => {
    const trimmed = message.trim();
    const metadata: string[] = [];
    if (showListingField && listingRef.trim()) {
      metadata.push(`Listing: ${listingRef.trim()}`);
    }
    if (urgency && urgency !== "normal") {
      const label =
        urgencyOptions.find((option) => option.value === urgency)?.label || "Normal";
      metadata.push(`Urgency: ${label}`);
    }
    if (!metadata.length) return trimmed;
    return `${trimmed}\n\n${metadata.join("\n")}`;
  }, [message, listingRef, urgency, showListingField]);

  const logSupportEvent = (event: string, payload?: Record<string, unknown>) => {
    if (typeof window === "undefined") return;
    try {
      console.info("[support]", event, payload ?? {});
    } catch {
      // ignore logging failures
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessId(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name,
          email,
          message: composedMessage,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to submit request.");
        logSupportEvent("submit_error", {
          category,
          status: res.status,
          error: data?.error || "Unable to submit request.",
        });
        return;
      }
      setSuccessId(data?.id ?? null);
      setSuccess(true);
      setMessage("");
      logSupportEvent("submit_success", { category, id: data?.id ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit request.");
      logSupportEvent("submit_error", {
        category,
        error: err instanceof Error ? err.message : "Unable to submit request.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="support-form">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            data-testid="support-name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
            autoComplete="email"
            data-testid="support-email"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500">Topic</label>
        <select
          value={category}
          onChange={(e) => {
            const value = e.target.value;
            onCategoryChange(value as SupportCategory);
            logSupportEvent("category_selected", { category: value });
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          data-testid="support-category"
        >
          {SUPPORT_CATEGORY_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">{helperCopy}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {showListingField && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500">
              Listing link or ID (optional)
            </label>
            <Input
              value={listingRef}
              onChange={(e) => setListingRef(e.target.value)}
              placeholder="https://propatyhub.com/properties/..."
              data-testid="support-listing-ref"
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500">Urgency</label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
            data-testid="support-urgency"
          >
            {urgencyOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500">Details</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          minLength={10}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          placeholder="Share the key details so we can help fast."
          data-testid="support-message"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-700">
          We&apos;ve received your message.
          {successId ? ` Reference #${successId}` : ""}
        </p>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Send to support"}
      </Button>
    </form>
  );
}
