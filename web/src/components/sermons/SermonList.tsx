"use client";

import Link from "next/link";

import { bulkDeleteSermons, deleteSermon, listSermons } from "@/lib/api/sermons";
import type { Sermon } from "@/types/sermon";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function transcriptBadge(status: string, transcriptError?: string | null) {
  if (status === "ready") return <Badge variant="success">Ready</Badge>;
  if (status === "processing" || status === "queued")
    return <Badge variant="warning">Transcribing</Badge>;
  if (status === "failed") {
    return transcriptError?.includes("[no-english-captions]") ? (
      <Badge variant="neutral">No English captions</Badge>
    ) : (
      <Badge variant="danger">Failed</Badge>
    );
  }
  return <Badge variant="neutral">None</Badge>;
}

function draftBadge(status: string) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  if (status === "draft_ready") return <Badge variant="warning">Needs review</Badge>;
  if (status === "generating") return <Badge variant="neutral">Generating</Badge>;
  return <Badge variant="neutral">None</Badge>;
}

const COLUMNS: DataTableColumn<Sermon>[] = [
  {
    key: "title",
    label: "Title",
    render: (sermon) => (
      <Link
        href={`/app/sermons/${sermon.id}`}
        className="font-medium text-ink transition hover:text-primary"
      >
        {sermon.title || "Untitled"}
      </Link>
    ),
  },
  {
    key: "preacher",
    label: "Preacher",
    render: (sermon) => sermon.preacher || "\u2014",
  },
  {
    key: "scriptureReference",
    label: "Scripture",
    render: (sermon) => sermon.scriptureReference || "\u2014",
  },
  {
    key: "preachedAt",
    label: "Date",
    render: (sermon) => formatDate(sermon.preachedAt) || "\u2014",
  },
  {
    key: "transcriptStatus",
    label: "Transcript",
    render: (sermon) =>
      transcriptBadge(sermon.transcriptStatus, sermon.transcriptError),
  },
  {
    key: "aiDraftStatus",
    label: "Draft",
    render: (sermon) => draftBadge(sermon.aiDraftStatus),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "title", label: "Title", type: "entity" },
  { key: "preacher", label: "Preacher", type: "entity" },
  { key: "scriptureReference", label: "Scripture", type: "entity" },
  {
    key: "transcriptStatus",
    label: "Transcript",
    type: "status",
    values: [
      { value: "ready", label: "Ready" },
      { value: "processing", label: "Transcribing" },
      { value: "queued", label: "Queued" },
      { value: "failed", label: "Failed" },
      { value: "not_started", label: "None" },
    ],
  },
  {
    key: "aiDraftStatus",
    label: "Draft",
    type: "status",
    values: [
      { value: "approved", label: "Approved" },
      { value: "draft_ready", label: "Needs review" },
      { value: "generating", label: "Generating" },
      { value: "not_started", label: "None" },
    ],
  },
];

export function SermonList() {
  return (
    <DataTable
      columns={COLUMNS}
      filterColumns={FILTER_COLUMNS}
      fetchRows={listSermons}
      getRowId={(sermon) => sermon.id}
      defaultSort={{ key: "preachedAt", dir: "desc" }}
      countLabel={(count) => `${count} ${count === 1 ? "sermon" : "sermons"}`}
      editHref={(sermon) => `/app/sermons/${sermon.id}`}
      onDelete={async (sermon) => {
        await deleteSermon(sermon.id);
      }}
      onBulkDelete={async (ids) => {
        await bulkDeleteSermons(ids);
      }}
      deleteConfirmTitle={() => "Delete sermon?"}
      deleteConfirmDescription={(sermon) =>
        `"${sermon.title}" will be permanently deleted. This cannot be undone.`
      }
      errorMessage="Could not load sermons."
      emptyTitle="No sermons yet"
      emptyDescription="Create your first sermon follow-up by adding sermon details and pasting a transcript."
      emptyAction={
        <Link href="/app/sermons/new">
          <Button>Create Sermon</Button>
        </Link>
      }
    />
  );
}
