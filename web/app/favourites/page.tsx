import { SavedCollectionsPageServer } from "@/components/saved/SavedCollectionsPageServer";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  return <SavedCollectionsPageServer />;
}
