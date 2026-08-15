import Link from "next/link";
import { CampaignCreate } from "@/components/campaigns/CampaignCreate";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewEmailCampaignPage() {
  return <><PageHeader title="New email campaign" /><div className="mb-6"><Link href="/app/email-campaigns" className="text-sm font-medium text-ink-soft hover:text-primary">← Back to campaigns</Link></div><CampaignCreate /></>;
}
