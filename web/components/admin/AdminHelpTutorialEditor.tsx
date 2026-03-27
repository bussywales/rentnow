"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import { YouTube } from "@/components/help/articles/YouTube";
import {
  HELP_TUTORIAL_AUDIENCE_LABELS,
  HELP_TUTORIAL_AUDIENCES,
  HELP_TUTORIAL_STATUS_LABELS,
  HELP_TUTORIAL_VISIBILITY_LABELS,
  coerceTutorialVisibility,
  composeHelpTutorialBody,
  extractYouTubeId,
  getHelpTutorialPath,
  normalizeTutorialSlug,
  type HelpTutorialAudience,
  type HelpTutorialRecord,
  type HelpTutorialStatus,
  type HelpTutorialVisibility,
} from "@/lib/help/tutorials";

type Props = {
  mode: "create" | "edit";
  initialTutorial?: HelpTutorialRecord;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function AdminHelpTutorialEditor({ mode, initialTutorial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTutorial?.title ?? "");
  const [slug, setSlug] = useState(initialTutorial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [summary, setSummary] = useState(initialTutorial?.summary ?? "");
  const [audience, setAudience] = useState<HelpTutorialAudience>(initialTutorial?.audience ?? "admin");
  const [visibility, setVisibility] = useState<HelpTutorialVisibility>(
    initialTutorial?.visibility ?? coerceTutorialVisibility(initialTutorial?.audience ?? "admin", null)
  );
  const [videoUrl, setVideoUrl] = useState(initialTutorial?.video_url ?? "");
  const [body, setBody] = useState(initialTutorial?.body ?? "");

  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  const effectiveSlug = useMemo(
    () => normalizeTutorialSlug(slugTouched ? slug : title),
    [slug, slugTouched, title]
  );
  const effectiveVisibility = useMemo(
    () => coerceTutorialVisibility(audience, visibility),
    [audience, visibility]
  );
  const previewSource = useMemo(
    () =>
      composeHelpTutorialBody({
        body,
        videoUrl,
        videoTitle: title || "Tutorial walkthrough",
      }),
    [body, title, videoUrl]
  );
  const canSave =
    title.trim().length >= 3 &&
    effectiveSlug.length >= 3 &&
    summary.trim().length >= 10 &&
    body.trim().length >= 20 &&
    (!videoUrl.trim() || !!videoId);
  const status = initialTutorial?.status ?? "draft";
  const publishedPath = getHelpTutorialPath(audience, initialTutorial?.slug ?? effectiveSlug);

  async function submit(nextStatus: HelpTutorialStatus) {
    if (!canSave) return;
    setError(null);

    startTransition(async () => {
      const payload = {
        title: title.trim(),
        slug: effectiveSlug,
        summary: summary.trim(),
        audience,
        visibility: effectiveVisibility,
        status: nextStatus,
        video_url: videoUrl.trim() || null,
        body: body.trim(),
      };

      const res = await fetch(
        mode === "create" ? "/api/admin/help/tutorials" : `/api/admin/help/tutorials/${initialTutorial?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to save tutorial");
        return;
      }

      const tutorialId = data?.tutorial?.id;
      if (mode === "create" && tutorialId) {
        router.replace(`/admin/help/tutorials/${tutorialId}`);
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === "create" ? "Create help tutorial" : "Edit help tutorial"}
          </h1>
          <p className="text-sm text-slate-600">
            Admin-only tutorial authoring for public role help and internal admin/ops tutorials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/help/tutorials"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Back to tutorials
          </Link>
          {initialTutorial?.status === "published" ? (
            <Link
              href={publishedPath}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
            >
              Open published tutorial
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Slug</label>
            <input
              type="text"
              value={slugTouched ? slug : effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending}
            />
            <p className="mt-1 text-xs text-slate-500">Route slug: {effectiveSlug || "-"}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Audience</label>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as HelpTutorialAudience)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending}
            >
              {HELP_TUTORIAL_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {HELP_TUTORIAL_AUDIENCE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Visibility</label>
            <select
              value={effectiveVisibility}
              onChange={(event) => setVisibility(event.target.value as HelpTutorialVisibility)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending}
            >
              {[effectiveVisibility].map((value) => (
                <option key={value} value={value}>
                  {HELP_TUTORIAL_VISIBILITY_LABELS[value]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {audience === "admin"
                ? "Admin / Ops tutorials stay internal-only."
                : "Tenant, landlord, and agent tutorials publish to the public help centre."}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500">Summary</label>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="mt-1 min-h-[88px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={pending}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${activeTab === "edit" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setActiveTab("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 ${activeTab === "preview" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
            </div>
            {activeTab === "edit" ? (
              <div className="mt-3">
                <label className="text-xs font-semibold text-slate-500">Tutorial body (markdown)</label>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-1 min-h-[360px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={pending}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <HelpArticleRenderer source={previewSource} />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Media and publish controls</h2>
            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-500">YouTube URL (optional)</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={pending}
                placeholder="https://youtu.be/_jWHH5MQMAk"
              />
              <p className="mt-1 text-xs text-slate-500">
                Paste a normal YouTube or youtu.be URL. Raw iframe code is not supported.
              </p>
            </div>

            {videoUrl.trim() ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-500">Video preview</p>
                {videoId ? (
                  <YouTube id={videoId} title={title || "Tutorial walkthrough"} />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Enter a valid YouTube watch or short-link URL to preview the embed.
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              <p>
                Current status: <span className="font-semibold text-slate-900">{HELP_TUTORIAL_STATUS_LABELS[status]}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Published tutorials appear under {audience === "admin" ? "/help/admin/*" : `/help/${audience}/*`}.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void submit("draft")} disabled={pending || !canSave}>
                {pending ? "Saving..." : initialTutorial?.status === "published" ? "Save as draft" : "Save draft"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void submit("published")} disabled={pending || !canSave}>
                {pending ? "Publishing..." : initialTutorial?.status === "published" ? "Update published tutorial" : "Publish tutorial"}
              </Button>
            </div>

            {initialTutorial ? (
              <p className="mt-4 text-xs text-slate-500">
                Updated {formatDateTime(initialTutorial.updated_at)} • Published {formatDateTime(initialTutorial.published_at)}
              </p>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                New tutorials start in draft until you publish them.
              </p>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
