/* eslint-disable @next/next/no-img-element */

type Props = {
  src: string;
  alt: string;
  caption?: string;
};

export function ArticleImage({ src, alt, caption }: Props) {
  return (
    <figure className="space-y-2">
      <img
        src={src}
        alt={alt}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
        loading="lazy"
      />
      {caption ? <figcaption className="text-xs text-slate-500">{caption}</figcaption> : null}
    </figure>
  );
}
