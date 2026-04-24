import { cn } from "@/components/ui/cn";
import type { ReactNode } from "react";

export function SectionShell({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export function SectionIntro({
  label,
  heading,
  subheading,
  align = "left",
  tone = "default",
}: {
  label?: string;
  heading: string;
  subheading?: string;
  align?: "left" | "center";
  tone?: "default" | "inverse";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center") }>
      {label ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.24em]",
            tone === "inverse" ? "text-sky-200" : "text-sky-700"
          )}
        >
          {label}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight sm:text-4xl",
          tone === "inverse" ? "text-white" : "text-slate-950"
        )}
      >
        {heading}
      </h2>
      {subheading ? (
        <p
          className={cn(
            "mt-4 text-base leading-7 sm:text-lg",
            tone === "inverse" ? "text-slate-300" : "text-slate-600"
          )}
        >
          {subheading}
        </p>
      ) : null}
    </div>
  );
}

export function AccentGrid({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 240"
      className={cn("pointer-events-none absolute text-sky-200/70", className)}
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="1.2">
        <path d="M30 210 110 130 145 165 205 105 290 155" />
        <path d="M42 190h44v-42H42z" />
        <path d="M102 146h44v-44h-44z" />
        <path d="M168 178h52v-52h-52z" />
        <path d="M228 132h40V92h-40z" />
        <path d="M42 190v-72" />
        <path d="M124 102V56" />
        <path d="M194 126V64" />
        <path d="M248 92V38" />
      </g>
    </svg>
  );
}

export function IconBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "soft" }) {
  return (
    <span
      className={cn(
        "inline-flex h-12 w-12 items-center justify-center rounded-2xl border",
        tone === "default"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-white/20 bg-white/10 text-white"
      )}
    >
      {children}
    </span>
  );
}

export function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function BriefcaseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M4 9.5h16v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M4 11c2.8 1.6 5.47 2.4 8 2.4s5.2-.8 8-2.4" />
    </svg>
  );
}

export function CompassIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="m14.8 9.2-1.6 5.6-5.6 1.6 1.6-5.6z" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M20 21v-1.2a3.6 3.6 0 0 0-2.5-3.42" />
      <path d="M15.5 4.9a3.5 3.5 0 0 1 0 6.2" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v3M17 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="15" rx="2" />
    </svg>
  );
}

export function RocketIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c1.5-4.5 4.5-8.5 10-14 0 5.5-1.5 9.5-6 14" />
      <path d="M9 15 5 19l-1-5 4 1Z" />
      <circle cx="14.5" cy="9.5" r="1.5" />
    </svg>
  );
}

export function ListingIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5c0 4.5 2.8 7.6 7 10 4.2-2.4 7-5.5 7-10V6z" />
      <path d="m9.5 12 1.8 1.8 3.2-3.6" />
    </svg>
  );
}
