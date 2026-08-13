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
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load this group.";
}

const COLUMNS: DataTableColumn<Member>[] = [
  {
    key: "firstName",
    label: "First",
    render: (member) => (
      <span className="font-medium text-[#102015]">
        {member.firstName}
      </span>
    ),
  },
  {
    key: "lastName",
    label: "Last",
    render: (member) => (
      <span className="font-medium text-[#102015]">{member.lastName}</span>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (member) => member.email,
  },
  {
    key: "role",
    label: "Role",
    render: (member) => (
      <Badge variant="neutral">
        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
      </Badge>
    ),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "firstName", label: "First", type: "entity" },
  { key: "lastName", label: "Last", type: "entity" },
  { key: "email", label: "Email", type: "entity" },
];

interface GroupEditProps {
  groupId: string;
}

export function GroupEdit({ groupId }: GroupEditProps) {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [reloadSignal, setReloadSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGroup(groupId), listMembers()])
      .then(([g, members]) => {
        if (!cancelled) {
          setGroup(g);
          setAllMembers(members);
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
    setAddMessage("Group details saved.");
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  async function handleAddMember() {
    if (!selectedMemberId) return;
    setAdding(true);
    setAddMessage("");
    try {
      await addGroupMembers(groupId, [selectedMemberId]);
      setSelectedMemberId("");
      setAddMessage("Member added to group.");
      setReloadSignal((s) => s + 1);
    } finally {
      setAdding(false);
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

      <GroupForm group={group} onCancel={handleCancel} onSubmit={handleFormSubmit} />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#102015]">
              Members in this group
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-56 rounded-xl border border-[#ddd8c8] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#012f11]"
              aria-label="Add member"
            >
              <option value="">Add a member…</option>
              {allMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <Button
              type="button"
              onClick={handleAddMember}
              disabled={!selectedMemberId || adding}
            >
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>

        {addMessage ? (
          <p className="mt-3 text-sm font-medium text-green-800">
            {addMessage}
          </p>
        ) : null}

        <div className="mt-5">
          <DataTable
            columns={COLUMNS}
            filterColumns={FILTER_COLUMNS}
            fetchRows={() => listGroupMembers(groupId)}
            getRowId={(member) => member.id}
            defaultSort={{ key: "lastName", dir: "asc" }}
            countLabel={(count) =>
              `${count} ${count === 1 ? "member" : "members"}`
            }
            onDelete={async (member) => {
              await removeGroupMembers(groupId, [member.id]);
            }}
            deleteConfirmTitle={() => "Remove from group?"}
            deleteConfirmDescription={(member) =>
              `${member.firstName} ${member.lastName} will be removed from this group. They are not deleted from your member directory.`
            }
            errorMessage="Could not load group members."
            emptyTitle="No members in this group"
            emptyDescription="Use the dropdown above to add members to this group."
            reloadSignal={reloadSignal}
          />
        </div>
      </Card>
    </div>
  );
}
