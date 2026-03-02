import Link from "next/link";

type Props = {
  initialAuthed: boolean;
};

export function NavAuthClient({ initialAuthed }: Props) {
  if (initialAuthed) {
    return null;
  }

  return (
    <>
      <Link
        href="/auth/register"
        className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        Get started
      </Link>
    </>
  );
}
