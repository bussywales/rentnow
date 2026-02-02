export const dynamic = "force-dynamic";

import type { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
