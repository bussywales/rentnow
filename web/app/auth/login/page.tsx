import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getSession } from "@/lib/auth";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeRedirect(
  value?: string | string[] | undefined,
  fallback = "/dashboard"
) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const redirectCandidate =
    (typeof resolvedParams?.redirect === "string" && resolvedParams.redirect) ||
    (typeof resolvedParams?.next === "string" && resolvedParams.next) ||
    undefined;
  const redirectTo = normalizeRedirect(redirectCandidate);
  const reason = typeof resolvedParams?.reason === "string" ? resolvedParams.reason : null;
  const errorParam = typeof resolvedParams?.error === "string" ? resolvedParams.error : null;
  const envError = hasServerSupabaseEnv()
    ? null
    : "Supabase environment variables are missing.";
  const error = errorParam ?? envError;

  const session = await getSession();
  if (session?.user) {
    redirect(redirectTo);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="text-sm text-slate-600">
          Access your dashboard and messages.
        </p>
        {reason === "auth" && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Please log in to continue.
          </p>
        )}
      </div>
      <form className="space-y-4" action="/auth/login" method="POST">
        <input type="hidden" name="redirect" value={redirectTo} />
        <Input
          type="email"
          required
          placeholder="you@email.com"
          name="email"
          autoComplete="username"
        />
        <PasswordInput
          required
          placeholder="Password"
          name="password"
          autoComplete="current-password"
        />
        <div className="flex items-center justify-end">
          <Link href="/auth/reset" className="text-xs font-semibold text-sky-700">
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" type="submit">
          Log in
        </Button>
      </form>
      <p className="text-sm text-slate-600">
        New here?{" "}
        <Link
          href={`/auth/register?redirect=${encodeURIComponent(redirectTo)}`}
          className="font-semibold text-sky-700"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
