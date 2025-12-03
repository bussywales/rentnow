import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";

export default function DashboardHome() {
  const myProperties = mockProperties;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My properties</h2>
          <p className="text-sm text-slate-600">
            Listings you own. Approvals required for public visibility.
          </p>
        </div>
        <Link href="/dashboard/properties/new">
          <Button>New listing</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {myProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            compact
            href={`/dashboard/properties/${property.id}`}
          />
        ))}
      </div>
    </div>
  );
}
