"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import {
  getYoutubeChannel,
  syncYoutubeChannel,
} from "@/lib/api/youtube";

export function YoutubeChannelSyncCard() {
  const [channelUrl, setChannelUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    getYoutubeChannel()
      .then((result) => {
        if (!cancelled) setChannelUrl(result.channelUrl ?? "");
      })
      .catch(() => {
        // The card remains usable if the saved setting cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSync() {
    const url = channelUrl.trim();
    if (!url || syncing) return;

    setSyncing(true);
    try {
      const result = await syncYoutubeChannel(url);
      if (result.created === 0) {
        toast(
          `Channel checked — all ${result.videosFound} video${result.videosFound === 1 ? "" : "s"} are already in your sermons.`,
          "info",
        );
      } else {
        toast(
          `Added ${result.created} video${result.created === 1 ? "" : "s"} from the YouTube channel. Transcripts were not imported.`,
          "success",
        );
      }
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not sync the YouTube channel.",
        "error",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Sync YouTube channel</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
            Keep one church channel connected to After Sunday. This adds new
            video records and links only — it does not start transcript imports.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
          <label htmlFor="youtube-channel-url" className="sr-only">
            YouTube channel URL
          </label>
          <input
            id="youtube-channel-url"
            type="url"
            value={channelUrl}
            onChange={(event) => setChannelUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSync();
              }
            }}
            placeholder="https://www.youtube.com/@YourChurch"
            disabled={syncing}
            className="min-w-0 flex-1 rounded-full border border-edge bg-panel-2 px-4 py-2.5 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-50"
          />
          <Button
            type="button"
            variant="orange"
            onClick={() => void handleSync()}
            disabled={!channelUrl.trim() || syncing}
          >
            {syncing ? "Syncing…" : "Sync channel"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
