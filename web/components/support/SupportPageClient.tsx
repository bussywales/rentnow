"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import SupportContactForm from "@/components/support/SupportContactForm";
import { SupportFaqAccordion } from "@/components/support/SupportFaqAccordion";
import { SupportTopicTiles } from "@/components/support/SupportTopicTiles";
import { SupportStatusCard } from "@/components/support/SupportStatusCard";
import {
  SUPPORT_CATEGORY_HELP,
  SUPPORT_FAQ_ITEMS,
  SUPPORT_TOPIC_TILES,
  type SupportCategory,
  type SupportTopicTile,
} from "@/lib/support/support-content";

type Props = {
  prefillName?: string | null;
  prefillEmail?: string | null;
  isAdmin: boolean;
  appVersion: string;
  releaseDate: string;
  releaseNotes: string[];
};

export default function SupportPageClient({
  prefillName,
  prefillEmail,
  isAdmin,
  appVersion,
  releaseDate,
  releaseNotes,
}: Props) {
  const faqRef = useRef<HTMLDivElement | null>(null);
  const [category, setCategory] = useState<SupportCategory>("general");
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const helperText = useMemo(
    () => SUPPORT_CATEGORY_HELP[category],
    [category]
  );

  const scrollToFaq = useCallback(() => {
    if (!faqRef.current) return;
    faqRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleTopicSelect = (topic: SupportTopicTile) => {
    setActiveTopicId(topic.id);
    setCategory(topic.category);
    if (topic.faqId) {
      setOpenFaqId(topic.faqId);
      requestAnimationFrame(() => scrollToFaq());
    }
  };

  const handleCategoryChange = (next: SupportCategory) => {
    setCategory(next);
    setActiveTopicId(null);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Support</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          How can we help?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          We&apos;re here for you. Start with a topic or send us a message anytime.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Version {appVersion} • Released {releaseDate}
        </p>
      </section>

      <section className="space-y-3" data-testid="support-topic-section">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Browse topics</h2>
          <p className="text-sm text-slate-500">
            Choose a topic and we&apos;ll guide you to the right answer.
          </p>
        </div>
        <SupportTopicTiles
          topics={SUPPORT_TOPIC_TILES}
          activeId={activeTopicId}
          onSelect={handleTopicSelect}
        />
      </section>

      <section ref={faqRef} className="space-y-3">
        <SupportFaqAccordion
          items={SUPPORT_FAQ_ITEMS}
          openId={openFaqId}
          onOpenChange={setOpenFaqId}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Send us a message</h2>
        <p className="text-sm text-slate-500">
          Prefer to reach us directly? Share a few details and we&apos;ll respond fast.
        </p>
        <div className="mt-4">
          <SupportContactForm
            prefillName={prefillName}
            prefillEmail={prefillEmail}
            category={category}
            helperText={helperText}
            onCategoryChange={handleCategoryChange}
          />
        </div>
      </section>

      <SupportStatusCard
        isAdmin={isAdmin}
        appVersion={appVersion}
        releaseDate={releaseDate}
        releaseNotes={releaseNotes}
      />
    </div>
  );
}
