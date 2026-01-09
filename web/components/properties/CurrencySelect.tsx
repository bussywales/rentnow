"use client";

import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/Input";
import { CURRENCY_CODES, TOP_CURRENCIES, normalizeCurrency } from "@/lib/currencies";

type CurrencyDisplayNames = {
  of: (code: string) => string | undefined;
};

type CurrencyDisplayNamesCtor = new (
  locales: string | string[],
  options: { type: "currency" }
) => CurrencyDisplayNames;

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function CurrencySelect({ id, value, onChange, placeholder, disabled }: Props) {
  const listId = useId();
  const [draft, setDraft] = useState(() => normalizeCurrency(value) ?? value);

  const displayNames = useMemo(() => {
    if (typeof Intl === "undefined") return null;
    const DisplayNames = (Intl as unknown as { DisplayNames?: CurrencyDisplayNamesCtor })
      .DisplayNames;
    if (!DisplayNames) return null;
    try {
      return new DisplayNames(["en"], { type: "currency" });
    } catch {
      return null;
    }
  }, []);

  const options = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        code,
        label: displayNames?.of(code) ?? null,
      })),
    [displayNames]
  );

  const handleChange = (nextValue: string) => {
    setDraft(nextValue);
    const normalized = normalizeCurrency(nextValue);
    if (normalized && normalized !== value) {
      onChange(normalized);
    }
  };

  const handleBlur = () => {
    const normalized = normalizeCurrency(draft);
    if (normalized) {
      if (normalized !== value) {
        onChange(normalized);
      }
      setDraft(normalized);
    } else {
      setDraft(normalizeCurrency(value) ?? value);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Top:</span>
        {TOP_CURRENCIES.map((code) => (
          <button
            key={code}
            type="button"
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 transition hover:border-slate-300"
            onClick={() => handleChange(code)}
            disabled={disabled}
            aria-label={`Set currency to ${code}`}
          >
            {code}
          </button>
        ))}
      </div>
      <Input
        id={id}
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        list={listId}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option
            key={option.code}
            value={option.code}
            label={option.label ?? option.code}
          >
            {option.label ?? option.code}
          </option>
        ))}
      </datalist>
    </div>
  );
}
