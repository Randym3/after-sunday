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
import { FilterToggle } from "@/components/ui/FilterMenu";
import { FilterSidebar } from "@/components/ui/FilterMenu";
import type { FilterColumn } from "@/components/ui/FilterMenu";
import { FilterPills } from "@/components/ui/FilterPills";
import { RowActions } from "@/components/ui/RowActions";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  if (status === "active") {
    return <Badge variant="success">Active</Badge>;
  }

  if (status === "removed") {
    return <Badge variant="danger">Removed</Badge>;
  }

  if (status === "inactive") {
    return <Badge variant="neutral">Inactive</Badge>;
  }

  return <Badge variant="neutral">Paused</Badge>;
}

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load members.";
}

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

type SortKey =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "status"
  | "role";

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
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "firstName", label: "First", type: "entity" },
  { key: "lastName", label: "Last", type: "entity" },
  { key: "email", label: "Email", type: "entity" },
  { key: "phone", label: "Phone", type: "text" },
  {
    key: "role",
    label: "Role",
    type: "status",
    values: [
      { value: "member", label: "Member" },
      { value: "pastor", label: "Pastor" },
      { value: "deacon", label: "Deacon" },
      { value: "elder", label: "Elder" },
      { value: "leader", label: "Leader" },
      { value: "volunteer", label: "Volunteer" },
      { value: "visitor", label: "Visitor" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "status",
    values: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "inactive", label: "Inactive" },
      { value: "removed", label: "Removed" },
    ],
  },
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

function filterMembers(members: Member[], filters: Record<string, string>): Member[] {
  return members.filter((member) =>
    Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      const itemValue: string = String(member[key as keyof Member] ?? "");
      return itemValue.toLowerCase().includes(value.toLowerCase());
    }),
  );
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function MemberList() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "lastName", dir: "asc" });
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    FILTER_COLUMNS.forEach((col) => (init[col.key] = ""));
    return init;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const entityValues = useMemo((): Record<string, string[]> => {
    if (!members) return {};
    const out: Record<string, string[]> = {};
    FILTER_COLUMNS.forEach((col) => {
      if (col.type !== "entity") return;
      const uniq = new Set(
        members
          .map((m) => String(m[col.key as keyof Member] ?? ""))
          .filter((v) => v.length > 0),
      );
      out[col.key] = [...uniq].sort();
    });
    return out;
  }, [members]);

  const filteredCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const sorted = useMemo(
    () => {
      if (!members) return null;
      const filtered = filterMembers(members, filters);
      return sortMembers(filtered, sort);
    },
    [members, filters, sort],
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
    if (filteredCount > 0) {
      return (
        <div className="space-y-3">
          <FilterToggle
            open={sidebarOpen}
            count={filteredCount}
            onToggle={() => setSidebarOpen((prev) => !prev)}
          />

          <EmptyState
            title="No results match your filters"
            description="Try adjusting the filters or clear them to see all members."
            action={
              <Button
                type="button"
                onClick={() => setFilters((prev) => {
                  const cleared: Record<string, string> = {};
                  Object.keys(prev).forEach((k) => (cleared[k] = ""));
                  return cleared;
                })}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      );
    }

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
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <FilterPills
          columns={FILTER_COLUMNS}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FilterToggle
              open={sidebarOpen}
              count={filteredCount}
              onToggle={() => setSidebarOpen((prev) => !prev)}
            />

            <p className="text-sm text-stone-600">
              {sorted.length} {sorted.length === 1 ? "member" : "members"}
            </p>
          </div>

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
                  <Badge variant="neutral">
                    {member.role
                      ? member.role.charAt(0).toUpperCase() +
                        member.role.slice(1)
                      : "Member"}
                  </Badge>
                </td>

                <td className="px-5 py-3">{statusBadge(member.status)}</td>

                <td className="px-5 py-3">
                  <RowActions
                    onEdit={() => openEditForm(member)}
                    onDelete={() => handleDelete(member)}
                    editLabel={`Edit ${member.firstName} ${member.lastName}`}
                    deleteLabel={`Delete ${member.firstName} ${member.lastName}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </Card>
      </div>

      {sidebarOpen && (
        <FilterSidebar
          columns={FILTER_COLUMNS}
          filters={filters}
          onFiltersChange={setFilters}
          entityValues={entityValues}
        />
      )}
    </div>
  );
}
