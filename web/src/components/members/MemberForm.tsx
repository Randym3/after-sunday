"use client";

import { useEffect, useState } from "react";

import { listGroups } from "@/lib/api/groups";
import type { Group } from "@/types/group";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type {
  CreateMemberInput,
  Member,
  MemberRole,
  MemberStatus,
} from "@/types/member";

interface MemberFormProps {
  member?: Member | null;
  onCancel: () => void;
  onSubmit: (values: CreateMemberInput) => Promise<void>;
  /** Render without the Card surface, for use inside a modal panel. */
  embedded?: boolean;
  /** Pass preloaded groups to avoid a late picker render in quick-add modal. */
  availableGroups?: Group[];
  groupsLoading?: boolean;
}

const inputClass =
  "w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-primary";

export function MemberForm({
  member,
  onCancel,
  onSubmit,
  embedded = false,
  availableGroups,
  groupsLoading = false,
}: MemberFormProps) {
  const [firstName, setFirstName] = useState(member?.firstName ?? "");
  const [lastName, setLastName] = useState(member?.lastName ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [status, setStatus] = useState<MemberStatus>(
    member?.status ?? "active"
  );
  const [role, setRole] = useState<MemberRole>(member?.role ?? "member");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [fetchedGroups, setFetchedGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    member?.groupIds ?? []
  );

  useEffect(() => {
    if (availableGroups !== undefined) return;

    let cancelled = false;
    listGroups()
      .then((data) => {
        if (!cancelled) setFetchedGroups(data);
      })
      .catch(() => {
        // Groups are optional; a failed fetch just hides the picker.
      });
    return () => {
      cancelled = true;
    };
  }, [availableGroups]);

  function toggleGroup(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        status,
        role,
        notes: notes.trim() || undefined,
        groupIds: selectedGroupIds,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const Shell = embedded ? "div" : Card;
  const groups = availableGroups ?? fetchedGroups;

  return (
    <Shell>
      <h2 className="text-lg font-semibold text-ink">
        {member ? "Edit member" : "Add member"}
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="memberFirstName"
              className="mb-1 block text-sm font-semibold text-ink"
            >
              First name
            </label>
            <input
              id="memberFirstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="memberLastName"
              className="mb-1 block text-sm font-semibold text-ink"
            >
              Last name
            </label>
            <input
              id="memberLastName"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="memberEmail"
              className="mb-1 block text-sm font-semibold text-ink"
            >
              Email
            </label>
            <input
              id="memberEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="member@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="memberPhone"
              className="mb-1 block text-sm font-semibold text-ink"
            >
              Phone <span className="text-ink-soft">(optional)</span>
            </label>
            <input
              id="memberPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="memberStatus"
            className="mb-1 block text-sm font-semibold text-ink"
          >
            Status
          </label>
          <select
            id="memberStatus"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as MemberStatus)
            }
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="memberRole"
            className="mb-1 block text-sm font-semibold text-ink"
          >
            Role
          </label>
          <select
            id="memberRole"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className={inputClass}
          >
            <option value="member">Member</option>
            <option value="pastor">Pastor</option>
            <option value="deacon">Deacon</option>
            <option value="elder">Elder</option>
            <option value="leader">Leader</option>
            <option value="volunteer">Volunteer</option>
            <option value="visitor">Visitor</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="memberNotes"
            className="mb-1 block text-sm font-semibold text-ink"
          >
            Notes <span className="text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="memberNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-6`}
            placeholder="Anything worth remembering about this member…"
          />
        </div>

        {groups.length > 0 ? (
          <div>
            <span className="mb-1 block text-sm font-semibold text-ink">
              Groups <span className="text-ink-soft">(optional)</span>
            </span>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-edge bg-panel-2 p-2 sm:grid-cols-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-soft transition hover:bg-panel"
                >
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="h-4 w-4 rounded border-edge accent-primary"
                  />
                  {group.name}
                </label>
              ))}
            </div>
          </div>
        ) : groupsLoading ? (
          <div>
            <span className="mb-1 block text-sm font-semibold text-ink">
              Groups <span className="text-ink-soft">(optional)</span>
            </span>
            <div className="rounded-xl border border-edge bg-panel-2 px-3 py-3 text-sm text-ink-soft">
              Loading groups…
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving…"
              : member
                ? "Save changes"
                : "Add member"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Shell>
  );
}
