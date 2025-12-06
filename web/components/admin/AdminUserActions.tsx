"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  userId: string;
  email?: string;
  serviceReady: boolean;
};

export function AdminUserActions({ userId, email, serviceReady }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const post = async (body: Record<string, string>) => {
    setStatus("loading");
    setMessage(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    setStatus("done");
  };

  const handleReset = async () => {
    try {
      await post({ action: "reset_password", userId, email: email || "" });
      setMessage("Reset email sent.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const handleDelete = async () => {
    const ok = confirm("Delete this user? This cannot be undone.");
    if (!ok) return;
    try {
      await post({ action: "delete", userId });
      setMessage("User deleted.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" onClick={handleReset} disabled={!serviceReady || !email || status === "loading"}>
          {status === "loading" ? "Working..." : "Send reset email"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={handleDelete}
          disabled={!serviceReady || status === "loading"}
        >
          Delete user
        </Button>
      </div>
      {message && <p className="text-xs text-slate-600">{message}</p>}
      {status === "error" && !message && <p className="text-xs text-rose-600">Action failed.</p>}
    </div>
  );
}
