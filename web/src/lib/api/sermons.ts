import { apiFetch } from "@/lib/api/client";
import type {
  AiDraftStatus,
  CreateSermonInput,
  EmailStatus,
  Sermon,
  SermonSourceType,
  TranscriptionStatus,
} from "@/types/sermon";

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

export interface SermonUpdate {
  title?: string;
  preacher?: string | null;
  scriptureReference?: string | null;
  preachedAt?: string | null;
  sourceUrl?: string | null;
  mediaFileName?: string | null;
  sourceType?: SermonSourceType;
  transcript?: string | null;
  transcriptStatus?: TranscriptionStatus | null;
  followUpSubject?: string | null;
  followUpBody?: string | null;
  aiDraftStatus?: AiDraftStatus | null;
  emailStatus?: EmailStatus | null;
}

export function updateSermon(
  sermonId: string,
  patch: SermonUpdate
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

export function transcribeSermon(sermonId: string): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}/transcribe`, {
    method: "POST",
  });
}

export function generateFollowUp(
  sermonId: string
): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}/follow-up/generate`, {
    method: "POST",
  });
}

export interface TestEmailInput {
  email?: string;
  memberId?: string;
}

export function sendTestEmail(
  sermonId: string,
  input: TestEmailInput,
): Promise<{ message: string; email: string }> {
  return apiFetch<{ message: string; email: string }>(
    `/sermons/${sermonId}/test-email`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function deleteSermon(sermonId: string): Promise<Sermon> {
  return apiFetch<Sermon>(`/sermons/${sermonId}`, {
    method: "DELETE",
  });
}

export function bulkDeleteSermons(ids: string[]): Promise<{deleted: number}> {
  return apiFetch<{deleted: number}>("/sermons/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ids}),
  });
}
