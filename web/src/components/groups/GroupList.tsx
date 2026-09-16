"use client";

import Link from "next/link";

import { bulkDeleteGroups, deleteGroup, listGroups } from "@/lib/api/groups";
import type { Group } from "@/types/group";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

const COLUMNS: DataTableColumn<Group>[] = [
  {
    key: "name",
    label: "Name",
    render: (group) => (
      <Link
        href={`/app/groups/${group.id}`}
        className="font-medium text-ink transition hover:text-primary"
      >
        {group.name}
      </Link>
    ),
  },
  {
    key: "description",
    label: "Description",
    render: (group) => group.description || "—",
  },
  {
    key: "memberCount",
    label: "Members",
    render: (group) => (
      <span className="font-medium text-ink">{group.memberCount}</span>
    ),
  },
  {
    key: "createdAt",
    label: "Created",
    render: (group) => new Date(group.createdAt).toLocaleDateString(),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "name", label: "Name", type: "entity" },
  { key: "description", label: "Description", type: "text" },
];

export function GroupList() {
  return (
    <DataTable
      columns={COLUMNS}
      filterColumns={FILTER_COLUMNS}
      fetchRows={listGroups}
      getRowId={(group) => group.id}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      countLabel={(count) => `${count} ${count === 1 ? "group" : "groups"}`}
      editHref={(group) => `/app/groups/${group.id}`}
      onDelete={async (group) => {
        await deleteGroup(group.id);
      }}
      onBulkDelete={async (ids) => {
        await bulkDeleteGroups(ids);
      }}
      deleteConfirmTitle={() => "Delete group?"}
      deleteConfirmDescription={(group) =>
        `"${group.name}" will be permanently deleted. Members are not deleted — only their membership in this group.`
      }
      errorMessage="Could not load groups."
      emptyTitle="No groups yet"
      emptyDescription="Create groups like Men's Ministry or Women's Ministry to organize your members."
      emptyAction={
        <Link href="/app/groups/new">
          <Button>Add Group</Button>
        </Link>
      }
    />
  );
}
