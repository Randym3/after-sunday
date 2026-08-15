import Link from "next/link";
import { CampaignList } from "@/components/campaigns/CampaignList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EmailCampaignsPage() {
  return <><PageHeader title="Email campaigns" description="Prepare pastoral follow-ups for a group or a selected set of members." action={<Link href="/app/email-campaigns/new"><Button>New Campaign</Button></Link>} /><CampaignList /></>;
}
