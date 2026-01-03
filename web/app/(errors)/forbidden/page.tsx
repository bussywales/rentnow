import Link from "next/link";

type Props = { searchParams: { reason?: string } };

export const dynamic = "force-dynamic";

export default function ForbiddenPage({ searchParams }: Props) {
  const reason = searchParams?.reason;
  const note =
    reason === "role"
      ? "Your account role doesn't have access here."
      : "You don't have permission to view this page.";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Access</p>
      <h1 className="text-3xl font-semibold text-slate-900">Not allowed here</h1>
      <p className="text-sm text-slate-600">
        {note} If you think this is an error, please contact an admin or switch to the
        right role.
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
