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
  sm: 26,
  md: 28,
  lg: 36,
};

const textSizeMap: Record<BrandLogoSize, string> = {
  xs: "text-xs",
  sm: "text-[16px]",
  md: "text-[18px]",
  lg: "text-[20px]",
};

const gapMap: Record<BrandLogoSize, string> = {
  xs: "gap-1.5",
  sm: "gap-2",
  md: "gap-2",
  lg: "gap-2.5",
};

const toneMap: Record<BrandLogoVariant, string> = {
  header: "text-sky-700",
  footer: "text-slate-600",
  auth: "text-slate-900",
  minimal: "text-slate-900",
};

const imageSizeClassMap: Record<BrandLogoSize, string> = {
  xs: "h-5 w-5 max-h-5 max-w-5",
  sm: "h-[26px] w-[26px] max-h-[26px] max-w-[26px]",
  md: "h-[28px] w-[28px] max-h-[28px] max-w-[28px]",
  lg: "h-9 w-9 max-h-9 max-w-9",
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
  const imageSizeClass = imageSizeClassMap[size];
  const hasDarkLogo = String(BRAND_LOGO_DARK) !== String(BRAND_LOGO_LIGHT);
  const priority = variant === "header" || variant === "auth";

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center font-semibold leading-none", gap, tone, className)}
      aria-label={BRAND_NAME}
    >
      <Image
        src={BRAND_LOGO_LIGHT}
        alt={BRAND_NAME}
        width={dimension}
        height={dimension}
        priority={priority}
        className={cn(
          imageSizeClass,
          "shrink-0 object-contain",
          hasDarkLogo && "dark:hidden"
        )}
      />
      {hasDarkLogo && (
        <Image
          src={BRAND_LOGO_DARK}
          alt={BRAND_NAME}
          width={dimension}
          height={dimension}
          priority={priority}
          className={cn("hidden shrink-0 object-contain dark:block", imageSizeClass)}
        />
      )}
      {showWordmark && (
        <span className={cn(textSize, "tracking-tight leading-none")}>{BRAND_NAME}</span>
      )}
    </Link>
  );
}
