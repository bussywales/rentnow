import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { BRAND_MARK, BRAND_NAME } from "@/lib/brand";

type BrandMarkSize = "sm" | "md" | "lg";

type Props = {
  size?: BrandMarkSize;
  className?: string;
};

const sizeMap: Record<BrandMarkSize, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

export function BrandMark({ size = "md", className }: Props) {
  const dimension = sizeMap[size];
  return (
    <span className={cn("inline-flex", className)} aria-label={BRAND_NAME}>
      <Image
        src={BRAND_MARK}
        alt={BRAND_NAME}
        width={dimension}
        height={dimension}
        className="h-auto w-auto"
      />
    </span>
  );
}
