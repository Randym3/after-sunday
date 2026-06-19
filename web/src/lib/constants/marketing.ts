export interface MarketingNavItem {
  label: string;
  href: string;
}

export interface LandingStep {
  eyebrow: string;
  title: string;
  description: string;
}

export interface LandingMetric {
  value: string;
  label: string;
}

export interface LandingFeature {
  title: string;
  description: string;
}

export const marketingNavItems: MarketingNavItem[] = [
  {
    label: "How it works",
    href: "#how-it-works",
  },
  {
    label: "Features",
    href: "#features",
  },
  {
    label: "Example",
    href: "#example",
  },
  {
    label: "Pricing",
    href: "#pricing",
  },
];

export const landingSteps: LandingStep[] = [
  {
    eyebrow: "Step 01",
    title: "Add the sermon",
    description:
      "Paste a transcript or sermon notes after Sunday service. Start simple before adding imports and automation.",
  },
  {
    eyebrow: "Step 02",
    title: "Review the follow-up",
    description:
      "After Sunday creates a warm, pastoral draft with sermon takeaways and discussion questions.",
  },
  {
    eyebrow: "Step 03",
    title: "Send with care",
    description:
      "Choose recipients, send a test, approve the message, and follow up with people who could not attend.",
  },
];

export const landingMetrics: LandingMetric[] = [
  {
    value: "3–5",
    label: "discussion questions generated",
  },
  {
    value: "1",
    label: "reviewable email draft",
  },
  {
    value: "0",
    label: "auto-sent messages without approval",
  },
];

export const landingFeatures: LandingFeature[] = [
  {
    title: "Sermon-centered follow-up",
    description:
      "Create follow-up messages around the actual sermon, not generic church announcements.",
  },
  {
    title: "Human review first",
    description:
      "AI helps draft the message, but church leaders always review and approve before anything is sent.",
  },
  {
    title: "Built for missed Sundays",
    description:
      "Serve homebound members, sick families, travelers, and people who could not make it to church.",
  },
  {
    title: "Simple enough for small teams",
    description:
      "No complex dashboard or heavy marketing automation system. Just a clear pastoral workflow.",
  },
];