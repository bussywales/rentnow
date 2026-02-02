"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const categories = [
  { value: "general", label: "General" },
  { value: "account", label: "Account" },
  { value: "listing", label: "Listing" },
  { value: "safety", label: "Safety" },
  { value: "billing", label: "Billing" },
];

export default function SupportContactForm() {
  const [category, setCategory] = useState("general");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

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
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name, email, message }),
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            type="email"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Category</label>
        <select
          value={category}
          onChange={(e) => {
            const value = e.target.value;
            setCategory(value);
            logSupportEvent("category_selected", { category: value });
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-600">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          minLength={10}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Tell us what you need help with."
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {successId && (
        <p className="text-sm text-emerald-700">Request received. Reference #{successId}</p>
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Send to support"}
      </Button>
    </form>
  );
}
