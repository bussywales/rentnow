"use client";

import { useId, useState, forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ label, error, className, id, autoComplete = "current-password", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;
    const toggle = () => setVisible((prev) => !prev);
    const ariaLabel = visible ? "Hide password" : "Show password";

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-800">
            {label}
          </label>
        )}
        <div className="relative">
          <Input
            {...props}
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            className={cn("pr-12", className)}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={ariaLabel}
            className="absolute inset-y-0 right-2 flex h-full w-10 items-center justify-center rounded-md text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {visible ? (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 12c1.5-4.5 4.5-6.75 9.75-6.75S20.25 7.5 21.75 12c-1.5 4.5-4.5 6.75-9.75 6.75S3.75 16.5 2.25 12z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9.75a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5z"
                  />
                </>
              ) : (
                <>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3l18 18"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.477 10.477a2.25 2.25 0 103.182 3.183"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.88 4.12a9.2 9.2 0 012.12-.12c5.25 0 8.25 2.25 9.75 6a11.58 11.58 0 01-2.72 4.098"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.228 6.228C4.296 7.564 3.068 9.487 2.25 12c1.5 4.5 4.5 6.75 9.75 6.75 1.057 0 2.064-.12 3.02-.355"
                  />
                </>
              )}
            </svg>
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
