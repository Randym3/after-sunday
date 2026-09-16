"use client";

import Link from "next/link";

import { bulkDeleteMembers, deleteMember, listMembers } from "@/lib/api/members";
import type { Member } from "@/types/member";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

function statusBadge(status: string) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "removed") return <Badge variant="danger">Removed</Badge>;
  if (status === "inactive") return <Badge variant="neutral">Inactive</Badge>;
  return <Badge variant="neutral">Paused</Badge>;
}

function roleLabel(role?: string) {
  if (!role) return "Member";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const COLUMNS: DataTableColumn<Member>[] = [
  {
    key: "firstName",
    label: "First",
    render: (member) => (
      <Link
        href={`/app/members/${member.id}`}
        className="font-medium text-ink transition hover:text-primary"
      >
        {member.firstName}
      </Link>
    ),
  },
  {
    key: "lastName",
    label: "Last",
    render: (member) => (
      <span className="font-medium text-ink">{member.lastName}</span>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (member) => member.email,
  },
  {
    key: "phone",
    label: "Phone",
    render: (member) => member.phone || "\u2014",
  },
  {
    key: "role",
    label: "Role",
    render: (member) => <Badge variant="neutral">{roleLabel(member.role)}</Badge>,
  },
  {
    key: "status",
    label: "Status",
    render: (member) => statusBadge(member.status),
  },
  {
    key: "createdAt",
    label: "Created",
    render: (member) => new Date(member.createdAt).toLocaleDateString(),
  },
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

export function MemberList() {
  return (
    <DataTable
      columns={COLUMNS}
      filterColumns={FILTER_COLUMNS}
      fetchRows={listMembers}
      getRowId={(member) => member.id}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      countLabel={(count) => `${count} ${count === 1 ? "member" : "members"}`}
      editHref={(member) => `/app/members/${member.id}`}
      onDelete={async (member) => {
        await deleteMember(member.id);
      }}
      onBulkDelete={async (ids) => {
        await bulkDeleteMembers(ids);
      }}
      deleteConfirmTitle={() => "Delete member?"}
      deleteConfirmDescription={(member) =>
        `${member.firstName} ${member.lastName} will be permanently deleted. This cannot be undone.`
      }
      errorMessage="Could not load members."
      emptyTitle="No members yet"
      emptyDescription="Add members so you can prepare sermon follow-ups for people who missed Sunday."
      emptyAction={
        <Link href="/app/members/new">
          <Button>Add Member</Button>
        </Link>
      }
    />
  );
}
