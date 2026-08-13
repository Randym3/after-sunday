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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

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
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [showReview, setShowReview] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
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
          const ids = new Set(groupMembers.map((m) => m.id));
          setSavedIds(ids);
          setDraftIds(ids);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorToMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const nameById = new Map(allMembers.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));

  const addedIds = [...draftIds].filter((id) => !savedIds.has(id));
  const removedIds = [...savedIds].filter((id) => !draftIds.has(id));
  const hasPendingChanges = addedIds.length > 0 || removedIds.length > 0;

  async function handleFormSubmit(values: CreateGroupInput) {
    const updated = await updateGroup(groupId, values);
    setGroup(updated);
    setSavedMessage("Group details saved.");
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  function handleDraftToggle(memberId: string, add: boolean) {
    if (savingMembers) return;
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (add) next.add(memberId);
      else next.delete(memberId);
      return next;
    });
  }

  function discardChanges() {
    setDraftIds(new Set(savedIds));
    setMemberError("");
  }

  async function confirmSave() {
    setSavingMembers(true);
    setMemberError("");
    try {
      if (addedIds.length > 0) {
        await addGroupMembers(groupId, addedIds);
      }
      if (removedIds.length > 0) {
        await removeGroupMembers(groupId, removedIds);
      }
      setSavedIds(new Set(draftIds));
      setShowReview(false);
      setSavedMessage("Group members updated.");
    } catch (err: unknown) {
      setMemberError(apiErrorToMessage(err));
      try {
        const ids = (await listGroupMembers(groupId)).map((m) => m.id);
        setSavedIds(new Set(ids));
        setDraftIds(new Set(ids));
      } catch {
        // Keep the draft; the user can retry.
      }
      setShowReview(false);
    } finally {
      setSavingMembers(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-6 py-10">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Unable to load this group
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
        </div>
      </div>
    );
  }

  if (group === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-ink-soft">
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-primary"
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
        <p className="text-sm font-medium text-mint">{savedMessage}</p>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Members in this group
            </h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              {draftIds.size} {draftIds.size === 1 ? "member" : "members"}
              {hasPendingChanges ? " · unsaved changes" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPendingChanges ? (
              <Button
                type="button"
                variant="secondary"
                onClick={discardChanges}
              >
                Reset
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => setShowReview(true)}
              disabled={!hasPendingChanges || savingMembers}
            >
              {savingMembers
                ? "Saving…"
                : hasPendingChanges
                  ? `Save changes (${addedIds.length} +${removedIds.length} −)`
                  : "Save changes"}
            </Button>
          </div>
        </div>

        {memberError ? (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {memberError}
          </p>
        ) : null}

        <GroupMemberPicker
          members={allMembers}
          memberIds={draftIds}
          onAdd={(id) => handleDraftToggle(id, true)}
          onRemove={(id) => handleDraftToggle(id, false)}
          busy={savingMembers}
        />
      </Card>

      <ConfirmDialog
        open={showReview}
        title="Review changes"
        confirmLabel={savingMembers ? "Saving…" : "Save changes"}
        confirmVariant="primary"
        onCancel={() => setShowReview(false)}
        onConfirm={confirmSave}
        description={
          <div className="space-y-3">
            {addedIds.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-mint">
                  Adding ({addedIds.length})
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
                  {addedIds.map((id) => (
                    <li key={id}>{nameById.get(id) ?? "Member"}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {removedIds.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-red-400">
                  Removing ({removedIds.length})
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
                  {removedIds.map((id) => (
                    <li key={id}>{nameById.get(id) ?? "Member"}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
