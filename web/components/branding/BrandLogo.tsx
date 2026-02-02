import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import {
  BRAND_LOGO_DARK,
  BRAND_LOGO_LIGHT,
  BRAND_NAME,
} from "@/lib/brand";

type BrandLogoVariant = "header" | "footer" | "auth" | "minimal";
type BrandLogoSize = "xs" | "sm" | "md" | "lg";

type Props = {
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  href?: string;
};

const sizeMap: Record<BrandLogoSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
};

const textSizeMap: Record<BrandLogoSize, string> = {
  xs: "text-sm",
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

const gapMap: Record<BrandLogoSize, string> = {
  xs: "gap-1.5",
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

const toneMap: Record<BrandLogoVariant, string> = {
  header: "text-sky-700",
  footer: "text-slate-600",
  auth: "text-slate-900",
  minimal: "text-slate-900",
};

export function BrandLogo({
  variant = "header",
  size = "md",
  className,
  href = "/",
}: Props) {
  const showWordmark = variant !== "minimal";
  const dimension = sizeMap[size];
  const textSize = textSizeMap[size];
  const gap = gapMap[size];
  const tone = toneMap[variant];
  const hasDarkLogo = String(BRAND_LOGO_DARK) !== String(BRAND_LOGO_LIGHT);
  const priority = variant === "header" || variant === "auth";

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center font-semibold", gap, tone, className)}
      aria-label={BRAND_NAME}
    >
      <Image
        src={BRAND_LOGO_LIGHT}
        alt={BRAND_NAME}
        width={dimension}
        height={dimension}
        priority={priority}
        className={cn("h-auto w-auto", hasDarkLogo && "dark:hidden")}
      />
      {hasDarkLogo && (
        <Image
          src={BRAND_LOGO_DARK}
          alt={BRAND_NAME}
          width={dimension}
          height={dimension}
          priority={priority}
          className="hidden h-auto w-auto dark:block"
        />
      )}
      {showWordmark && (
        <span className={cn(textSize, "tracking-tight leading-none")}>{BRAND_NAME}</span>
      )}
    </Link>
  );
}
