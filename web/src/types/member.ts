export type MemberStatus =
  | "active"
  | "paused"
  | "inactive"
  | "removed";

export type MemberRole =
  | "member"
  | "pastor"
  | "deacon"
  | "elder"
  | "leader"
  | "volunteer"
  | "visitor";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
  role: MemberRole;
  notes?: string | null;
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status?: MemberStatus;
  role?: MemberRole;
  notes?: string;
  groupIds?: string[];
}
