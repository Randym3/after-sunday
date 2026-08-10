import { apiFetch } from "./client";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB — matches backend

export interface UploadProgress {
  /** Bytes transferred so far. */
  transferred: number;
  /** Total file size in bytes. */
  total: number;
  /** Fraction from 0 to 1. */
  percent: number;
  /** Current chunk index being uploaded. */
  chunkIndex: number;
  /** Total number of chunks. */
  totalChunks: number;
}

export interface UploadInitResponse {
  storageKey: string;
  chunkSize: number;
}

/**
 * Called repeatedly during the upload so the UI can show a progress bar.
 * Return `true` to abort the upload early.
 */
type OnProgress = (p: UploadProgress) => boolean | void;

/**
 * Upload a media file to an existing sermon in chunks.
 *
 * 1. POST /sermons/{id}/upload/init  → get storageKey + chunkSize
 * 2. Loop: POST /sermons/{id}/upload/chunk  → one chunk per request
 * 3. POST /sermons/{id}/upload/complete  → mark done
 */
export async function uploadSermonMedia(
  sermonId: string,
  file: File,
  onProgress?: OnProgress,
): Promise<void> {
  // 1. Init
  const body = new FormData();
  body.set("file_name", file.name);
  body.set("file_size", String(file.size));
  body.set("content_type", file.type);

  const init = await apiFetch<UploadInitResponse>(
    `/sermons/${sermonId}/upload/init`,
    {
      method: "POST",
      body,
    },
  );

  const chunkSize = init.chunkSize ?? CHUNK_SIZE;
  const totalChunks = Math.ceil(file.size / chunkSize);

  let transferred = 0;

  // 2. Chunk loop
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);

    const chunkBody = new FormData();
    chunkBody.set("file", blob, file.name);
    chunkBody.set("chunk_index", String(chunkIndex));
    chunkBody.set("storage_key", init.storageKey);

    await apiFetch(`/sermons/${sermonId}/upload/chunk`, {
      method: "POST",
      body: chunkBody,
    });

    transferred += blob.size;

    const progress: UploadProgress = {
      transferred,
      total: file.size,
      percent: transferred / file.size,
      chunkIndex,
      totalChunks,
    };

    if (onProgress?.(progress) === true) {
      // User cancelled.
      return;
    }
  }

  // 3. Complete
  await apiFetch(`/sermons/${sermonId}/upload/complete`, {
    method: "POST",
  });
}
