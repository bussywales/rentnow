import Image from "next/image";
import Link from "next/link";
import { NavAuthClient } from "@/components/layout/NavAuthClient";

const links = [
  { href: "/properties", label: "Browse" },
  { href: "/favourites", label: "Saved" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Admin" },
];

export async function MainNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Image
            src="/logo.svg"
            alt="RENTNOW"
            width={28}
            height={28}
            priority
          />
          <span className="text-xl text-sky-600">RENTNOW</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-700 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-sky-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NavAuthClient initialAuthed={false} />
        </div>
      </div>
    </header>
  );
}
