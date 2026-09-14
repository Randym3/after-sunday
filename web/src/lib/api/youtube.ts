import { apiFetch } from "@/lib/api/client";

export interface YoutubePreview {
  videoId: string;
  title: string;
  uploadDate: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  durationSeconds: number | null;
  scriptureReference: string | null;
}

export function previewYoutubeVideo(url: string): Promise<YoutubePreview> {
  return apiFetch<YoutubePreview>("/youtube/preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export interface YoutubeTranscriptImport {
  videoId: string;
  transcript: string;
}

export function importYoutubeTranscript(
  url: string,
): Promise<YoutubeTranscriptImport> {
  return apiFetch<YoutubeTranscriptImport>("/youtube/transcript", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export interface YoutubeChannel {
  channelUrl: string | null;
}

export function getYoutubeChannel(): Promise<YoutubeChannel> {
  return apiFetch<YoutubeChannel>("/youtube/channel");
}

export interface YoutubeChannelSyncResult {
  videosFound: number;
  created: number;
  skipped: number;
}

export function syncYoutubeChannel(
  channelUrl: string,
): Promise<YoutubeChannelSyncResult> {
  return apiFetch<YoutubeChannelSyncResult>("/youtube/channel-sync", {
    method: "POST",
    body: JSON.stringify({ channelUrl }),
  });
}

export interface BulkImportResult {
  queued: number;
  skipped: number;
}

export interface BulkImportStatus {
  total: number;
  ready: number;
  failed: number;
  queued: number;
  processing: number;
}

export function bulkImportYoutubeTranscripts(): Promise<BulkImportResult> {
  return apiFetch<BulkImportResult>("/youtube/bulk-import-transcripts", {
    method: "POST",
  });
}

export function getBulkImportStatus(): Promise<BulkImportStatus> {
  return apiFetch<BulkImportStatus>("/youtube/bulk-import-status");
}

export function cancelBulkImport(): Promise<{ cancelled: number }> {
  return apiFetch<{ cancelled: number }>("/youtube/bulk-import-cancel", {
    method: "POST",
  });
}
