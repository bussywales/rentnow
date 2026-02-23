"use client";

type ListingImagePlaceholderProps = {
  label?: string;
};

export function ListingImagePlaceholder({
  label = "No photo yet",
}: ListingImagePlaceholderProps) {
  return (
    <div className="absolute inset-0 flex items-end bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50">
      <div className="w-full bg-gradient-to-t from-slate-900/70 via-slate-900/35 to-transparent p-3 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
              <path
                d="M2.5 3.5h11v9h-11z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="6" cy="7" r="1.1" fill="currentColor" />
              <path
                d="m4 11 2.2-2.3a.7.7 0 0 1 1 0L9 10.4l1.4-1.4a.7.7 0 0 1 1 0L13 10.7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}
