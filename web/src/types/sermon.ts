export type TranscriptStatus = "missing" | "ready" | "processing" | "failed";

export type AiDraftStatus = "not_started" | "draft_ready" | "approved";

export type EmailStatus = "not_started" | "draft" | "sent";

export interface Sermon {
  id: string;
  title: string;
  preacher?: string | null;
  scriptureReference?: string | null;
  preachedAt?: string | null;
  sermonLink?: string | null;
  transcript?: string | null;
  followUpDraft?: string | null;
  transcriptStatus: TranscriptStatus;
  aiDraftStatus: AiDraftStatus;
  emailStatus: EmailStatus;
}

export interface CreateSermonInput {
  title: string;
  preacher?: string;
  scriptureReference?: string;
  preachedAt?: string;
  sermonLink?: string;
  transcript: string;
}