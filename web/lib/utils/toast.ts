export function setToastQuery(params: URLSearchParams, message: string, type: "success" | "info" | "warning" = "info") {
  if (type === "success") {
    params.set("success", message);
  } else {
    params.set("notice", message);
  }
  return params;
}

export type ToastVariant = "success" | "info" | "warning";

export type ToastPayload = {
  message: string;
  variant: ToastVariant;
};

const SUCCESS_TOAST_PATH_ALLOWLIST = ["/properties", "/dashboard"] as const;

export function canConsumeSuccessForPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SUCCESS_TOAST_PATH_ALLOWLIST.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));
}

export function getToastPayloadFromQuery(
  params: URLSearchParams,
  options?: {
    allowSuccess?: boolean;
  }
): ToastPayload | null {
  const success = options?.allowSuccess === false ? null : params.get("success");
  const notice = params.get("notice");
  const reason = params.get("reason");

  const message =
    notice ||
    success ||
    (reason === "auth"
      ? "Please log in to continue."
      : reason === "role"
      ? "You don't have permission to access that area."
      : null);

  if (!message) return null;
  return {
    message,
    variant: success ? "success" : reason === "role" ? "warning" : "info",
  };
}

export function removeSuccessFromQuery(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete("success");
  return next;
}
