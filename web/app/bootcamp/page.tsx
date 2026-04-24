import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "PropatyHub Property Opportunity Bootcamp",
  description:
    "A 5-day digital bootcamp providing clarity, connections, and practical steps to help participants access the property economy with confidence and a clear plan.",
};

export default function BootcampPage() {
  return (
    <div className="bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_28%,#f8fafc_100%)] pb-8">
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
