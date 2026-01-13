import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { normalizeRole } from "@/lib/roles";

type Props = {
  initialAuthed: boolean;
  initialRole?: string | null;
};

export function NavAuthClient({ initialAuthed, initialRole = null }: Props) {
  const role = normalizeRole(initialRole);
  const canShowDashboard = initialAuthed && !!role && role !== "admin";
  const dashboardHref = role === "tenant" ? "/tenant" : "/dashboard";

  if (initialAuthed) {
    return (
      <>
        {canShowDashboard && (
          <Link href={dashboardHref} className="hidden text-sm text-slate-700 md:block">
            My dashboard
          </Link>
        )}
        <form action="/auth/logout" method="POST">
          <Button size="sm" type="submit" variant="secondary">
            Log out
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link href="/auth/login" className="hidden text-sm text-slate-700 md:block">
        Log in
      </Link>
      <Link href="/auth/register">
        <Button size="sm">Get started</Button>
      </Link>
    </>
  );
}
