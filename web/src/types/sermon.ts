export type SermonSourceType = "upload" | "youtube" | "transcript";

export type TranscriptionStatus =
  | "not_started"
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export type AiDraftStatus =
  | "not_started"
  | "generating"
  | "draft_ready"
  | "approved";

export type EmailStatus = "not_started" | "draft" | "ready" | "sent";

export interface Sermon {
  id: string;
  title: string;
  preacher?: string | null;
  scriptureReference?: string | null;
  preachedAt?: string | null;

  sourceType: SermonSourceType;
  sourceUrl?: string | null;  mediaFileName?: string | null;
  mediaStorageKey?: string | null;
  mediaSizeBytes?: number | null;
  mediaContentType?: string | null;
  transcript?: string | null;
  transcriptStatus: TranscriptionStatus;
  transcriptError?: string | null;
  followUpSubject?: string | null;
  followUpBody?: string | null;

  aiDraftStatus: AiDraftStatus;
  emailStatus: EmailStatus;
}

export interface CreateSermonInput {
  title: string;
  preacher?: string;
  scriptureReference?: string;
  preachedAt?: string;

  sourceType: SermonSourceType;
  youtubeUrl?: string;
  transcript?: string;
}