import { apiFetch } from "@/lib/api/client";
import type { Member } from "@/types/member";
import type { CreateGroupInput, Group } from "@/types/group";

export function listGroups(): Promise<Group[]> {
  return apiFetch<Group[]>("/groups");
}

export function getGroup(groupId: string): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`);
}

export function createGroup(input: CreateGroupInput): Promise<Group> {
  return apiFetch<Group>("/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGroup(
  groupId: string,
  patch: Partial<CreateGroupInput>
): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteGroup(groupId: string): Promise<Group> {
  return apiFetch<Group>(`/groups/${groupId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteGroups(
  ids: string[]
): Promise<{deleted: number}> {
  return apiFetch<{deleted: number}>("/groups/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function listGroupMembers(groupId: string): Promise<Member[]> {
  return apiFetch<Member[]>(`/groups/${groupId}/members`);
}

export function addGroupMembers(
  groupId: string,
  memberIds: string[]
): Promise<{added: number}> {
  return apiFetch<{added: number}>(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ memberIds }),
  });
}

export function removeGroupMembers(
  groupId: string,
  memberIds: string[]
): Promise<{removed: number}> {
  return apiFetch<{removed: number}>(`/groups/${groupId}/members`, {
    method: "DELETE",
    body: JSON.stringify({ memberIds }),
  });
}
