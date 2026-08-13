"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  addGroupMembers,
  getGroup,
  listGroupMembers,
  removeGroupMembers,
  updateGroup,
} from "@/lib/api/groups";
import { listMembers } from "@/lib/api/members";
import type { CreateGroupInput, Group } from "@/types/group";
import type { Member } from "@/types/member";

import { GroupForm } from "@/components/groups/GroupForm";
import { GroupMemberPicker } from "@/components/groups/GroupMemberPicker";
import { Card } from "@/components/ui/Card";

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load this group.";
}

interface GroupEditProps {
  groupId: string;
}

export function GroupEdit({ groupId }: GroupEditProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [membersBusy, setMembersBusy] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getGroup(groupId),
      listMembers(),
      listGroupMembers(groupId),
    ])
      .then(([g, members, groupMembers]) => {
        if (!cancelled) {
          setGroup(g);
          setAllMembers(members);
          setMemberIds(new Set(groupMembers.map((m) => m.id)));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorToMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function handleFormSubmit(values: CreateGroupInput) {
    const updated = await updateGroup(groupId, values);
    setGroup(updated);
    setSavedMessage("Group details saved.");
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  async function handleToggleMembership(memberId: string, add: boolean) {
    if (membersBusy) return;
    setMemberError("");

    setMemberIds((prev) => {
      const next = new Set(prev);
      if (add) next.add(memberId);
      else next.delete(memberId);
      return next;
    });

    setMembersBusy(true);
    try {
      if (add) await addGroupMembers(groupId, [memberId]);
      else await removeGroupMembers(groupId, [memberId]);
    } catch (err: unknown) {
      setMemberError(apiErrorToMessage(err));
      try {
        const ids = (await listGroupMembers(groupId)).map((m) => m.id);
        setMemberIds(new Set(ids));
      } catch {
        // Keep the optimistic state; the user can retry.
      }
    } finally {
      setMembersBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-6 py-10">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-[#102015]">
            Unable to load this group
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">{error}</p>
        </div>
      </div>
    );
  }

  if (group === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">
          Loading group…
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
      </div>

      <GroupForm
        group={group}
        onCancel={handleCancel}
        onSubmit={handleFormSubmit}
      />

      {savedMessage ? (
        <p className="text-sm font-medium text-green-800">{savedMessage}</p>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#102015]">
            Members in this group
          </h2>
          <span className="text-sm text-stone-500">
            {memberIds.size} {memberIds.size === 1 ? "member" : "members"}
          </span>
        </div>

        {memberError ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {memberError}
          </p>
        ) : null}

        <GroupMemberPicker
          members={allMembers}
          memberIds={memberIds}
          onAdd={(id) => handleToggleMembership(id, true)}
          onRemove={(id) => handleToggleMembership(id, false)}
          busy={membersBusy}
        />
      </Card>
    </div>
  );
}
