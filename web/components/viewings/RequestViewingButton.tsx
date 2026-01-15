"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

type Props = {
  propertyId: string;
  disabled?: boolean;
};

type FormState = {
  times: string[];
  message: string;
};

const MAX_TIMES = 3;

export function RequestViewingButton({ propertyId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    times: [""],
    message: "",
  });

  const addTime = () => {
    if (form.times.length >= MAX_TIMES) return;
    setForm((prev) => ({ ...prev, times: [...prev.times, ""] }));
  };

  const updateTime = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.times];
      next[index] = value;
      return { ...prev, times: next };
    });
  };

  const updateMessage = (value: string) => {
    setForm((prev) => ({ ...prev, message: value.slice(0, 500) }));
  };

  const removeTime = (index: number) => {
    setForm((prev) => {
      const next = prev.times.filter((_, i) => i !== index);
      return { ...prev, times: next.length ? next : [""] };
    });
  };

  const handleSubmit = async () => {
    setError(null);
    const times = form.times.filter((t) => t && t.trim().length > 0);
    if (times.length === 0 || times.length > MAX_TIMES) {
      setError("Add 1 to 3 preferred times.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/viewings/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          preferredTimes: times,
          message: form.message || undefined,
        }),
      });
      if (!res.ok) {
        setError("We couldn't send your request. Please try again.");
      } else {
        setSuccess(true);
        setOpen(false);
      }
    } catch (err) {
      console.error("viewing request failed", err);
      setError("We couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        data-testid="request-viewing-button"
        onClick={() => setOpen(true)}
        disabled={disabled || success}
      >
        {success || disabled ? "Viewing requested" : "Request a viewing"}
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl outline outline-1 outline-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">Request a viewing</p>
                <p className="text-sm text-slate-600">
                  Share 1–3 times that work for you. We will send the host your request.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {form.times.map((value, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Preferred time {idx + 1}
                    </label>
                    <Input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => updateTime(idx, e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  {form.times.length > 1 && (
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      onClick={() => removeTime(idx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {form.times.length < MAX_TIMES && (
                <button
                  type="button"
                  className="text-sm font-semibold text-sky-700 hover:text-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  onClick={addTime}
                >
                  + Add another time
                </button>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Message (optional)
                </label>
                <Textarea
                  value={form.message}
                  onChange={(e) => updateMessage(e.target.value)}
                  className="mt-1"
                  rows={3}
                  maxLength={500}
                  placeholder="Share any preferences or context"
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                data-testid="submit-viewing-button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send request"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
