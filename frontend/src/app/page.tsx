import { HeroSection } from "@/components/home/HeroSection";
// import { StatsSection } from "@/components/home/StatsSection";
import { HowItWorksSection } from "@/components/home/HowItWorksSection";
import { WorkflowsSection } from "@/components/home/WorkflowsSection";
import { HighlightsSection } from "@/components/home/HighlightsSection";
import { CtaSection } from "@/components/home/CtaSection";
import FAQAccordion from "@/components/faq/FAQAccordion";
import { faqs } from "@/data/faqs";

export default function Home() {
  return (
    <div className="space-y-12 pb-12">
      <HeroSection />
      <HowItWorksSection />
      <HighlightsSection />
      <WorkflowsSection />
      <FAQAccordion items={faqs} limit={4} />
      {/* <StatsSection />  */}
      <CtaSection />
    </div>
  );
}