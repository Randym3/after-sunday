import Link from "next/link";
import { CampaignEdit } from "@/components/campaigns/CampaignEdit";
import { PageHeader } from "@/components/ui/PageHeader";

interface CampaignPageProps {
  params: Promise<{ campaignId: string }>;
}

export default async function EditCampaignPage({ params }: CampaignPageProps) {
  const { campaignId } = await params;

  return (
    <>
      <PageHeader title="Edit email campaign" />
      <div className="mb-6">
        <Link
          href="/app/email-campaigns"
          className="text-sm font-medium text-ink-soft transition hover:text-primary"
        >
          ← Back to campaigns
        </Link>
      </div>
      <CampaignEdit campaignId={campaignId} />
    </>
  );
}
