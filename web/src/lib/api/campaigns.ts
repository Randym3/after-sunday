import { apiFetch } from "@/lib/api/client";
import type {
  Campaign,
  CampaignUpdate,
  CreateCampaignInput,
} from "@/types/campaign";

export function listCampaigns(): Promise<Campaign[]> {
  return apiFetch<Campaign[]>("/campaigns");
}

export function getCampaign(campaignId: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${campaignId}`);
}

export function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return apiFetch<Campaign>("/campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCampaign(
  campaignId: string,
  patch: CampaignUpdate
): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${campaignId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteCampaign(campaignId: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${campaignId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteCampaigns(
  ids: string[]
): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>("/campaigns/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}
