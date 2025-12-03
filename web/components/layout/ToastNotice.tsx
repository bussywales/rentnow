"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";

export function ToastNotice() {
  const search = useSearchParams();
  const [visible, setVisible] = useState(true);
  const reason = search.get("reason");
  const notice = search.get("notice");

  useEffect(() => {
    if (!notice && !reason) return;
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [notice, reason]);

  if ((!notice && !reason) || (!visible && !notice)) return null;

  const message =
    notice ||
    (reason === "auth"
      ? "Please log in to continue."
      : reason === "role"
      ? "You don't have permission to access that area."
      : null);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
      <Alert
        title="Heads up"
        description={message}
        variant={reason === "role" ? "warning" : "info"}
        className="pointer-events-auto"
      />
    </div>
  );
}
