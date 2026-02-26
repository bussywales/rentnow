export type SharePayload = {
  title?: string;
  text?: string;
  url: string;
};

export type ShareActionResult = "shared" | "copied" | "dismissed" | "unavailable";

export type ShareClientDeps = {
  share?: ((data: SharePayload) => Promise<void>) | null;
  canShare?: ((data: SharePayload) => boolean) | null;
  writeClipboardText?: ((value: string) => Promise<void>) | null;
  execCopy?: ((value: string) => boolean) | null;
};

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError";
}

function copyWithExecCommand(value: string): boolean {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }

  return copied;
}

export function resolveShareClientDeps(): ShareClientDeps {
  if (typeof navigator === "undefined") {
    return {};
  }

  return {
    share:
      typeof navigator.share === "function"
        ? async (payload: SharePayload) => {
            await navigator.share(payload);
          }
        : null,
    canShare:
      typeof navigator.canShare === "function"
        ? (payload: SharePayload) => navigator.canShare(payload)
        : null,
    writeClipboardText:
      navigator.clipboard && typeof navigator.clipboard.writeText === "function"
        ? async (value: string) => {
            await navigator.clipboard.writeText(value);
          }
        : null,
    execCopy: copyWithExecCommand,
  };
}

export async function performShare(
  payload: SharePayload,
  deps: ShareClientDeps = resolveShareClientDeps()
): Promise<ShareActionResult> {
  if (deps.share) {
    const canShare = deps.canShare ? deps.canShare(payload) : true;
    if (canShare) {
      try {
        await deps.share(payload);
        return "shared";
      } catch (error) {
        if (isAbortError(error)) {
          return "dismissed";
        }
      }
    }
  }

  if (deps.writeClipboardText) {
    try {
      await deps.writeClipboardText(payload.url);
      return "copied";
    } catch {
      // Fall through to legacy copy fallback.
    }
  }

  if (deps.execCopy && deps.execCopy(payload.url)) {
    return "copied";
  }

  return "unavailable";
}
