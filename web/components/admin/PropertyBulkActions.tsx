"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type BulkAction = "approve" | "reject";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export function PropertyBulkActions({ action }: Props) {
  const [mode, setMode] = useState<BulkAction>("approve");
  const isReject = mode === "reject";

  return (
    <form
      id="bulk-approvals"
      action={action}
      className="flex flex-col gap-3 md:flex-row md:items-end"
    >
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Bulk actions
        </p>
        <p className="text-xs text-slate-600">
          Select listings below to approve or reject them together.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="bulk-action"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
        >
          Bulk mode
        </label>
        <select
          id="bulk-action"
          name="action"
          value={mode}
          onChange={(event) => setMode(event.target.value as BulkAction)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
        >
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
      </div>
      {isReject && (
        <div className="min-w-[220px]">
          <Input
            name="reason"
            placeholder="Rejection reason"
            className="h-9"
            minLength={3}
            required
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" type="submit" variant={isReject ? "secondary" : "primary"}>
          {isReject ? "Reject selected" : "Approve selected"}
        </Button>
      </div>
    </form>
  );
}
