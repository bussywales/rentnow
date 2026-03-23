import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";
import { buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  PropsWithChildren & {
    variant?: "primary" | "secondary" | "ghost";
    size?: "sm" | "md" | "lg";
  };

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}
