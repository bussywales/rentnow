"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { canConsumeSuccessForPath, getToastPayloadFromQuery, removeSuccessFromQuery, type ToastPayload } from "@/lib/utils/toast";

export function ToastNotice() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const searchText = search.toString();
  const allowSuccess = canConsumeSuccessForPath(pathname);

  useEffect(() => {
    const params = new URLSearchParams(searchText);
    const payload = getToastPayloadFromQuery(params, { allowSuccess });
    if (!payload) return;

    // Queue state updates to avoid synchronous effect-state cascades.
    queueMicrotask(() => {
      setToast(payload);
      setVisible(true);
    });

    if (allowSuccess && params.has("success")) {
      const nextParams = removeSuccessFromQuery(params);
      const qs = nextParams.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [allowSuccess, pathname, router, searchText]);

  useEffect(() => {
    if (!toast || !visible) return;
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [toast, visible]);

  if (!toast || !visible) return null;

  const handleClose = () => {
    setVisible(false);
    // Clean query params so the toast doesn't reappear on navigation.
    const params = new URLSearchParams(searchText);
    params.delete("notice");
    params.delete("reason");
    if (allowSuccess) {
      params.delete("success");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
      <Alert
        title="Heads up"
        description={toast.message}
        variant={toast.variant}
        className="pointer-events-auto"
        onClose={handleClose}
      />
    </div>
  );
}
