import { CtaSection } from "@/components/marketing/CtaSection";
import { ExampleSection } from "@/components/marketing/ExampleSection";
import { FeaturesSection } from "@/components/marketing/FeaturesSection";
import { HeroSection } from "@/components/marketing/HeroSection";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MetricsSection } from "@/components/marketing/MetricsSection";

export default function MarketingHomePage() {
  return (
    <main className="marketing-page">
      <MarketingHeader />
      <HeroSection />
      <MetricsSection />
      <HowItWorksSection />
      <ExampleSection />
      <FeaturesSection />
      <CtaSection />
      <MarketingFooter />
    </main>
  );
}