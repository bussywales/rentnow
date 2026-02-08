"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/components/ui/cn";
import type { AgentOnboardingProgress } from "@/lib/agents/agent-onboarding.server";

type Props = {
  progress: AgentOnboardingProgress;
};

const CREATE_LISTING_URL = "/dashboard/properties/new";
const CLIENT_PAGES_URL = "/profile/clients";

export default function AgentOnboardingChecklist({ progress }: Props) {
  const router = useRouter();
  const [state, setState] = useState(progress);
  const [toast, setToast] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setHidden(true), 2500);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const completedCount = useMemo(() => {
    return [state.hasListing, state.hasClientPage, state.hasSharedPage].filter(Boolean).length;
  }, [state.hasListing, state.hasClientPage, state.hasSharedPage]);

  const totalSteps = 3;

  const handleCopy = async () => {
    if (!state.publishedPageUrl) {
      router.push(CLIENT_PAGES_URL);
      return;
    }

    try {
      let copied = true;
      try {
        await navigator.clipboard.writeText(state.publishedPageUrl);
      } catch {
        copied = false;
      }
      const response = await fetch("/api/agent/onboarding/share-complete", {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to save progress.");
      }
      setState((prev) => ({
        ...prev,
        hasSharedPage: true,
        completed: data?.progress?.completed ?? prev.completed,
        completedAt: data?.progress?.completedAt ?? prev.completedAt,
      }));
      setToast(
        copied
          ? "Link copied. We’ll remember this step."
          : "Link saved. Share it from client pages when you’re ready."
      );
      if (data?.progress?.completed) {
        setShowSuccess(true);
      }
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to copy link.");
    }
  };

  if (showSuccess) {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900"
        data-testid="agent-onboarding-success"
      >
        <p className="text-sm font-semibold">You’re all set 🎉</p>
        <p className="mt-1 text-sm text-emerald-800">
          Client pages are now part of your workflow.
        </p>
      </div>
    );
  }

  if (hidden || state.completedAt) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      data-testid="agent-onboarding-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Get started with PropatyHub
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Set up once, then reuse this flow for every client.
          </h2>
        </div>
        <span className="text-sm font-semibold text-slate-600">
          {completedCount} of {totalSteps} completed
        </span>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold",
                state.hasListing
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 text-slate-400"
              )}
            >
              {state.hasListing ? "✓" : "1"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Create your first listing</p>
              <p className="text-xs text-slate-600">
                Add a property you’re representing so clients have something to view.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push(CREATE_LISTING_URL)}
            disabled={state.hasListing}
            data-testid="agent-onboarding-listing-cta"
          >
            Create listing
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold",
                state.hasClientPage
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 text-slate-400"
              )}
            >
              {state.hasClientPage ? "✓" : "2"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Create a client page</p>
              <p className="text-xs text-slate-600">
                Build a short, shareable page tailored to a specific client’s needs.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push(CLIENT_PAGES_URL)}
            disabled={state.hasClientPage}
            data-testid="agent-onboarding-client-page-cta"
          >
            Create client page
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold",
                state.hasSharedPage
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 text-slate-400"
              )}
            >
              {state.hasSharedPage ? "✓" : "3"}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Share the link with your client</p>
              <p className="text-xs text-slate-600">
                Send one clean link instead of multiple screenshots or messages.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={state.publishedPageUrl ? "primary" : "secondary"}
            onClick={handleCopy}
            data-testid="agent-onboarding-share-cta"
          >
            {state.publishedPageUrl ? "Copy client page link" : "Publish a client page"}
          </Button>
        </div>
      </div>

      {toast && (
        <div className="mt-3">
          <Alert
            title="Update"
            description={toast}
            variant="success"
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}
