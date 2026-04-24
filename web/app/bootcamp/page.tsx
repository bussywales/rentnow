import type { Metadata } from "next";
import { BRAND_NAME, BRAND_SITE_URL, BRAND_OG_IMAGE } from "@/lib/brand";
import { BootcampPageAnalytics } from "@/components/bootcamp/BootcampPageAnalytics";
import { HeaderNav } from "@/components/bootcamp/HeaderNav";
import { HeroSection } from "@/components/bootcamp/HeroSection";
import { WhyThisExistsSection } from "@/components/bootcamp/WhyThisExistsSection";
import { AudienceSection } from "@/components/bootcamp/AudienceSection";
import { ProgrammeOverviewSection } from "@/components/bootcamp/ProgrammeOverviewSection";
import { HowItWorksSection } from "@/components/bootcamp/HowItWorksSection";
import { AttendeeValueSection } from "@/components/bootcamp/AttendeeValueSection";
import { WhyPropatyHubSection } from "@/components/bootcamp/WhyPropatyHubSection";
import { FAQSection } from "@/components/bootcamp/FAQSection";
import { FinalCTASection } from "@/components/bootcamp/FinalCTASection";
import { Footer as BootcampFooter } from "@/components/bootcamp/Footer";

const BOOTCAMP_TITLE = "PropatyHub Property Opportunity Bootcamp";
const BOOTCAMP_DESCRIPTION =
  "A 5-day digital bootcamp providing clarity, connections, and practical steps to help participants access the property economy with confidence and a clear plan.";

export function buildBootcampMetadata(baseUrl = BRAND_SITE_URL): Metadata {
  const canonical = `${baseUrl}/bootcamp`;
  const ogImage = `${baseUrl}${BRAND_OG_IMAGE}`;

  return {
    title: BOOTCAMP_TITLE,
    description: BOOTCAMP_DESCRIPTION,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${BOOTCAMP_TITLE} | ${BRAND_NAME}`,
      description: BOOTCAMP_DESCRIPTION,
      url: canonical,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: BOOTCAMP_TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${BOOTCAMP_TITLE} | ${BRAND_NAME}`,
      description: BOOTCAMP_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export const metadata: Metadata = buildBootcampMetadata();

export default function BootcampPage() {
  return (
    <div className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#f8fafc_100%)] pb-8">
      <BootcampPageAnalytics />
      <HeaderNav />
      <HeroSection />
      <WhyThisExistsSection />
      <AudienceSection />
      <ProgrammeOverviewSection />
      <HowItWorksSection />
      <AttendeeValueSection />
      <WhyPropatyHubSection />
      <FAQSection />
      <FinalCTASection />
      <BootcampFooter />
    </div>
  );
}
