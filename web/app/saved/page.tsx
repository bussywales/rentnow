import { SavedCollectionsPageServer } from "@/components/saved/SavedCollectionsPageServer";
import { SavedPageClient } from "@/components/saved/SavedPageClient";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  return (
    <SavedCollectionsPageServer
      unauthedFallback={<SavedPageClient />}
      supabaseUnavailableFallback={<SavedPageClient />}
    />
  );
}
