"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { getCampaign, updateCampaign } from "@/lib/api/campaigns";
import { listGroups } from "@/lib/api/groups";
import { listMembers } from "@/lib/api/members";
import { listSermons } from "@/lib/api/sermons";
import type { Group } from "@/types/group";
import type { Member } from "@/types/member";
import type { Sermon } from "@/types/sermon";
import type { Campaign } from "@/types/campaign";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import type { CampaignFormValues } from "@/components/campaigns/CampaignForm";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

export function CampaignEdit({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getCampaign(campaignId), listGroups(), listMembers(), listSermons()])
      .then(([loadedCampaign, loadedGroups, loadedMembers, loadedSermons]) => {
        setCampaign(loadedCampaign);
        setGroups(loadedGroups);
        setMembers(loadedMembers);
        setSermons(loadedSermons);
      })
      .catch(() => setError("Could not load this campaign."));
  }, [campaignId]);

  async function submit(input: CampaignFormValues) {
    setError("");
    try {
      await updateCampaign(campaignId, input);
      toast("Campaign saved", "success");
      router.push("/app/email-campaigns");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save campaign.";
      setError(message);
      toast(message, "error");
    }
  }

  if (error && !campaign) {
    return <Card><p className="py-8 text-center text-sm text-red-700">{error}</p></Card>;
  }
  if (!campaign) {
    return <Card><p className="py-8 text-center text-sm text-ink-soft">Loading…</p></Card>;
  }

  return <CampaignForm campaign={campaign} groups={groups} members={members} sermons={sermons} error={error} onSubmit={submit} />;
}
