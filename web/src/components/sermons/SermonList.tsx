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
import { FilterToggle } from "@/components/ui/FilterMenu";
import { FilterSidebar } from "@/components/ui/FilterMenu";
import type { FilterColumn } from "@/components/ui/FilterMenu";
import { FilterPills } from "@/components/ui/FilterPills";
import { RowActions } from "@/components/ui/RowActions";

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

function filterSermons(sermons: Sermon[], filters: Record<string, string>): Sermon[] {
  return sermons.filter((sermon) =>
    Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      const itemValue: string = String(sermon[key as keyof Sermon] ?? "");
      return itemValue.toLowerCase().includes(value.toLowerCase());
    }),
  );
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function SermonList() {
  const [sermons, setSermons] = useState<Sermon[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "preachedAt", dir: "desc" });
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    FILTER_COLUMNS.forEach((col) => (init[col.key] = ""));
    return init;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const entityValues = useMemo((): Record<string, string[]> => {
    if (!sermons) return {};
    const out: Record<string, string[]> = {};
    FILTER_COLUMNS.forEach((col) => {
      if (col.type !== "entity") return;
      const uniq = new Set(
        sermons
          .map((s) => String(s[col.key as keyof Sermon] ?? ""))
          .filter((v) => v.length > 0),
      );
      out[col.key] = [...uniq].sort();
    });
    return out;
  }, [sermons]);

  const filteredCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const sorted = useMemo(
    () => {
      if (!sermons) return null;
      const filtered = filterSermons(sermons, filters);
      return sortSermons(filtered, sort);
    },
    [sermons, filters, sort],
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
            description="Try adjusting the filters or clear them to see all sermons."
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
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <FilterPills
          columns={FILTER_COLUMNS}
          filters={filters}
          onFiltersChange={setFilters}
        />

        <FilterToggle
          open={sidebarOpen}
          count={filteredCount}
          onToggle={() => setSidebarOpen((prev) => !prev)}
        />

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

              <td className="px-5 py-3">{draftBadge(sermon.aiDraftStatus)}</td>              <td className="px-5 py-3">
                <RowActions
                  editHref={`/app/sermons/${sermon.id}`}
                  onDelete={() => handleDelete(sermon)}
                  editLabel={`Edit ${sermon.title || "sermon"}`}
                  deleteLabel={`Delete ${sermon.title || "sermon"}`}
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
