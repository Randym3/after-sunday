"use client";

import type { FilterColumn } from "@/components/ui/FilterMenu";

interface FilterPillsProps {
  columns: FilterColumn[];
  filters: Record<string, string>;
  onFiltersChange: (filters: Record<string, string>) => void;
}

function labelFor(columns: FilterColumn[], key: string): string {
  return columns.find((c) => c.key === key)?.label ?? key;
}

export function FilterPills({
  columns,
  filters,
  onFiltersChange,
}: FilterPillsProps) {
  const active = Object.entries(filters).filter(([, v]) => v);

  if (active.length === 0) return null;

  function remove(key: string) {
    onFiltersChange({ ...filters, [key]: "" });
  }

  function clearAll() {
    const cleared: Record<string, string> = {};
    columns.forEach((col) => {
      cleared[col.key] = "";
    });
    onFiltersChange(cleared);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {active.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600"
        >
          <span className="font-medium text-stone-700">
            {labelFor(columns, key)}:
          </span>
          {value}
          <button
            type="button"
            onClick={() => remove(key)}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-200 hover:text-stone-600"
            aria-label={`Remove ${labelFor(columns, key)} filter`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={clearAll}
        className="text-xs font-medium text-[#012f11] transition hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
