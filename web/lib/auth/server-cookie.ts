import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { isAuthCookieName } from "@/lib/auth/cookie-guard";

type CookieOptions = {
  domain?: string;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
  expires?: Date | string;
};

const RENTNOW_DOMAIN = "propatyhub.com";

type NormalizedCookieOptions = Omit<CookieOptions, "expires"> & {
  expires?: Date;
};

function normalizeHost(host?: string | null) {
  if (!host) return null;
  const raw = host.split(",")[0]?.trim();
  return raw?.split(":")[0] ?? null;
}

function resolveHostFromRequest(request?: NextRequest | null) {
  if (request) {
    return normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  }
  try {
    const store = headers();
    if (store && typeof (store as Promise<Headers>).then === "function") {
      return null;
    }
    const headerStore = store as unknown as Headers;
    return normalizeHost(
      headerStore.get("x-forwarded-host") || headerStore.get("host")
    );
  } catch {
    return null;
  }
}

function isLocalhost(host?: string | null) {
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function getServerAuthCookieDefaults(request?: NextRequest | null) {
  const host = resolveHostFromRequest(request);
  const secure = process.env.NODE_ENV === "production" && !isLocalhost(host);
  const domain =
    host && host.endsWith(RENTNOW_DOMAIN) ? `.${RENTNOW_DOMAIN}` : undefined;
  return {
    path: "/",
    sameSite: "lax" as const,
    secure,
    domain,
  };
}

function isPrimaryAuthCookie(name: string) {
  return isAuthCookieName(name) && !name.includes("code-verifier");
}

function normalizeExpires(value?: Date | string) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export function applyServerAuthCookieDefaults(
  name: string,
  options?: CookieOptions,
  request?: NextRequest | null
): NormalizedCookieOptions {
  if (!isAuthCookieName(name)) return (options ?? {}) as NormalizedCookieOptions;
  const defaults = getServerAuthCookieDefaults(request);
  const httpOnly = isPrimaryAuthCookie(name) ? true : options?.httpOnly;
  const merged: CookieOptions = {
    ...options,
    ...defaults,
    ...(httpOnly ? { httpOnly: true } : {}),
  };
  const normalized = { ...merged } as NormalizedCookieOptions;
  if (typeof merged.expires === "string") {
    const expires = normalizeExpires(merged.expires);
    if (expires) {
      normalized.expires = expires;
    } else {
      delete normalized.expires;
    }
  }
  return normalized;
}

export function shouldMirrorClientCookie(name: string) {
  return isPrimaryAuthCookie(name);
}

export function buildClientCookieOptions(
  options: NormalizedCookieOptions
): NormalizedCookieOptions {
  const rest: NormalizedCookieOptions = { ...options };
  delete rest.domain;
  delete rest.httpOnly;
  return rest;
}
