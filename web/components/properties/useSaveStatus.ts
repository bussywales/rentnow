"use client";

import { useEffect, useState } from "react";
import { SaveStatusManager, type SaveStatus } from "@/lib/properties/save-status";

export function useSaveStatus(listingId?: string | null) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [manager] = useState(() => new SaveStatusManager(setStatus));

  useEffect(() => {
    manager.reset();
  }, [listingId, manager]);

  return {
    status,
    setSaving: (retry?: () => void) => manager.setSaving(retry),
    setSaved: () => manager.setSaved(),
    setError: (retry?: () => void) => manager.setError(retry),
    setSubmitting: () => manager.setSubmitting(),
    setSubmitted: () => manager.setSubmitted(),
    retry: () => manager.triggerRetry(),
  };
}
