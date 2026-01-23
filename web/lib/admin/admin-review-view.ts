import { useMemo, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type AdminReviewView = "pending" | "changes" | "approved" | "all";

const ALLOWED_VIEWS: AdminReviewView[] = ["pending", "changes", "approved", "all"];
const STORAGE_KEY = "admin.review.view.v1";

export function normalizeView(value: string | null | undefined): AdminReviewView {
  if (!value) return "pending";
  const lower = value.toLowerCase();
  if (ALLOWED_VIEWS.includes(lower as AdminReviewView)) {
    return lower as AdminReviewView;
  }
  return "pending";
}

export function getStoredView(): AdminReviewView | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeView(raw) : null;
}

export function setStoredView(view: AdminReviewView) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, view);
}

export function useAdminReviewView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawViewParam = searchParams?.get("view");
  const viewFromUrl = useMemo(
    () => (rawViewParam ? normalizeView(rawViewParam) : null),
    [rawViewParam]
  );
  const [storedView, setStoredViewState] = useState<AdminReviewView | null>(() => getStoredView());
  const view = viewFromUrl ?? storedView ?? "pending";

  const updateView = useCallback(
    (next: AdminReviewView) => {
      setStoredViewState(next);
      setStoredView(next);
      const params = new URLSearchParams(searchParams?.toString());
      if (next === "pending") {
        params.delete("view");
      } else {
        params.set("view", next);
      }
      const id = params.get("id");
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      if (!id && typeof window !== "undefined") {
        window.history.replaceState({}, "", `${pathname}${qs ? `?${qs}` : ""}`);
      }
    },
    [pathname, router, searchParams]
  );

  const resetView = useCallback(() => {
    setStoredViewState("pending");
    setStoredView("pending");
    const params = new URLSearchParams(searchParams?.toString());
    params.delete("view");
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, router, searchParams]);

  return { view, updateView, resetView };
}
