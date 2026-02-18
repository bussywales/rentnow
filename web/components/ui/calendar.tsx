"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/components/ui/cn";

export type CalendarProps = DayPickerProps;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  navLayout,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout ?? "after"}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "relative space-y-4",
        month_caption: "relative flex items-center justify-center pt-1 pr-16",
        caption_label: "text-center text-sm font-semibold text-slate-900",
        nav: "absolute right-1 top-0.5 flex items-center gap-1",
        button_previous:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-40",
        button_next:
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-400",
        week: "mt-2 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 rounded-md text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-slate-100",
        today: "text-sky-700",
        selected: "!bg-sky-600 !text-white hover:!bg-sky-600",
        range_start: "!bg-sky-600 !text-white rounded-l-md",
        range_middle: "!bg-sky-100 !text-slate-900 rounded-none",
        range_end: "!bg-sky-600 !text-white rounded-r-md",
        outside: "text-slate-300 opacity-70",
        disabled: "bg-slate-100 text-slate-400 opacity-100 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
