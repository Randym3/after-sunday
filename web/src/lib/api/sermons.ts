import { apiFetch } from "@/lib/api/client";
import type { CreateSermonInput, Sermon } from "@/types/sermon";

export function createSermon(
  input: CreateSermonInput
): Promise<Sermon> {
  return apiFetch<Sermon>("/sermons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSermons(): Promise<Sermon[]> {
  return apiFetch<Sermon[]>("/sermons");
}

export function getSermon(sermonId: string): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}`);
}

export function updateSermon(
  sermonId: string,
  patch: Partial<
    Pick<
      Sermon,
      "title" | "preacher" | "scriptureReference" | "preachedAt"
    >
  >
): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function updateTranscript(
  sermonId: string,
  transcript: string
): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}/transcript`, {
    method: "PATCH",
    body: JSON.stringify({ transcript }),
  });
}
