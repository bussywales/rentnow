import type { BrandSocialPlatform } from "@/lib/brand-socials";

type SocialIconLinkProps = {
  platform: BrandSocialPlatform;
  href: string;
  label: string;
  className?: string;
  iconClassName?: string;
  "data-testid"?: string;
};

function SocialIcon({ platform, className }: { platform: BrandSocialPlatform; className?: string }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
        <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
      </svg>
    );
  }

  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
        <rect x="3.5" y="6.5" width="17" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 9.5 15 12l-5 2.5Z" fill="currentColor" />
      </svg>
    );
  }

  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
        <path
          d="M14 5v8.2a3.7 3.7 0 1 1-2.7-3.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 5c.8 1.7 2.2 2.8 4 3.2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
        <path
          d="M13.2 20V12.8h2.4l.4-2.9h-2.8V8.1c0-.8.3-1.4 1.5-1.4H16V4.1c-.2 0-1-.1-1.9-.1-2.3 0-3.9 1.4-3.9 4v1.9H8v2.9h2.2V20h3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path
        d="M19 4.8A9.6 9.6 0 0 0 4.6 16.3L4 20l3.9-.6A9.6 9.6 0 1 0 19 4.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 10.3c.3 1.2 1.6 2.8 2.6 3.4.5.4 1 .4 1.5.1l1.2-.7c.3-.2.7-.1 1 .1l1 .9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SocialIconLink({
  platform,
  href,
  label,
  className,
  iconClassName = "h-4 w-4",
  "data-testid": dataTestId,
}: SocialIconLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={
        className ||
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
      }
      data-testid={dataTestId}
    >
      <SocialIcon platform={platform} className={iconClassName} />
      <span className="sr-only">{label}</span>
    </a>
  );
}
