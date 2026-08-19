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
  sourceUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubeThumbnailUrl?: string | null;
  youtubeFetchedAt?: string | null;
  mediaFileName?: string | null;
  mediaStorageKey?: string | null;
  mediaSizeBytes?: number | null;
  mediaContentType?: string | null;
  transcript?: string | null;
  transcriptStatus: TranscriptionStatus;
  transcriptError?: string | null;
  followUpSubject?: string | null;
  followUpBody?: string | null;

  aiDraftStatus: AiDraftStatus;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiGenerationStatus?: "idle" | "queued" | "processing" | "failed" | "completed";
  aiGenerationTotalChunks?: number | null;
  aiGenerationCompletedChunks?: number | null;
  aiGenerationError?: string | null;
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