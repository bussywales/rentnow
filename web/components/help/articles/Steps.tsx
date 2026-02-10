import type { ReactNode } from "react";

type Props = {
  items: ReactNode[];
};

export function Steps({ items }: Props) {
  if (!items.length) return null;

  return (
    <ol className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {index + 1}
          </span>
          <span className="leading-6">{item}</span>
        </li>
      ))}
    </ol>
  );
}
