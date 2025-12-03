import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/ui/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500",
        secondary:
          "bg-white text-slate-900 border border-slate-200 hover:border-slate-300 focus-visible:ring-slate-200",
        ghost:
          "bg-transparent text-slate-800 hover:bg-slate-100 focus-visible:ring-slate-200",
      },
      size: {
        sm: "px-3 py-2",
        md: "px-4 py-2.5",
        lg: "px-5 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  PropsWithChildren &
  VariantProps<typeof buttonStyles>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
