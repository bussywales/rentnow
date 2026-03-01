"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

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

const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export function ShortletsSearchShellNoSsr(props: Props) {
  const hasMounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  if (!hasMounted) {
    return null;
  }

  return <ShortletsSearchShellClient {...props} />;
}
