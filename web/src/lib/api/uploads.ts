import { apiFetch, getAuthToken } from "./client";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB — matches backend
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

function responseError(responseText: string, status: number): Error {
  try {
    const body = JSON.parse(responseText) as {
      detail?: string | Array<{ msg?: string }>;
    };
    const detail = body.detail;

    if (typeof detail === "string") {
      return new Error(detail);
    }

    if (Array.isArray(detail)) {
      return new Error(
        detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join("; ") || `Request failed (${status})`,
      );
    }
  } catch {
    // Keep the generic status message for non-JSON responses.
  }

  return new Error(`Request failed (${status})`);
}

/**
 * Upload one chunk with XMLHttpRequest so the browser exposes byte-level
 * progress while the request is in flight. fetch() only reports progress
 * after the entire chunk has finished.
 */
function uploadChunk(
  sermonId: string,
  storageKey: string,
  fileName: string,
  chunk: Blob,
  chunkIndex: number,
  totalChunks: number,
  transferred: number,
  total: number,
  onProgress?: OnProgress,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let cancelled = false;

    xhr.open(
      "POST",
      `${API_BASE_URL}/sermons/${sermonId}/upload/chunk`,
    );

    void getAuthToken().then((token) => {
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      const body = new FormData();
      body.set("file", chunk, fileName);
      body.set("chunk_index", String(chunkIndex));
      body.set("storage_key", storageKey);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        const nextProgress: UploadProgress = {
          transferred: transferred + event.loaded,
          total,
          percent: (transferred + event.loaded) / total,
          chunkIndex,
          totalChunks,
        };

        if (onProgress?.(nextProgress) === true) {
          cancelled = true;
          xhr.abort();
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          reject(responseError(xhr.responseText, xhr.status));
        }
      };

      xhr.onerror = () => reject(new Error("Upload request failed"));
      xhr.onabort = () => {
        if (cancelled) {
          resolve(false);
        } else {
          reject(new Error("Upload request was interrupted"));
        }
      };

      xhr.send(body);
    }).catch(reject);
  });
}

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

  onProgress?.({
    transferred: 0,
    total: file.size,
    percent: 0,
    chunkIndex: 0,
    totalChunks,
  });

  // 2. Chunk loop
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    const completed = await uploadChunk(
      sermonId,
      init.storageKey,
      file.name,
      blob,
      chunkIndex,
      totalChunks,
      transferred,
      file.size,
      onProgress,
    );

    if (!completed) {
      return;
    }

    transferred += blob.size;

    // Some browsers do not emit a final upload progress event.
    if (
      onProgress?.({
        transferred,
        total: file.size,
        percent: transferred / file.size,
        chunkIndex,
        totalChunks,
      }) === true
    ) {
      return;
    }
  }

  // 3. Complete
  await apiFetch(`/sermons/${sermonId}/upload/complete`, {
    method: "POST",
  });
}
