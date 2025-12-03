import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";

type Props = {
  property: Property;
  href?: string;
  compact?: boolean;
};

export function PropertyCard({ property, href, compact }: Props) {
  const mainImage =
    property.images?.[0]?.image_url ||
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";

  const body = (
    <div
      className={cn(
        "card h-full overflow-hidden rounded-2xl bg-white transition hover:-translate-y-0.5 hover:shadow-xl",
        compact && "flex"
      )}
    >
      <div className={cn("relative", compact ? "h-32 w-32 flex-none" : "h-52")}>
        <Image
          src={mainImage}
          alt={property.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
          priority={false}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {property.city}
              {property.neighbourhood ? ` • ${property.neighbourhood}` : ""}
            </p>
            <h3 className="text-base font-semibold text-slate-900">
              {property.title}
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-700">
            {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
          </span>
        </div>
        <p className="text-sm text-slate-600 line-clamp-2">
          {property.description}
        </p>
        <div className="flex items-center justify-between text-sm text-slate-800">
          <div className="font-semibold">
            {property.currency} {property.price.toLocaleString()}
            <span className="text-xs font-normal text-slate-500">
              {property.rental_type === "short_let" ? " / night" : " / month"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>{property.bedrooms} bd</span>
            <span>{property.bathrooms} ba</span>
            {property.furnished && <span>Furnished</span>}
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }

  return body;
}
