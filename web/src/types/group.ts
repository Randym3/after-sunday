export interface Group {
  id: string;
  name: string;
  description?: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
}
