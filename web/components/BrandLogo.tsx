import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Props = {
  href?: string;
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

export function BrandLogo({
  href = "/",
  size = 28,
  showWordmark = true,
  className,
}: Props) {
  return (
    <Link href={href} className={className ?? "flex items-center gap-2 font-semibold"}>
      <Image
        src={BRAND.logo.light}
        alt={BRAND.name}
        width={size}
        height={size}
        priority
      />
      {showWordmark && (
        <span className="text-xl text-sky-600">{BRAND.shortName}</span>
      )}
    </Link>
  );
}
