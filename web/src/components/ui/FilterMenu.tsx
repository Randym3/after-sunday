"use client";

import { SearchableSelect } from "@/components/ui/SearchableSelect";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface FilterColumnValue {
  value: string;
  label: string;
}

export interface FilterColumn {
  key: string;
  label: string;
  type: "text" | "entity" | "status";
  values?: FilterColumnValue[];
}

// ---------------------------------------------------------------------------
// FilterToggle
// ---------------------------------------------------------------------------

function activeCount(filters: Record<string, string>): number {
  return Object.values(filters).filter(Boolean).length;
}

interface FilterToggleProps {
  open: boolean;
  count: number;
  onToggle: () => void;
}

export function FilterToggle({ open, count, onToggle }: FilterToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full border bg-panel-2 px-4 py-2 text-sm font-medium transition ${
        open || count > 0
          ? "border-primary text-primary"
          : "border-edge text-ink-soft hover:border-edge hover:text-ink"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      Filter
      {count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
          {count}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FilterSidebar
// ---------------------------------------------------------------------------

interface FilterSidebarProps {
  columns: FilterColumn[];
  filters: Record<string, string>;
  onFiltersChange: (filters: Record<string, string>) => void;
  /** Unique values from the data, keyed by column key. Used for entity-type selects. */
  entityValues?: Record<string, string[]>;
}

export function FilterSidebar({
  columns,
  filters,
  onFiltersChange,
  entityValues = {},
}: FilterSidebarProps) {
  const count = activeCount(filters);

  function update(key: string, value: string) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function clearAll() {
    const cleared: Record<string, string> = {};
    columns.forEach((col) => {
      cleared[col.key] = "";
    });
    onFiltersChange(cleared);
  }

  return (
    <aside className="w-60 flex-shrink-0 rounded-2xl border border-edge bg-panel p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Filter
        </p>

        {count > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-4">
        {columns.map((col) => {
          const options = entityValues[col.key] ?? [];

          return (
            <div key={col.key}>
              <label
                htmlFor={`filter-${col.key}`}
                className="mb-1.5 block text-xs font-semibold text-ink-soft"
              >
                {col.label}
              </label>

              {col.type === "entity" && options.length > 0 ? (
                <SearchableSelect
                  value={filters[col.key] ?? ""}
                  options={options}
                  placeholder={`Select ${col.label.toLowerCase()}…`}
                  onChange={(v) => update(col.key, v)}
                />
              ) : col.type === "status" ? (
                <select
                  id={`filter-${col.key}`}
                  value={filters[col.key] ?? ""}
                  onChange={(e) => update(col.key, e.target.value)}
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-xs text-ink outline-none transition focus:border-primary"
                >
                  <option value="">Any</option>

                  {col.values?.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`filter-${col.key}`}
                  type="text"
                  value={filters[col.key] ?? ""}
                  onChange={(e) => update(col.key, e.target.value)}
                  placeholder={`Filter ${col.label.toLowerCase()}…`}
                  className="w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-xs text-ink outline-none transition focus:border-primary"
                />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
