import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyAgentsHelpRedirect() {
  redirect("/help/agent");
}
