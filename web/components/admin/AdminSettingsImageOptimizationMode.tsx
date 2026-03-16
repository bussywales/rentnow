"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import type { ImageOptimizationMode } from "@/lib/media/image-optimization-mode";

type Props = {
  mode: ImageOptimizationMode;
  updatedAt: string | null;
};

const OPTIONS: Array<{
  value: ImageOptimizationMode;
  label: string;
  helper: string;
}> = [
  {
    value: "vercel_default",
    label: "Vercel default",
    helper: "Keep current Next/Image optimisation behaviour.",
  },
  {
    value: "disable_non_critical",
    label: "Disable non-critical",
    helper:
      "Disable optimisation for shared non-critical image surfaces like rails, cards, and admin media panels.",
  },
  {
    value: "disable_all",
    label: "Disable all shared images",
    helper:
      "Disable optimisation for shared image wrappers, including gallery and carousel surfaces.",
  },
];

export default function AdminSettingsImageOptimizationMode({ mode, updatedAt }: Props) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ImageOptimizationMode>(mode);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setToast(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/app-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: APP_SETTING_KEYS.imageOptimizationMode,
            value: { value: draft },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || "Unable to update image optimisation mode.");
        }
        setToast("Image optimisation mode saved.");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to update image optimisation mode."
        );
      }
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Image optimisation mode</h2>
        <p className="text-sm text-slate-600">
          Operational control for shared image rendering when optimisation usage or cost spikes.
        </p>
        <p className="text-xs text-amber-700">
          This is an ops lever. It changes shared image delivery behaviour platform-wide and is not
          intended for routine experimentation.
        </p>
        <p className="text-xs text-slate-500">
          {updatedAt
            ? `Last updated ${new Date(updatedAt).toLocaleString()}`
            : "Default is Vercel default."}
        </p>
      </div>

      <label className="mt-4 block space-y-1 text-sm text-slate-700">
        <span className="font-medium">Mode</span>
        <select
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={draft}
          onChange={(event) => setDraft(event.target.value as ImageOptimizationMode)}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-2 text-xs text-slate-500">
        {OPTIONS.find((option) => option.value === draft)?.helper}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save image optimisation mode"}
        </Button>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {toast ? <p className="text-xs text-emerald-600">{toast}</p> : null}
      </div>
    </section>
  );
}
