export type MemberStatus = "active" | "paused";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status?: MemberStatus;
  notes?: string;
}
