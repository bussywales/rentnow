"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AdminSettingsSearch } from "@/components/admin/AdminSettingsSearch";
import { AdminSettingsSidebar } from "@/components/admin/AdminSettingsSidebar";

export type AdminSettingsLayoutSection = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  content: ReactNode;
};

type Props = {
  sections: AdminSettingsLayoutSection[];
};

function matchesQuery(section: AdminSettingsLayoutSection, query: string): boolean {
  if (!query) return true;
  const haystack = [section.title, section.description, ...section.keywords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export default function AdminSettingsLayout({ sections }: Props) {
  const initialExpandedIds = useMemo(() => sections.slice(0, 2).map((section) => section.id), [sections]);
  const [query, setQuery] = useState("");
  const [manualExpandedGroupIds, setManualExpandedGroupIds] = useState<string[]>(
    initialExpandedIds
  );
  const [manualActiveGroupId, setManualActiveGroupId] = useState<string | null>(
    sections[0]?.id ?? null
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () => sections.filter((section) => matchesQuery(section, normalizedQuery)),
    [sections, normalizedQuery]
  );
  const visibleGroupIds = useMemo(
    () => new Set(visibleSections.map((section) => section.id)),
    [visibleSections]
  );
  const activeGroupId = visibleGroupIds.has(manualActiveGroupId ?? "")
    ? manualActiveGroupId
    : (visibleSections[0]?.id ?? null);
  const expandedGroupIds = normalizedQuery
    ? visibleSections.map((section) => section.id)
    : manualExpandedGroupIds;

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const headingRefs = useRef<Record<string, HTMLHeadingElement | null>>({});

  useEffect(() => {
    if (visibleSections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let nextId = activeGroupId;
        let bestRatio = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.groupId;
          if (!id || entry.intersectionRatio < bestRatio) continue;
          bestRatio = entry.intersectionRatio;
          nextId = id;
        }
        if (nextId && nextId !== activeGroupId) {
          setManualActiveGroupId(nextId);
        }
      },
      {
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.2, 0.4, 0.6, 0.8],
      }
    );

    visibleSections.forEach((section) => {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [activeGroupId, visibleSections]);

  const onNavigate = (id: string) => {
    const sectionNode = sectionRefs.current[id];
    if (!sectionNode) return;
    sectionNode.scrollIntoView({ behavior: "smooth", block: "start" });
    setManualActiveGroupId(id);
    window.requestAnimationFrame(() => {
      headingRefs.current[id]?.focus({ preventScroll: true });
    });
  };

  const onToggleExpanded = (id: string) => {
    setManualExpandedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((groupId) => groupId !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setManualExpandedGroupIds(sections.map((section) => section.id));
  };

  const collapseAll = () => {
    setManualExpandedGroupIds([]);
  };

  return (
    <div className="space-y-4" data-testid="admin-settings-layout">
      <AdminSettingsSearch
        value={query}
        onChange={setQuery}
        onClear={() => {
          setQuery("");
          setManualExpandedGroupIds(initialExpandedIds);
        }}
        resultCount={visibleSections.length}
        totalCount={sections.length}
      />

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
        <AdminSettingsSidebar
          groups={visibleSections.map((section) => ({ id: section.id, title: section.title }))}
          activeGroupId={activeGroupId}
          onNavigate={onNavigate}
        />

        <div className="space-y-4">
          <div className="hidden items-center justify-end gap-2 lg:flex">
            <Button type="button" variant="secondary" size="sm" onClick={expandAll}>
              Expand all
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>

          {sections.map((section) => {
            const isVisible = visibleGroupIds.has(section.id);
            const isExpanded = expandedGroupIds.includes(section.id);
            if (!isVisible) return null;

            return (
              <section
                key={section.id}
                id={`admin-settings-${section.id}`}
                data-group-id={section.id}
                data-testid={`admin-settings-group-${section.id}`}
                ref={(node) => {
                  sectionRefs.current[section.id] = node;
                }}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                  <div className="space-y-1">
                    <h2
                      ref={(node) => {
                        headingRefs.current[section.id] = node;
                      }}
                      tabIndex={-1}
                      className="text-base font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    >
                      {section.title}
                    </h2>
                    <p className="text-sm text-slate-600">{section.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onToggleExpanded(section.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`admin-settings-panel-${section.id}`}
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </Button>
                </div>
                <div
                  id={`admin-settings-panel-${section.id}`}
                  className={isExpanded ? "px-4 py-4 sm:px-5" : "hidden"}
                >
                  {section.content}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
