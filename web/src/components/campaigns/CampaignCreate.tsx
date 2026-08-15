"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { createCampaign } from "@/lib/api/campaigns";
import { listGroups } from "@/lib/api/groups";
import { listMembers } from "@/lib/api/members";
import { listSermons } from "@/lib/api/sermons";
import type { Group } from "@/types/group";
import type { Member } from "@/types/member";
import type { Sermon } from "@/types/sermon";
import type { CreateCampaignInput } from "@/types/campaign";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import type { CampaignFormValues } from "@/components/campaigns/CampaignForm";
import { useToast } from "@/components/ui/Toast";

export function CampaignCreate() {
  const router = useRouter();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([listGroups(), listMembers(), listSermons()]).then(([loadedGroups, loadedMembers, loadedSermons]) => { setGroups(loadedGroups); setMembers(loadedMembers); setSermons(loadedSermons); }).catch(() => setError("Could not load campaign options.")); }, []);
  async function submit(input: CampaignFormValues) { setError(""); try { await createCampaign(input as CreateCampaignInput); toast("Campaign created", "success"); router.push("/app/email-campaigns"); router.refresh(); } catch (err) { const message = err instanceof ApiError ? err.message : "Could not create campaign."; setError(message); toast(message, "error"); } }
  return <CampaignForm groups={groups} members={members} sermons={sermons} error={error} onSubmit={submit} />;
}
