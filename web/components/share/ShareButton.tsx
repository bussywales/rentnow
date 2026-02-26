"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { performShare } from "@/lib/share/client-share";

type ShareButtonProps = {
  title: string;
  url: string;
  text?: string;
  className?: string;
  testId?: string;
};

type ShareFeedback = {
  tone: "success" | "error";
  message: string;
};

export function ShareButton({ title, url, text, className, testId = "share-button" }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<ShareFeedback | null>(null);
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    const result = await performShare({
      title,
      text,
      url,
    });

    if (result === "copied" || result === "shared") {
      setFeedback({ tone: "success", message: "Link copied." });
      setBusy(false);
      return;
    }

    if (result === "dismissed") {
      setFeedback(null);
      setBusy(false);
      return;
    }

    setFeedback({ tone: "error", message: "Unable to share this link right now." });
    setBusy(false);
  };

  return (
    <div className={className}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          void handleShare();
        }}
        aria-label="Share collection"
        data-testid={testId}
        disabled={busy}
      >
        Share
      </Button>
      {feedback ? (
        <p
          className={`mt-1 text-xs ${feedback.tone === "success" ? "text-emerald-700" : "text-rose-600"}`}
          data-testid="share-copy-success"
          aria-live="polite"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
