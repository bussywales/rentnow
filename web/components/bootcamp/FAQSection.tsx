"use client";

import { useState } from "react";
import { BOOTCAMP_FAQS } from "@/components/bootcamp/content";
import { SectionIntro, SectionShell } from "@/components/bootcamp/shared";

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(BOOTCAMP_FAQS[0]?.id ?? null);

  return (
    <SectionShell id="faq" className="pt-16 sm:pt-20">
      <SectionIntro heading="FAQ" />
      <div className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-3">
          {BOOTCAMP_FAQS.map((item) => (
            <details
              key={item.id}
              className="group rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4"
              open={openId === item.id}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setOpenId(nextOpen ? item.id : null);
              }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-950 [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
