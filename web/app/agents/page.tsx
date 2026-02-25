import { AgentsDirectoryClient } from "@/components/agents/AgentsDirectoryClient";
import { searchAgentsDirectory } from "@/lib/agents/agents-directory.server";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const initialData = await searchAgentsDirectory({
    verifiedOnly: true,
    limit: 24,
    offset: 0,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <AgentsDirectoryClient initialData={initialData} />
    </div>
  );
}
