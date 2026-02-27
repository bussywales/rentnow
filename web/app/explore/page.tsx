export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ExplorePager } from "@/components/explore/ExplorePager";
import { getExploreFeed } from "@/lib/explore/explore-feed.server";

export const metadata: Metadata = {
  title: "Explore",
  description: "Swipe through trending homes, shortlets, and opportunities in one immersive feed.",
};

export default async function ExplorePage() {
  const listings = await getExploreFeed({ limit: 20 });

  return (
    <div className="mx-auto w-full max-w-xl px-2 md:px-4" data-testid="explore-page">
      <ExplorePager listings={listings} />
    </div>
  );
}
