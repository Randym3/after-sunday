"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";
import {
  createMember,
  deleteMember,
  listMembers,
  updateMember,
} from "@/lib/api/members";
import type { CreateMemberInput, Member } from "@/types/member";

import { MemberForm } from "@/components/members/MemberForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load members.";
}

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

type SortKey = "firstName" | "lastName" | "email" | "phone" | "status";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface ColumnDef {
  key: SortKey;
  label: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "firstName", label: "First" },
  { key: "lastName", label: "Last" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
];

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span
      aria-hidden
      className={`ml-1 inline-block w-2.5 text-center text-[10px] ${
        active ? "text-[#012f11]" : "opacity-0"
      }`}
    >
      {dir === "asc" ? "\u25B2" : "\u25BC"}
    </span>
  );
}

function sortMembers(members: Member[], sort: SortState): Member[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...members].sort((a, b) => {
    const av: string = (a[sort.key] ?? "") as string;
    const bv: string = (b[sort.key] ?? "") as string;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function MemberList() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "lastName", dir: "asc" });
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  useEffect(() => {
    listMembers()
      .then(setMembers)
      .catch((err: unknown) => {
        setError(apiErrorToMessage(err));
        setMembers(null);
      });
  }, []);

  function refreshList() {
    setMembers(null);
    setError("");
    listMembers()
      .then(setMembers)
      .catch((err: unknown) => {
        setError(apiErrorToMessage(err));
        setMembers(null);
      });
  }

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  async function handleDelete(member: Member) {
    const confirmed = window.confirm(
      `Delete ${member.firstName} ${member.lastName}? This cannot be undone.`,
    );
    if (!confirmed) return;
    await deleteMember(member.id);
    refreshList();
  }

  async function handleSubmit(values: CreateMemberInput) {
    if (editingMember) {
      await updateMember(editingMember.id, values);
    } else {
      await createMember(values);
    }
    closeForm();
    refreshList();
  }

  function openAddForm() {
    setEditingMember(null);
    setShowForm(true);
  }

  function openEditForm(member: Member) {
    setEditingMember(member);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingMember(null);
  }

  const sorted = useMemo(
    () => (members ? sortMembers(members, sort) : null),
    [members, sort],
  );

  // ---- states ----

  if (error) {
    return (
      <EmptyState
        title="Unable to load members"
        description={error}
        action={
          <Button type="button" onClick={refreshList}>
            Try again
          </Button>
        }
      />
    );
  }

  if (sorted === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">Loading members…</p>
      </Card>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6">
        <MemberForm
          member={editingMember}
          onCancel={closeForm}
          onSubmit={handleSubmit}
        />
        {sorted.length > 0 && (
          <Button type="button" variant="secondary" onClick={closeForm}>
            Hide form
          </Button>
        )}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="No members yet"
        description="Add members so you can prepare sermon follow-ups for people who missed Sunday."
        action={
          <Button type="button" onClick={openAddForm}>
            Add Member
          </Button>
        }
      />
    );
  }

  // ---- table ----

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600">
          {sorted.length} {sorted.length === 1 ? "member" : "members"}
        </p>
        <Button type="button" onClick={openAddForm}>
          Add Member
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="cursor-pointer select-none px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 transition hover:text-[#102015]"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  <SortArrow
                    active={sort.key === col.key}
                    dir={sort.key === col.key ? sort.dir : "desc"}
                  />
                </th>
              ))}

              <th
                scope="col"
                className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500"
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((member) => (
              <tr
                key={member.id}
                className="border-b border-stone-100 transition hover:bg-stone-100"
              >
                <td className="px-5 py-3 font-medium text-[#102015]">
                  {member.firstName}
                </td>

                <td className="px-5 py-3 font-medium text-[#102015]">
                  {member.lastName}
                </td>

                <td className="px-5 py-3 text-stone-600">{member.email}</td>

                <td className="px-5 py-3 text-stone-600">
                  {member.phone || "\u2014"}
                </td>

                <td className="px-5 py-3">
                  <Badge
                    variant={member.status === "active" ? "success" : "neutral"}
                  >
                    {member.status === "active" ? "Active" : "Paused"}
                  </Badge>
                </td>

                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[#012f11] transition hover:text-[#073f19]"
                      onClick={() => openEditForm(member)}
                      aria-label={`Edit ${member.firstName} ${member.lastName}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-red-600 transition hover:text-red-700"
                      onClick={() => handleDelete(member)}
                      aria-label={`Delete ${member.firstName} ${member.lastName}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" x2="10" y1="11" y2="17" />
                        <line x1="14" x2="14" y1="11" y2="17" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
