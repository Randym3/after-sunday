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
