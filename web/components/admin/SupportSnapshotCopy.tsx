"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  payload: Record<string, unknown> | unknown[];
  label?: string;
  successLabel?: string;
};

export function SupportSnapshotCopy({ payload, label = "Copy support snapshot", successLabel = "Copied" }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 1500);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" type="button" onClick={handleCopy}>
        {status === "copied" ? successLabel : label}
      </Button>
      {status === "error" && (
        <span className="text-xs text-rose-600">Copy failed</span>
      )}
    </div>
  );
}
