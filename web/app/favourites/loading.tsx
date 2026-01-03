import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function FavouritesLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <PropertyCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
