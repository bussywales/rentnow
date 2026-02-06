"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type Props = {
  shareUrl: string;
  contactAnchor?: string;
};

export default function AgentStorefrontHeroActions({ shareUrl, contactAnchor }: Props) {
  const [copyState, setCopyState] = useState<string | null>(null);
  const contactHref = `#${contactAnchor ?? "contact-agent"}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("Copied");
      setTimeout(() => setCopyState(null), 2000);
    } catch {
      setCopyState("Copy failed");
      setTimeout(() => setCopyState(null), 2000);
    }
  };

  return (
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
        {copyState ? copyState : "Share link"}
      </Button>
    </div>
  );
}
