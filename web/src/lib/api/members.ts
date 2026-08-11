import { apiFetch } from "@/lib/api/client";
import type { CreateMemberInput, Member } from "@/types/member";

export function listMembers(): Promise<Member[]> {
  return apiFetch<Member[]>("/members");
}

export function createMember(
  input: CreateMemberInput
): Promise<Member> {
  return apiFetch<Member>("/members", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMember(memberId: string): Promise<Member> {
  return apiFetch<Member>(`/members/${memberId}`);
}

export function updateMember(
  memberId: string,
  patch: Partial<CreateMemberInput>
): Promise<Member> {
  return apiFetch<Member>(`/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteMember(memberId: string): Promise<Member> {
  return apiFetch<Member>(`/members/${memberId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteMembers(ids: string[]): Promise<{deleted: number}> {
  return apiFetch<{deleted: number}>("/members/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ids}),
  });
}
