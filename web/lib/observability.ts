import { getEnvPresence } from "@/lib/env";

type LogLevel = "error" | "warn";

type FailureLogInput = {
  request: Request;
  route: string;
  status: number;
  startTime: number;
  level?: LogLevel;
  error?: unknown;
};

function normalizeError(error: unknown) {
  if (!error) return undefined;
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  if (typeof error === "object") {
    const maybeName = (error as { name?: string }).name;
    const maybeMessage = (error as { message?: string }).message;
    if (maybeName || maybeMessage) {
      return {
        name: maybeName || "Error",
        message: maybeMessage || "Unknown error",
      };
    }
  }
  return { name: "Error", message: "Unknown error" };
}

export function getRequestId(request?: Request) {
  const headerId =
    request?.headers.get("x-request-id") || request?.headers.get("x-vercel-id");
  if (headerId) return headerId;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logFailure({
  request,
  route,
  status,
  startTime,
  level = "error",
  error,
}: FailureLogInput) {
  const durationMs = Math.max(0, Date.now() - startTime);
  const payload = {
    level,
    route,
    requestId: getRequestId(request),
    status,
    durationMs,
    url: request.url,
    method: request.method,
    env: getEnvPresence(),
    error: normalizeError(error),
  };

  console.error(JSON.stringify(payload));
}
