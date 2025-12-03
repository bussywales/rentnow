import { Button } from "@/components/ui/Button";
import { mockProperties } from "@/lib/mock";

const mockUsers = [
  { id: "u1", email: "tenant@example.com", role: "tenant" },
  { id: "u2", email: "landlord@example.com", role: "landlord" },
  { id: "u3", email: "agent@example.com", role: "agent" },
];

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Control panel</p>
        <p className="text-sm text-slate-200">
          Approve listings and audit users. Restricted to role = admin.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <p className="text-sm text-slate-600">
              Basic list for audits (Supabase auth + profiles).
            </p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 text-sm">
          {mockUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-semibold text-slate-900">{user.email}</p>
                <p className="text-slate-600">Role: {user.role}</p>
              </div>
              <Button size="sm" variant="secondary">
                View
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Properties</h2>
            <p className="text-sm text-slate-600">
              Approve or reject listings before they go live.
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          {mockProperties.map((property) => (
            <div
              key={property.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {property.title}
                </p>
                <p className="text-xs text-slate-600">
                  {property.city} • {property.rental_type}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm">Approve</Button>
                <Button size="sm" variant="secondary">
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
