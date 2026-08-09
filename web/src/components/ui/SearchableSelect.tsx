"use client";

import { useEffect, useRef, useState } from "react";

interface SearchableSelectProps {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export function SearchableSelect({
  value,
  options,
  placeholder = "Search…",
  onChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter((o) =>
        o.toLowerCase().includes(query.toLowerCase()),
      )
    : options.slice(0, 8);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={value || placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs outline-none transition focus:border-[#012f11]"
      />

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-xs transition hover:bg-stone-100 ${
                  opt === value
                    ? "bg-[#012f11]/10 font-medium text-[#012f11]"
                    : "text-stone-700"
                }`}
                onClick={() => {
                  onChange(opt === value ? "" : opt);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* cover click-through when open */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
