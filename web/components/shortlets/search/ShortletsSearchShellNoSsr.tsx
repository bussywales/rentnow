"use client";

import dynamic from "next/dynamic";

const ShortletsSearchShellClient = dynamic(
  () =>
    import("./ShortletsSearchShell").then((mod) => ({
      default: mod.ShortletsSearchShell,
    })),
  { ssr: false }
);

type Props = {
  initialSearchParams?: Record<string, string | string[] | undefined>;
  initialViewerRole?: "tenant" | "landlord" | "agent" | "admin" | null;
};

export function ShortletsSearchShellNoSsr(props: Props) {
  return <ShortletsSearchShellClient {...props} />;
}
