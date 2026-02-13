import { SharedHelpIndex } from "@/components/help/SharedHelpPage";

export const dynamic = "force-dynamic";

export default function TroubleshootingHelpPage() {
  return (
    <SharedHelpIndex
      section="troubleshooting"
      subtitle="Fast triage checklists for login, listing quality, payments, alerts, and support incidents."
    />
  );
}
