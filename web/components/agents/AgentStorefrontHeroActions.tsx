"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Props = {
  shareUrl: string;
  contactAnchor?: string;
};

export default function AgentStorefrontHeroActions({ shareUrl, contactAnchor }: Props) {
  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    null
  );
  const contactHref = `#${contactAnchor ?? "contact-agent"}`;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleShare = async () => {
    try {
      const target = typeof window !== "undefined" ? window.location.href : shareUrl;
      await navigator.clipboard.writeText(target);
      setToast({ message: "Link copied to clipboard.", variant: "success" });
    } catch {
      setToast({ message: "Unable to copy link.", variant: "error" });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={contactHref}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold",
            "bg-white text-slate-900 shadow-sm hover:bg-slate-100"
          )}
          data-testid="agent-storefront-contact-cta"
        >
          Contact
        </a>
        <Button
          type="button"
          variant="secondary"
          onClick={handleShare}
          className="bg-white/10 text-white hover:bg-white/20"
          data-testid="agent-storefront-share"
        >
          Share
        </Button>
      </div>
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <Alert
            title={toast.variant === "success" ? "Copied" : "Heads up"}
            description={toast.message}
            variant={toast.variant === "success" ? "success" : "error"}
            onClose={() => setToast(null)}
            className="pointer-events-auto"
          />
        </div>
      )}
    </>
  );
}
