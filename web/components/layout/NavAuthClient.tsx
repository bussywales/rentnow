import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Props = {
  initialAuthed: boolean;
};

export function NavAuthClient({ initialAuthed }: Props) {
  if (initialAuthed) {
    return null;
  }

  return (
    <>
      <Link href="/auth/register">
        <Button size="sm">Get started</Button>
      </Link>
    </>
  );
}
