"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { getActingAsCookieName } from "@/lib/acting-as";

type Delegation = {
  id: string;
  landlord_id: string;
  status: string;
  landlord?: {
    full_name?: string | null;
    business_name?: string | null;
    city?: string | null;
  } | null;
};

const COOKIE_NAME = getActingAsCookieName();

function readCookieValue() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return match.slice(COOKIE_NAME.length + 1) || null;
}

function labelFor(delegation: Delegation) {
  const landlord = delegation.landlord;
  if (landlord?.business_name) return landlord.business_name;
  if (landlord?.full_name) return landlord.full_name;
  if (landlord?.city) return `Landlord in ${landlord.city}`;
  return delegation.landlord_id;
}

export function ActingAsSelector() {
  const router = useRouter();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [value, setValue] = useState<string>("self");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = readCookieValue();
    if (current) {
      setValue(current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/agent-delegations");
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to load delegations.");
        }
        const json = await res.json();
        if (!cancelled) {
          setDelegations((json?.delegations as Delegation[]) || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load delegations.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    return [
      { value: "self", label: "My listings" },
      ...delegations.map((delegation) => ({
        value: delegation.landlord_id,
        label: labelFor(delegation),
      })),
    ];
  }, [delegations]);

  if (!delegations.length && !error) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Acting As
          </p>
          <p className="text-sm text-slate-700">
            Choose which landlord account you are managing.
          </p>
        </div>
        <div className="min-w-[220px]">
          <Select
            value={value}
            onChange={(event) => {
              const nextValue = event.target.value;
              setValue(nextValue);
              if (nextValue === "self") {
                document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
              } else {
                document.cookie = `${COOKIE_NAME}=${nextValue}; path=/; max-age=604800`;
              }
              router.refresh();
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-amber-700">
          {error}
        </p>
      )}
    </div>
  );
}
