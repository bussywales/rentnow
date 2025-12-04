"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";

export function ToastNotice() {
  const search = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const reason = search.get("reason");
  const notice = search.get("notice");
  const success = search.get("success");

  useEffect(() => {
    if (!notice && !reason && !success) return;
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [notice, reason, success]);

  const hasMessage = notice || reason || success;
  if (!hasMessage || (!visible && !notice && !success)) return null;

  const message =
    notice ||
    success ||
    (reason === "auth"
      ? "Please log in to continue."
      : reason === "role"
      ? "You don't have permission to access that area."
      : null);

  if (!message) return null;

  const variant =
    success ? "success" : reason === "role" ? "warning" : "info";

  const handleClose = () => {
    setVisible(false);
    // Clean query params so the toast doesn't reappear on navigation.
    const params = new URLSearchParams(search.toString());
    params.delete("notice");
    params.delete("reason");
    params.delete("success");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : ".", { scroll: false });
  };

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
      <Alert
        title="Heads up"
        description={message}
        variant={variant}
        className="pointer-events-auto"
        onClose={handleClose}
      />
    </div>
  );
}
