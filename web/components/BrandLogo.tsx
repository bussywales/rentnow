import { BrandLogo as NewBrandLogo } from "@/components/branding/BrandLogo";

type Props = {
  href?: string;
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

function mapSize(size?: number) {
  if (!size) return "md";
  if (size <= 20) return "xs";
  if (size <= 26) return "sm";
  if (size >= 34) return "lg";
  return "md";
}

export function BrandLogo({
  href = "/",
  size = 28,
  showWordmark = true,
  className,
}: Props) {
  return (
    <NewBrandLogo
      href={href}
      size={mapSize(size)}
      variant={showWordmark ? "header" : "minimal"}
      className={className}
    />
  );
}
