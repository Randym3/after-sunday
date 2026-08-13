"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPills } from "@/components/ui/FilterPills";
import { FilterSidebar } from "@/components/ui/FilterMenu";
import type { FilterColumn } from "@/components/ui/FilterMenu";
import { RowActions } from "@/components/ui/RowActions";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface SortState {
  key: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  filterColumns: FilterColumn[];
  fetchRows: () => Promise<T[]>;
  getRowId: (row: T) => string;
  defaultSort: SortState;

  /** Renders an edit icon linking here. Omit to hide the edit icon. */
  editHref?: (row: T) => string;
  /** Renders the delete icon + confirm dialog. Omit to hide delete. */
  onDelete?: (row: T) => Promise<void>;
  deleteConfirmTitle?: (row: T) => string;
  deleteConfirmDescription?: (row: T) => string;

  /** Bulk-delete selected rows. Omit to hide selection checkboxes. */
  onBulkDelete?: (ids: string[]) => Promise<void>;

  errorMessage?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;

  /** Extra controls above the table (e.g. Add Member + count). Receives the visible row count. */
  renderToolbar?: (count: number) => ReactNode;

  /** Bump this to force a refetch (e.g. after creating a row elsewhere). */
  reloadSignal?: number;
}

function apiErrorToMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

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

function sortRows<T>(rows: T[], sort: SortState): T[] {
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av: string = String((a as Record<string, unknown>)[sort.key] ?? "");
    const bv: string = String((b as Record<string, unknown>)[sort.key] ?? "");
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function filterRows<T>(
  rows: T[],
  filters: Record<string, string>,
): T[] {
  return rows.filter((row) =>
    Object.entries(filters).every(([key, value]) => {
      if (!value) return true;
      const itemValue: string = String(
        (row as Record<string, unknown>)[key] ?? "",
      );
      return itemValue.toLowerCase().includes(value.toLowerCase());
    }),
  );
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  columns,
  filterColumns,
  fetchRows,
  getRowId,
  defaultSort,
  editHref,
  onDelete,
  deleteConfirmTitle,
  deleteConfirmDescription,
  onBulkDelete,
  errorMessage = "Could not load items.",
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderToolbar,
  reloadSignal = 0,
}: DataTableProps<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    filterColumns.forEach((col) => (init[col.key] = ""));
    return init;
  });
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [retrySignal, setRetrySignal] = useState(0);

  // -- bulk selection --------------------------------------------------
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchRows()
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(apiErrorToMessage(err, errorMessage));
          setRows(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchRows, reloadSignal, retrySignal, errorMessage]);

  const handleSort = useCallback((key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }, []);

  const entityValues = useMemo((): Record<string, string[]> => {
    if (!rows) return {};
    const out: Record<string, string[]> = {};
    filterColumns.forEach((col) => {
      if (col.type !== "entity") return;
      const uniq = new Set(
        rows
          .map((r) => String((r as Record<string, unknown>)[col.key] ?? ""))
          .filter((v) => v.length > 0),
      );
      out[col.key] = [...uniq].sort();
    });
    return out;
  }, [rows, filterColumns]);

  const filteredCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const sorted = useMemo(() => {
    if (!rows) return null;
    return sortRows(filterRows(rows, filters), sort);
  }, [rows, filters, sort]);

  const visibleIds = useMemo(
    () => new Set(sorted?.map(getRowId) ?? []),
    [sorted, getRowId],
  );

  const selectedCount = useMemo(() => {
    let n = 0;
    selectedIds.forEach((id) => {
      if (visibleIds.has(id)) n++;
    });
    return n;
  }, [selectedIds, visibleIds]);

  const isAllSelected = !!(
    sorted && sorted.length > 0 && selectedCount === sorted.length
  );

  function toggleSelectAll() {
    if (!sorted) return;
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(getRowId)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleSingleDelete = useCallback(
    async (row: T) => {
      if (!onDelete) return;
      await onDelete(row);
      setPendingDelete(null);
      setRows((prev) =>
        prev ? prev.filter((r) => getRowId(r) !== getRowId(row)) : prev,
      );
    },
    [onDelete, getRowId],
  );

  async function handleBulkDelete() {
    if (!onBulkDelete) return;
    setBulkDeleting(true);
    const toDelete = [...selectedIds].filter((id) => visibleIds.has(id));
    await onBulkDelete(toDelete);
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    setRows(
      (prev) =>
        prev?.filter((r) => !selectedIds.has(getRowId(r))) ?? prev,
    );
  }

  // ---- states ----

  if (error) {
    return (
      <EmptyState
        title="Unable to load data"
        description={error}
        action={
          <Button
            type="button"
            onClick={() => setRetrySignal((s) => s + 1)}
          >
            Try again
          </Button>
        }
      />
    );
  }

  if (sorted === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">
          Loading…
        </p>
      </Card>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {filteredCount > 0 ? (
            <EmptyState
              title="No results match your filters"
              description="Try adjusting the filters or clear them to see all items."
              action={
                <Button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => {
                      const cleared: Record<string, string> = {};
                      Object.keys(prev).forEach((k) => (cleared[k] = ""));
                      return cleared;
                    })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          )}
        </div>

        <FilterSidebar
          columns={filterColumns}
          filters={filters}
          onFiltersChange={setFilters}
          entityValues={entityValues}
        />
      </div>
    );
  }

  // ---- table ----

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <FilterPills
          columns={filterColumns}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {renderToolbar ? (
          <div className="flex items-center justify-end">
            {renderToolbar(sorted.length)}
          </div>
        ) : null}

        {/* Bulk-delete action bar */}
        {selectedCount > 0 && onBulkDelete ? (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
            <p className="text-sm font-medium text-red-800">
              {selectedCount}{" "}
              {selectedCount === 1 ? "item" : "items"} selected
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting}
            >
              Delete selected
            </Button>
          </div>
        ) : null}

        <Card className="overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                {onBulkDelete ? (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300 text-[#012f11] focus:ring-[#012f11]"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                ) : null}

                {columns.map((col) => (
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

                {editHref || onDelete ? (
                  <th
                    scope="col"
                    className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500"
                  >
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {sorted.map((row) => {
                const id = getRowId(row);

                return (
                  <tr
                    key={id}
                    className="border-b border-stone-100 transition hover:bg-stone-100"
                  >
                    {onBulkDelete ? (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-stone-300 text-[#012f11] focus:ring-[#012f11]"
                          checked={selectedIds.has(id)}
                          onChange={() => toggleSelect(id)}
                          aria-label={`Select ${id}`}
                        />
                      </td>
                    ) : null}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-5 py-3 text-stone-600"
                      >
                        {col.render ? col.render(row) : null}
                      </td>
                    ))}

                    {editHref || onDelete ? (
                      <td className="px-5 py-3">
                        <RowActions
                          editHref={editHref ? editHref(row) : undefined}
                          onDelete={
                            onDelete ? () => setPendingDelete(row) : undefined
                          }
                          editLabel="Edit"
                          deleteLabel="Delete"
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>

      <FilterSidebar
        columns={filterColumns}
        filters={filters}
        onFiltersChange={setFilters}
        entityValues={entityValues}
      />

      {onDelete ? (
        <ConfirmDialog
          open={pendingDelete !== null}
          title={
            pendingDelete
              ? deleteConfirmTitle?.(pendingDelete) ?? "Delete item?"
              : "Delete item?"
          }
          description={
            pendingDelete
              ? deleteConfirmDescription?.(pendingDelete) ??
                "This will be permanently deleted. This cannot be undone."
              : "This will be permanently deleted. This cannot be undone."
          }
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            if (pendingDelete) handleSingleDelete(pendingDelete);
          }}
        />
      ) : null}

      {onBulkDelete ? (
        <ConfirmDialog
          open={bulkDeleteOpen}
          title={`Delete ${selectedCount} ${selectedCount === 1 ? "item" : "items"}?`}
          description={`${selectedCount} ${selectedCount === 1 ? "item will" : "items will"} be permanently deleted. This cannot be undone.`}
          onCancel={() => setBulkDeleteOpen(false)}
          onConfirm={handleBulkDelete}
        />
      ) : null}
    </div>
  );
}
