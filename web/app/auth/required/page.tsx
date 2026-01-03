import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthRequiredPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const redirect = searchParams?.redirect || "/";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sign in</p>
      <h1 className="text-3xl font-semibold text-slate-900">Please log in</h1>
      <p className="text-sm text-slate-600">
        You need an account to access this page. Log in or create a free account, then we&apos;ll
        send you back.
      </p>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm">
        <Link
          href={`/auth/login?redirect=${encodeURIComponent(redirect)}`}
          className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
        >
          Log in
        </Link>
        <Link
          href="/auth/register"
          className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-900 transition hover:border-slate-400"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
