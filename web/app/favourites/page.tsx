import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function FavouritesPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved properties</h1>
        <p className="text-sm text-slate-600">
          Tenants can bookmark listings to revisit later.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
        No favourites yet. Explore listings and tap “Save property”.
        <div className="mt-3">
          <Link href="/properties">
            <Button variant="secondary">Browse properties</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
