import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Access</p>
      <h1 className="text-3xl font-semibold text-slate-900">Not allowed here</h1>
      <p className="text-sm text-slate-600">
        Your account doesn’t have permission to view this page. If you think this is an
        error, please contact an admin or switch to the right role.
      </p>
      <div className="mt-3 space-x-3 text-sm text-sky-700">
        <Link href="/" className="font-semibold hover:underline">
          Go home
        </Link>
        <Link href="/dashboard" className="font-semibold hover:underline">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
