"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { deleteSermon, listSermons } from "@/lib/api/sermons";
import type { Sermon } from "@/types/sermon";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function transcriptBadge(status: string) {
  if (status === "ready") return <Badge variant="success">Ready</Badge>;
  if (status === "processing" || status === "queued")
    return <Badge variant="warning">Transcribing</Badge>;
  return <Badge variant="neutral">None</Badge>;
}

function draftBadge(status: string) {
  if (status === "approved") return <Badge variant="success">Approved</Badge>;
  if (status === "draft_ready") return <Badge variant="warning">Needs review</Badge>;
  if (status === "generating") return <Badge variant="neutral">Generating</Badge>;
  return <Badge variant="neutral">None</Badge>;
}

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load sermons.";
}

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

type SortKey =
  | "title"
  | "preacher"
  | "scriptureReference"
  | "preachedAt"
  | "transcriptStatus"
  | "aiDraftStatus";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

interface ColumnDef {
  key: SortKey;
  label: string;
}

const COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title" },
  { key: "preacher", label: "Preacher" },
  { key: "scriptureReference", label: "Scripture" },
  { key: "preachedAt", label: "Date" },
  { key: "transcriptStatus", label: "Transcript" },
  { key: "aiDraftStatus", label: "Draft" },
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

function sortSermons(sermons: Sermon[], sort: SortState): Sermon[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...sermons].sort((a, b) => {
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

export function SermonList() {
  const [sermons, setSermons] = useState<Sermon[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "preachedAt", dir: "desc" });

  useEffect(() => {
    listSermons()
      .then(setSermons)
      .catch((err: unknown) => {
        setError(apiErrorToMessage(err));
        setSermons(null);
      });
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  const handleDelete = useCallback(
    async (sermon: Sermon) => {
      if (!window.confirm(`Delete "${sermon.title}"? This cannot be undone.`)) return;
      await deleteSermon(sermon.id);
      setSermons((prev) => (prev ? prev.filter((s) => s.id !== sermon.id) : prev));
    },
    [],
  );

  const sorted = useMemo(
    () => (sermons ? sortSermons(sermons, sort) : null),
    [sermons, sort],
  );

  // ---- states ----

  if (error) {
    return (
      <EmptyState
        title="Unable to load sermons"
        description={error}
        action={
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (sorted === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">Loading sermons…</p>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="No sermons yet"
        description="Create your first sermon follow-up by adding sermon details and pasting a transcript."
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />
    );
  }

  // ---- table ----

  return (
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
          {sorted.map((sermon) => (
            <tr
              key={sermon.id}
              className="border-b border-stone-100 transition hover:bg-stone-100"
            >
              <td className="px-5 py-3">
                <Link
                  href={`/app/sermons/${sermon.id}`}
                  className="font-medium text-[#102015] transition hover:text-[#012f11]"
                >
                  {sermon.title || "Untitled"}
                </Link>
              </td>

              <td className="px-5 py-3 text-stone-600">
                {sermon.preacher || "\u2014"}
              </td>

              <td className="px-5 py-3 text-stone-600">
                {sermon.scriptureReference || "\u2014"}
              </td>

              <td className="px-5 py-3 text-stone-600">
                {formatDate(sermon.preachedAt) || "\u2014"}
              </td>

              <td className="px-5 py-3">{transcriptBadge(sermon.transcriptStatus)}</td>

              <td className="px-5 py-3">{draftBadge(sermon.aiDraftStatus)}</td>

              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/app/sermons/${sermon.id}`}
                    className="inline-flex items-center gap-1 text-[#012f11] transition hover:text-[#073f19]"
                    aria-label={`Edit ${sermon.title || "sermon"}`}
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
                  </Link>

                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-red-600 transition hover:text-red-700"
                    onClick={() => handleDelete(sermon)}
                    aria-label={`Delete ${sermon.title || "sermon"}`}
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
  );
}
