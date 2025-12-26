import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">404</p>
      <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-600">
        We couldn&apos;t find that page. Try returning home.
      </p>
      <div className="mt-3">
        <Link href="/" className="font-semibold text-sky-700 hover:underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
