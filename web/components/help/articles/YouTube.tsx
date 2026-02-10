type Props = {
  id: string;
  title?: string;
};

function sanitizeYoutubeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function YouTube({ id, title = "YouTube video" }: Props) {
  const safeId = sanitizeYoutubeId(id);
  if (!safeId) return null;

  return (
    <div className="space-y-2" data-testid="help-youtube-embed">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black pb-[56.25%]">
        <iframe
          title={title}
          src={`https://www.youtube.com/embed/${safeId}`}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <p className="text-xs text-slate-500">{title}</p>
    </div>
  );
}
