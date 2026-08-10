"use client";

import { useEffect, useRef, useState } from "react";

import { uploadSermonMedia } from "@/lib/api/uploads";
import type { UploadProgress } from "@/lib/api/uploads";
import { cn } from "@/lib/utils/cn";

interface MediaUploaderProps {
  sermonId: string;
  file: File;
  /** Called when upload finishes (screen advances) or is cancelled. */
  onComplete: () => void;
  onCancel: () => void;
  /** Optional slot for a note below the progress bar. */
  note?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaUploader({
  sermonId,
  file,
  onComplete,
  onCancel,
  note,
}: MediaUploaderProps) {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  const started = useRef(false);
  const mountedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // React StrictMode double-invokes effects in dev. Guard so the upload
    // starts once, while the shared mounted ref lets the original upload
    // continue receiving updates after StrictMode's rehearsal cleanup.
    mountedRef.current = true;

    if (started.current) {
      return () => {
        mountedRef.current = false;
      };
    }

    started.current = true;

    uploadSermonMedia(sermonId, file, (nextProgress) => {
      if (!mountedRef.current) return false;
      if (cancelled.current) return true;
      setProgress(nextProgress);
      return false;
    })
      .then(() => {
        if (mountedRef.current && !cancelled.current) {
          onCompleteRef.current();
        }
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Upload failed");
      });

    return () => {
      mountedRef.current = false;
    };
  }, [sermonId, file]);

  const pct = progress ? Math.round(progress.percent * 100) : 0;
  const done = pct >= 100;

  return (
    <div className="mt-5 space-y-4 rounded-3xl border border-[#ddd8c8] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#102015]">
          {done ? "Upload complete" : "Uploading your file…"}
        </h3>

        <button
          type="button"
          onClick={() => {
            cancelled.current = true;
            onCancel();
          }}
          className="rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          aria-label="Cancel upload"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="4" x2="14" y2="14" />
            <line x1="14" y1="4" x2="4" y2="14" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M6 2h5l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
            <polyline points="11,2 11,7 16,7" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-stone-800">
            {file.name}
          </p>

          <p className="text-xs text-stone-500">
            {done ? "Upload finished" : `${pct}% completed`}
          </p>
        </div>

        <span className="text-xs tabular-nums text-stone-400">
          {formatBytes(progress?.transferred ?? 0)} / {formatBytes(file.size)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-150",
            error ? "bg-red-500" : done ? "bg-[#012f11]" : "bg-[#acd863]",
          )}
          style={{ width: `${error ? 100 : pct}%` }}
        />
      </div>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {note ? <p className="text-xs leading-5 text-stone-500">{note}</p> : null}
    </div>
  );
}
