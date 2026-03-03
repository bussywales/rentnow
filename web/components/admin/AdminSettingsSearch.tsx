"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
};

export function AdminSettingsSearch({
  value,
  onChange,
  onClear,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="admin-settings-search" className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Find setting
          </label>
          <Input
            id="admin-settings-search"
            data-testid="admin-settings-search"
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search settings..."
          />
        </div>
        <div className="flex items-center gap-2 sm:self-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClear}
            disabled={!value.trim()}
          >
            Clear search
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Showing {resultCount} of {totalCount} section{totalCount === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
