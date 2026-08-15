export interface Campaign {
  id: string;
  name: string;
  subject?: string | null;
  body?: string | null;
  sermonId: string;
  sermonTitle?: string | null;
  recipientSource: "group" | "members";
  groupId?: string | null;
  recipientCount: number;
  status: string;
  sendAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  name: string;
  subject?: string;
  body?: string;
  sermonId: string;
  groupId?: string;
  memberIds?: string[];
  sendAt: string;
}

export type CampaignUpdate = Partial<
  Omit<CreateCampaignInput, "sermonId" | "groupId" | "memberIds">
>;
