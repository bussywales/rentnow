"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  propertyId: string;
  isDemo: boolean;
  onUpdated?: (next: boolean) => void;
  onToast?: (message: string) => void;
  buttonClassName?: string;
  dataTestId?: string;
};

export default function AdminDemoToggleButton({
  propertyId,
  isDemo,
  onUpdated,
  onToast,
  buttonClassName,
  dataTestId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextIsDemo = !isDemo;
  const title = nextIsDemo ? "Mark listing as demo?" : "Remove demo status?";

  const handleConfirm = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/properties/${propertyId}/demo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_demo: nextIsDemo }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update demo status.");
      }
      const updated = Boolean(payload?.is_demo);
      onUpdated?.(updated);
      onToast?.("Updated");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update demo status.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
          setError(null);
        }}
        className={
          buttonClassName ||
          "rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
        }
        data-testid={dataTestId}
      >
        {nextIsDemo ? "Mark as demo" : "Remove demo"}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/40 px-4"
          role="dialog"
          aria-modal="true"
          data-testid="admin-demo-confirm-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <p>
                This listing will show a Demo badge/watermark depending on platform settings.
              </p>
              <p>
                Demo listings may be excluded from search/browse if that exclusion toggle is
                enabled.
              </p>
            </div>
            {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={pending}
                data-testid="admin-demo-cancel"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={pending}
                data-testid="admin-demo-confirm"
              >
                {pending ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
