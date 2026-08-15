export interface MarketingNavItem {
  label: string;
  href: string;
}

export interface LandingStep {
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
}

export interface LandingMetric {
  value: string;
  label: string;
}

export interface LandingFeature {
  number: string;
  title: string;
  description: string;
}

export const marketingNavItems: MarketingNavItem[] = [
  { label: "Workflow", href: "#workflow" },
  { label: "Sermons", href: "#sermons" },
  { label: "Campaigns", href: "#campaigns" },
  { label: "FAQ", href: "#faq" },
];

export const landingSteps: LandingStep[] = [
  {
    number: "01",
    eyebrow: "Capture",
    title: "Add the sermon",
    description:
      "Upload the recording, paste a transcript, or bring in a YouTube sermon. Everything starts from the message your church actually heard.",
    detail: "recording + transcript",
  },
  {
    number: "02",
    eyebrow: "Prepare",
    title: "Review the follow-up",
    description:
      "After Sunday creates a focused email draft with the sermon’s summary, takeaways, and reflection questions.",
    detail: "AI draft · needs review",
  },
  {
    number: "03",
    eyebrow: "Send",
    title: "Reach people with care",
    description:
      "Test the email, approve it, then send once to a group or selected members on the schedule that fits your church.",
    detail: "approved · ready to send",
  },
];

export const landingMetrics: LandingMetric[] = [
  { value: "01", label: "sermon becomes the source of truth" },
  { value: "02", label: "human review gates the message" },
  { value: "∞", label: "ways to continue the conversation" },
];

export const landingFeatures: LandingFeature[] = [
  {
    number: "01",
    title: "Transcript-first workflow",
    description:
      "Keep the sermon, transcript, generated draft, and final message together instead of scattered across tools.",
  },
  {
    number: "02",
    title: "AI that stays in its lane",
    description:
      "Use AI for a first draft. Your team controls the wording, approval, recipients, and send time.",
  },
  {
    number: "03",
    title: "Email people will read",
    description:
      "Turn a Sunday message into a warm, branded follow-up with a consistent format that works in any inbox.",
  },
  {
    number: "04",
    title: "Campaigns without the machinery",
    description:
      "Choose a group or specific members, see the recipient count, and schedule one thoughtful follow-up.",
  },
];