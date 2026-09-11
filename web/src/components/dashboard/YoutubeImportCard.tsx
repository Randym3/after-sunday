"use client";

import { useCallback, useEffect, useState } from "react";

import {
  bulkImportYoutubeTranscripts,
  cancelBulkImport,
  getBulkImportStatus,
} from "@/lib/api/youtube";
import type { BulkImportStatus } from "@/lib/api/youtube";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const POLL_INTERVAL_MS = 4000;

/**
 * Dashboard card for bulk-importing YouTube captions for every sermon
 * without a ready transcript. Imports run through the API's sequential
 * transcription worker, so the UI just enqueues the work and polls counts.
 */
export function YoutubeImportCard() {
  const [status, setStatus] = useState<BulkImportStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(() => {
    getBulkImportStatus()
      .then(setStatus)
      .catch(() => {
        // Metrics elsewhere already surface API errors; keep this quiet.
      });
  }, []);

  const hasQueuedWork =
    status !== null && status.queued + status.processing > 0;
  const total = status?.total ?? 0;
  const ready = status?.ready ?? 0;
  const pending =
    status === null ? 0 : status.failed + status.queued + status.processing;
  const percent = total > 0 ? Math.round((ready / total) * 100) : 0;

  // Poll only while a run is active — an idle dashboard shouldn't spam the
  // API. A single fetch happens on mount and when the tab regains focus,
  // so a run started in another tab still shows up shortly after looking.
  useEffect(() => {
    refresh();
    if (!hasQueuedWork) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh, hasQueuedWork]);

  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function handleStart() {
    setStarting(true);
    try {
      const result = await bulkImportYoutubeTranscripts();
      if (result.queued === 0) {
        toast("No missing transcripts to import.", "info");
      } else {
        toast(
          `Queued ${result.queued} sermon${result.queued === 1 ? "" : "s"} for import — this runs in the background.`,
          "success",
        );
      }
      refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not start the import.",
        "error",
      );
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const result = await cancelBulkImport();
      toast(
        `Cancelled — ${result.cancelled} queued sermon${result.cancelled === 1 ? "" : "s"} won't be imported. The one currently processing finishes first.`,
        "info",
      );
      refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not cancel the import.",
        "error",
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">
            YouTube transcript imports
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {status === null
              ? "Checking import status…"
              : pending === 0
                ? `All ${total} YouTube sermons have transcripts.`
                : `${pending} sermon${pending === 1 ? "" : "s"} still need a transcript. Imports run one at a time to avoid rate limits.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasQueuedWork && (
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel import"}
            </Button>
          )}
          <Button
            variant="orange"
            onClick={handleStart}
            disabled={starting || hasQueuedWork}
          >
            {hasQueuedWork
              ? "Import running…"
              : starting
                ? "Queuing…"
                : "Import missing transcripts"}
          </Button>
        </div>
      </div>

      {total > 0 && (
        <div className="mt-4">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-panel-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Transcript import progress"
          >
            <div
              className="h-full rounded-full bg-mint transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {ready} of {total} transcripts ready
            {status !== null && status.processing > 0
              ? ` · ${status.processing} importing now`
              : ""}
            {status !== null && status.queued > 0
              ? ` · ${status.queued} queued`
              : ""}
            {status !== null && status.failed > 0
              ? ` · ${status.failed} failed (no captions or blocked)`
              : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
