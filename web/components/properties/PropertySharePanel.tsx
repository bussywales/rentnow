"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPropertyShareExpiry } from "@/lib/sharing/property-share";

type ShareResponse = {
  id: string;
  link: string;
  expires_at: string | null;
  revoked_at?: string | null;
};

type Props = {
  propertyId: string;
};

export function PropertySharePanel({ propertyId }: Props) {
  const [open, setOpen] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadLink = async (rotate: boolean) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/share/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, rotate }),
      });
      const data = (await res.json().catch(() => null)) as ShareResponse & { error?: string };
      if (!res.ok) {
        setError(data?.error || "Unable to create share link.");
        return;
      }
      setShareId(data.id);
      setShareLink(data.link);
      setExpiresAt(data.expires_at ?? null);
    } catch (err) {
      console.warn("Failed to create share link", err);
      setError("Unable to create share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleRotate = async () => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/share/property/${encodeURIComponent(shareId)}/rotate`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as ShareResponse & { error?: string };
      if (!res.ok) {
        setError(data?.error || "Unable to rotate share link.");
        return;
      }
      setShareId(data.id);
      setShareLink(data.link);
      setExpiresAt(data.expires_at ?? null);
    } catch (err) {
      console.warn("Failed to rotate share link", err);
      setError("Unable to rotate share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!shareId) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/share/property/${encodeURIComponent(shareId)}/revoke`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to revoke share link.");
        return;
      }
      setShareId(null);
      setShareLink(null);
      setExpiresAt(null);
    } catch (err) {
      console.warn("Failed to revoke share link", err);
      setError("Unable to revoke share link.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !shareLink) {
      void loadLink(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Share property</p>
          <p className="text-xs text-slate-600">Create a private link to this listing.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={handleToggle}>
          {open ? "Hide" : "Share"}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {shareLink ? (
            <div className="space-y-2">
              <Input readOnly value={shareLink} className="h-9" />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" type="button" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={handleRotate} disabled={loading}>
                  Rotate link
                </Button>
                <Button size="sm" type="button" variant="secondary" onClick={handleRevoke} disabled={loading}>
                  Revoke
                </Button>
              </div>
              <p className="text-xs text-slate-500">{formatPropertyShareExpiry(expiresAt)}</p>
            </div>
          ) : (
            <Button size="sm" type="button" onClick={() => loadLink(false)} disabled={loading}>
              {loading ? "Generating..." : "Generate link"}
            </Button>
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
