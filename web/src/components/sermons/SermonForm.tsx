"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  isAcceptedRecordingFile,
  useRecordingFileDrop,
} from "@/components/sermons/useRecordingFileDrop";
import { MediaUploader } from "@/components/sermons/MediaUploader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listMembers } from "@/lib/api/members";
import type { YoutubePreview } from "@/lib/api/youtube";
import { cn } from "@/lib/utils/cn";
import type { Member } from "@/types/member";
import {
  CreateSermonInput,
  Sermon,
  SermonSourceType,
} from "@/types/sermon";

interface SermonFormProps {
  /** Pass a sermon to enter edit mode (prefilled fields, Save button). */
  sermon?: Sermon;
  onSubmit?: (
    values: CreateSermonInput,
    mediaFile: File | null,
  ) => void | Promise<void>;
  upload?: {
    sermonId: string;
    file: File;
  } | null;
  onUploadComplete?: () => void;
  onUploadCancel?: () => void;
  /**
   * Called immediately when a recording file is dropped (or picked via
   * the file browser).  The parent should create the sermon row and
   * start the upload so transcription runs in parallel while the user
   * fills out the form.
   */
  onFileDrop?: (file: File) => void;
  /**
   * Create mode only: the transcript that arrived from automatic
   * transcription.  `undefined` = not transcribing; `null` = failed;
   * a string = the transcript (ready).
   */
  transcribingTranscript?: string | null;
  /**
   * When true, the submit button reads "Save & Continue" instead of
   * "Create Sermon" and the form does not require a file to be attached
   * (the file was already dropped and uploaded).
   */
  isUploadInProgress?: boolean;
  /**
   * Edit mode only: re-run transcription on the existing recording.
   */
  onTranscribe?: () => void | Promise<void>;
}

const sourceOptions: Array<{
  value: SermonSourceType;
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: "upload",
    title: "Upload recording",
    description:
      "Upload an audio or video recording and After Sunday will prepare the transcript.",
    badge: "Recommended",
  },
  {
    value: "youtube",
    title: "YouTube",
    description:
      "Add a sermon from your church's YouTube channel or provide a video URL.",
  },
  {
    value: "transcript",
    title: "Paste transcript",
    description:
      "Use an existing transcript and skip the transcription step.",
  },
];

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function TranscribingIndicator({ className }: { className?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium text-primary",
        className
      )}
    >
      <SparklesIcon className="h-4 w-4" />
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent border-r-primary border-t-primary"
      />
      Transcribing your recording…
    </p>
  );
}

function RotateCwIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function SermonForm({
  sermon,
  onSubmit,
  upload = null,
  onUploadComplete,
  onUploadCancel,
  onFileDrop,
  transcribingTranscript,
  isUploadInProgress = false,
  onTranscribe,
}: SermonFormProps) {
  const isEdit = Boolean(sermon);
  const isTranscribing =
    !isEdit && transcribingTranscript === null;
  const autoTranscript =
    !isEdit && typeof transcribingTranscript === "string"
      ? transcribingTranscript
      : null;

  // Edit mode: transcription in flight — lock the transcript field so
  // staff can't edit it while it's still being generated.
  const isEditTranscribing =
    isEdit &&
    (sermon?.transcriptStatus === "queued" ||
      sermon?.transcriptStatus === "processing");

  const hasExistingMedia =
    isEdit &&
    sermon?.sourceType === "upload" &&
    !!sermon?.mediaStorageKey;
  const canTranscribeAgain =
    hasExistingMedia &&
    (sermon?.transcriptStatus === "ready" ||
      sermon?.transcriptStatus === "failed");
  // Stable for the lifetime of this sermon — the workspace polls the sermon
  // row every couple of seconds while transcribing, and we must NOT re-fetch
  // (and thus remount) the media blob when only the transcript changes.
  const sermonId = sermon?.id;
  const [showSourceEditor, setShowSourceEditor] =
    useState(!hasExistingMedia);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<
    string | null
  >(null);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch uploaded media as a blob URL so <video>/<audio> can play it
  // with auth (plain <video src> can't send a Bearer header). Keyed on the
  // sermon id — not the whole sermon object — so the 2s transcription poll
  // doesn't tear down and refetch the media (which would restart playback).
  useEffect(() => {
    if (!hasExistingMedia || !sermonId) {
      return;
    }

    let cancelled = false;

    import("@/lib/api/client")
      .then(async ({ getAuthToken }) => {
        const token = await getAuthToken();

        if (!token || cancelled) {
          return;
        }

        const API_BASE =
          process.env.NEXT_PUBLIC_API_URL ??
          "http://localhost:8000";

        const response = await fetch(
          `${API_BASE}/sermons/${sermonId}/media`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!response.ok || cancelled) {
          setMediaLoadError(true);
          return;
        }

        const blob = await response.blob();

        if (cancelled) {
          return;
        }

        setMediaBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) {
          setMediaLoadError(true);
        }
      });

    return () => {
      cancelled = true;
      // Revoke blob URL to free memory.
      setMediaBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    };
  }, [hasExistingMedia, sermonId]);

  const [values, setValues] = useState<CreateSermonInput>(() => ({
    title: sermon?.title ?? "",
    preacher: sermon?.preacher ?? "",
    scriptureReference: sermon?.scriptureReference ?? "",
    preachedAt: sermon?.preachedAt ?? "",
    sourceType: (sermon?.sourceType as SermonSourceType) ?? "upload",
    youtubeUrl: sermon?.sourceUrl ?? "",
    transcript: sermon?.transcript ?? "",
  }));

  // True once the user has typed in a transcript field, so their edits
  // (including clearing it) win over the server copy below.
  const [transcriptEdited, setTranscriptEdited] =
    useState(false);

  // The transcript shown in the textarea. Priority:
  //   1. auto-transcript (create flow, transcription finished)
  //   2. the user's own edits
  //   3. the sermon prop (which may arrive later than mount via polling)
  const displayedTranscript: string =
    autoTranscript ??
    (transcriptEdited
      ? (values.transcript ?? "")
      : (values.transcript?.trim() || sermon?.transcript || ""));

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetranscribing, setIsRetranscribing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [preacherOverride, setPreacherOverride] = useState<
    "directory" | "manual" | null
  >(null);

  const normalizedPreacher = (values.preacher ?? "")
    .trim()
    .toLowerCase();

  const preacherInDirectory = members.some(
    (member) =>
      `${member.firstName} ${member.lastName}`
        .trim()
        .toLowerCase() === normalizedPreacher
  );

  // Default to the manual input when editing a preacher who isn't in the
  // directory, so the saved name stays visible instead of showing an empty
  // directory dropdown. The toggle below can still override this.
  const effectivePreacherMode: "directory" | "manual" =
    preacherOverride ??
    (isEdit && normalizedPreacher && !preacherInDirectory
      ? "manual"
      : "directory");

  useEffect(() => {
    let cancelled = false;

    listMembers()
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
      })
      .catch(() => {
        // Directory unavailable (e.g. not logged in) — fall back to
        // the manual guest-preacher input.
      })
      .finally(() => {
        if (!cancelled) setMembersLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const [dragDropNotice, setDragDropNotice] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  // Flashes the title/date fields with lime when auto-filled. Uses an inline
  // background-color (which beats Tailwind's layered `bg-white`) and a
  // timeout to remove it — keyframes can't paint over the utility layer.
  const [flash, setFlash] = useState<{
    title: boolean;
    date: boolean;
  }>({ title: false, date: false });
  const [youtubePreview, setYoutubePreview] = useState<{
    loading: boolean;
    error: string | null;
    data: YoutubePreview | null;
  }>({ loading: false, error: null, data: null });
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the auto-fill/flash against re-entrancy from the input.files
  // assignment firing a second change event for the same file.
  const processedFileRef = useRef<File | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  // When a YouTube URL is pasted, fetch metadata and prefill empty fields.
  // All state updates happen inside the timeout callback (never synchronously
  // in the effect body), so the effect stays a pure subscription.
  useEffect(() => {
    const isYoutube =
      values.sourceType === "youtube" &&
      Boolean(values.youtubeUrl?.trim());
    // Non-youtube sources reset the preview immediately (0ms); youtube URLs
    // debounce the network fetch by 600ms.
    const handle = window.setTimeout(async () => {
      const url = values.youtubeUrl?.trim() ?? "";
      if (values.sourceType !== "youtube" || !url) {
        setYoutubePreview({ loading: false, error: null, data: null });
        return;
      }

      setYoutubePreview((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      try {
        const { previewYoutubeVideo } = await import("@/lib/api/youtube");
        const preview = await previewYoutubeVideo(url);

        setYoutubePreview({ loading: false, error: null, data: preview });

        // Prefill only empty fields; never clobber what the user typed.
        setValues((current) => {
          const next = { ...current };
          if (!next.title?.trim() && preview.title) {
            next.title = preview.title;
          }
          if (!next.preachedAt && preview.uploadDate) {
            next.preachedAt = preview.uploadDate;
          }
          if (
            !next.scriptureReference?.trim() &&
            preview.scriptureReference
          ) {
            next.scriptureReference = preview.scriptureReference;
          }
          return next;
        });

        setFlash({ title: true, date: true });
        window.setTimeout(() => {
          setFlash({ title: false, date: false });
        }, 250);
      } catch {
        setYoutubePreview({
          loading: false,
          error: "Couldn't load that video — check the URL and try again.",
          data: null,
        });
      }
    }, isYoutube ? 600 : 0);

    return () => window.clearTimeout(handle);
  }, [values.sourceType, values.youtubeUrl]);

  function handleFileDropped(file: File) {
    if (!isAcceptedRecordingFile(file)) {
      setDragDropNotice({
        text: "That file type isn't supported. Use an MP3, M4A, WAV, MP4, or WebM recording.",
        tone: "error",
      });
      return;
    }

    setMediaFile(file);

    // Put the dropped file on the actual input too. The browser's native
    // `required` validation checks input.files, not React state, so without
    // this the form would still block submission with "Please select a file".
    if (mediaFileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      mediaFileInputRef.current.files = dataTransfer.files;
    }

    // Guard against re-entrancy: assigning input.files above fires a second
    // `change` event that re-runs this handler. The ref skips the auto-fill on
    // that second run so it can't clear the flash before it paints.
    if (processedFileRef.current !== file) {
      processedFileRef.current = file;

      // Only auto-fill on create — never touch fields in edit mode.
      if (!isEdit) {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const titleFromFile = baseName
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const fillTitle =
          !!titleFromFile && !values.title?.trim();

        const fillDate =
          !values.preachedAt && file.lastModified > 0;

        if (fillTitle || fillDate) {
          setValues((currentValues) => {
            const nextValues: CreateSermonInput = {
              ...currentValues,
              sourceType: "upload",
            };

            if (fillTitle && !nextValues.title?.trim()) {
              nextValues.title = titleFromFile;
            }

            if (fillDate && !nextValues.preachedAt) {
              const fileDate = new Date(file.lastModified);
              const year = fileDate.getFullYear();
              const month = String(fileDate.getMonth() + 1).padStart(2, "0");
              const day = String(fileDate.getDate()).padStart(2, "0");
              nextValues.preachedAt = `${year}-${month}-${day}`;
            }

            return nextValues;
          });
        }

        if (fillTitle || fillDate) {
          if (flashTimeoutRef.current) {
            clearTimeout(flashTimeoutRef.current);
          }

          setFlash({ title: fillTitle, date: fillDate });
          flashTimeoutRef.current = setTimeout(() => {
            setFlash({ title: false, date: false });
          }, 250);

          setDragDropNotice({
            text: `Recording added — ${file.name}. Title and date were prefilled from the file.`,
            tone: "success",
          });
        } else {
          setDragDropNotice({
            text: `Recording added — ${file.name}`,
            tone: "success",
          });
        }
      }
    }

    // Always tell the parent so it creates the sermon + starts upload
    // immediately — the heavy work runs in parallel while the user fills
    // out the form.
    if (onFileDrop) {
      onFileDrop(file);
    }
  }

  const { isDraggingFile } = useRecordingFileDrop({
    onFileDropped: handleFileDropped,
  });

  function updateField<K extends keyof CreateSermonInput>(
    field: K,
    value: CreateSermonInput[K]
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  function selectSource(sourceType: SermonSourceType) {
    setValues((currentValues) => ({
      ...currentValues,
      sourceType,
    }));
  }

  async function handleTranscribeAgain() {
    if (!onTranscribe || isRetranscribing) {
      return;
    }

    setIsRetranscribing(true);
    try {
      await onTranscribe();
    } finally {
      setIsRetranscribing(false);
    }
  }

  function validateSubmission() {
    // If a file was already dropped + uploaded, we don't need to check for
    // a local mediaFile — the upload is already in progress or complete.
    if (isUploadInProgress) {
      return true;
    }

    // In edit mode the file was already uploaded — skip the file check.
    if (!isEdit && values.sourceType === "upload" && !mediaFile) {
      alert("Choose an audio or video recording to upload.");
      return false;
    }

    if (
      values.sourceType === "youtube" &&
      !values.youtubeUrl?.trim()
    ) {
      alert("Enter the YouTube URL for this sermon.");
      return false;
    }

    if (
      values.sourceType === "transcript" &&
      !values.transcript?.trim()
    ) {
      alert("Paste the sermon transcript.");
      return false;
    }

    return true;
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateSubmission()) {
      return;
    }

    const submissionValues: CreateSermonInput = {
      ...values,
      youtubeUrl:
        values.sourceType === "youtube"
          ? values.youtubeUrl?.trim()
          : undefined,
      transcript: displayedTranscript.trim() || undefined,
    };

    try {
      setIsSubmitting(true);

      if (onSubmit) {
        await onSubmit(submissionValues, mediaFile);
        return;
      }

      console.log("Create sermon payload", {
        values: submissionValues,
        mediaFile: mediaFile
          ? {
              name: mediaFile.name,
              type: mediaFile.type,
              size: mediaFile.size,
            }
          : null,
      });

      alert(
        "Sermon source selected successfully. Backend upload and transcription come next."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Sermon details
            </h2>

            <p className="mt-1 text-sm leading-6 text-ink-soft">
              Add the basic information church staff will use to
              identify this sermon.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="title"
                className="block text-sm font-semibold text-ink"
              >
                Sermon title
              </label>

              <input
                id="title"
                value={values.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                style={
                  flash.title
                    ? {
                        backgroundColor: "rgba(52, 211, 153, 0.18)", // mint flash
                        transition: "background-color 200ms ease-out",
                      }
                    : undefined
                }
                className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                placeholder="The Good Shepherd"
                required
              />
            </div>

            <div>
              <label
                htmlFor="preacher"
                className="block text-sm font-semibold text-ink"
              >
                Preacher
              </label>

              {effectivePreacherMode === "directory" &&
              membersLoaded &&
              members.length > 0 ? (
                <select
                  id="preacher"
                  value={values.preacher}
                  onChange={(event) =>
                    updateField("preacher", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                >
                  <option value="">
                    Select a preacher…
                  </option>

                  {members.map((member) => (
                    <option
                      key={member.id}
                      value={`${member.firstName} ${member.lastName}`}
                    >
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="preacher"
                  value={values.preacher}
                  onChange={(event) =>
                    updateField("preacher", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                  placeholder={
                    effectivePreacherMode === "manual"
                      ? "Guest preacher name"
                      : "Pastor John"
                  }
                />
              )}

              <button
                type="button"
                onClick={() =>
                  setPreacherOverride(
                    effectivePreacherMode === "directory"
                      ? "manual"
                      : "directory"
                  )
                }
                className="mt-2 text-xs font-medium text-primary underline underline-offset-2 transition hover:text-ink"
              >
                {effectivePreacherMode === "directory"
                  ? "Not in the directory? Enter a name"
                  : "Choose from directory"}
              </button>
            </div>

            <div>
              <label
                htmlFor="scriptureReference"
                className="block text-sm font-semibold text-ink"
              >
                Scripture reference
              </label>

              <input
                id="scriptureReference"
                value={values.scriptureReference}
                onChange={(event) =>
                  updateField(
                    "scriptureReference",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                placeholder="Psalm 23"
              />
            </div>

            <div>
              <label
                htmlFor="preachedAt"
                className="block text-sm font-semibold text-ink"
              >
                Date preached
              </label>

              <input
                id="preachedAt"
                type="date"
                value={values.preachedAt}
                onChange={(event) =>
                  updateField("preachedAt", event.target.value)
                }
                style={
                  flash.date
                    ? {
                        backgroundColor: "rgba(52, 211, 153, 0.18)", // mint flash
                        transition: "background-color 200ms ease-out",
                      }
                    : undefined
                }
                className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              />
            </div>
          </div>
        </div>
      </Card>

      {hasExistingMedia && !showSourceEditor ? (
        <Card>
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-ink">
                Uploaded recording
              </h2>

              {canTranscribeAgain ? (
                <button
                  type="button"
                  onClick={handleTranscribeAgain}
                  disabled={isRetranscribing}
                  className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-panel-2 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCwIcon className="h-3.5 w-3.5" />
                  {isRetranscribing
                    ? "Transcribing…"
                    : "Transcribe again"}
                </button>
              ) : null}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left column — file info + preview */}
              <div className="space-y-5">
                {/* File info — compact row */}
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2h5l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="11,2 11,7 16,7"/></svg>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {sermon?.mediaFileName ?? "Recording"}
                    </p>

                    <p className="text-xs text-ink-soft">
                      {sermon?.mediaSizeBytes
                        ? `${(sermon.mediaSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                        : ""}
                      {sermon?.mediaContentType
                        ? ` \u2022 ${sermon.mediaContentType}`
                        : ""}
                    </p>
                  </div>
                </div>

                {/* Video preview — YouTube-style thumbnail, click to play */}
                {mediaBlobUrl &&
                sermon?.mediaContentType?.startsWith("video/") ? (
                  <div className="overflow-hidden rounded-xl bg-stone-900">
                    {videoPlaying ? (
                      <video
                        ref={videoRef}
                        controls
                        autoPlay
                        className="aspect-video w-full"
                        src={mediaBlobUrl}
                        onEnded={() => setVideoPlaying(false)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVideoPlaying(true)}
                        className="group relative flex aspect-video w-full items-center justify-center"
                        aria-label="Play recording"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 shadow-lg transition group-hover:scale-105 group-hover:bg-black/70">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <polygon points="8,5 19,12 8,19" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </div>
                ) : mediaBlobUrl &&
                  sermon?.mediaContentType?.startsWith("audio/") ? (
                  <audio controls className="w-full" src={mediaBlobUrl} />
                ) : mediaLoadError ? (
                  <div className="flex h-12 items-center justify-center rounded-2xl bg-panel-2 text-xs text-ink-soft">
                    Preview unavailable
                  </div>
                ) : (
                  <div className="flex h-12 items-center justify-center rounded-2xl bg-panel-2 text-xs text-ink-soft">
                    Loading preview…
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowSourceEditor(true)}
                  className="text-sm font-medium text-primary underline underline-offset-2 transition hover:text-ink"
                >
                  Change source
                </button>
              </div>

              {/* Right column — transcript, editable alongside the recording */}
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="transcript"
                    className="text-sm font-semibold text-ink"
                  >
                    Transcript
                  </label>

                  <span className="text-xs text-ink-soft">
                    {
                      displayedTranscript
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean).length
                    }{" "}
                    words
                  </span>
                </div>

                <textarea
                  id="transcript"
                  value={displayedTranscript}
                  onChange={(event) => {
                    setTranscriptEdited(true);
                    updateField("transcript", event.target.value);
                  }}
                  readOnly={isEditTranscribing}
                  className={cn(
                    "mt-2 min-h-64 w-full flex-1 resize-y rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-primary",
                    isEditTranscribing &&
                      "cursor-not-allowed bg-panel text-ink-soft"
                  )}
                  placeholder="No transcript yet — it will appear here after transcription."
                />

                {isEditTranscribing ? (
                  <TranscribingIndicator className="mt-2" />
                ) : (
                  <p className="mt-2 text-xs leading-5 text-ink-soft">
                    Editable transcript. The AI Draft tab uses this text
                    as the source for generating follow-up content.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      ) : (
      <Card>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Sermon source
              </h2>

              <p className="mt-1 text-sm leading-6 text-ink-soft">
                Choose how you would like to add the sermon to After
                Sunday.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSourceEditor(false)}
              className="-mr-1 rounded-full p-1 text-ink-soft transition hover:bg-panel-2 hover:text-ink"
              aria-label="Close source editor"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="14" y2="14" />
                <line x1="14" y1="4" x2="4" y2="14" />
              </svg>
            </button>
          </div>

          <fieldset>
            <legend className="sr-only">
              Choose a sermon source
            </legend>

            <div className="grid gap-4 lg:grid-cols-3">
              {sourceOptions.map((option) => {
                const isSelected =
                  values.sourceType === option.value;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      "relative cursor-pointer rounded-3xl border p-5 transition",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-edge bg-panel-2 hover:border-edge"
                    )}
                  >
                    <input
                      type="radio"
                      name="sourceType"
                      value={option.value}
                      checked={isSelected}
                      onChange={() =>
                        selectSource(option.value)
                      }
                      className="sr-only"
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">
                          {option.title}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-ink-soft">
                          {option.description}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 rounded-full border",
                          isSelected
                            ? "border-[5px] border-primary"
                            : "border-edge"
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    {option.badge ? (
                      <span className="mt-4 inline-flex rounded-full bg-mint/15 px-3 py-1 text-xs font-medium text-mint">
                        {option.badge}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {values.sourceType === "upload" ? (
            <div>
              <label
                htmlFor="mediaFile"
                className="block text-sm font-semibold text-ink"
              >
                Audio or video recording
              </label>

              <label
                htmlFor="mediaFile"
                className="mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-edge bg-panel-2 px-6 py-8 text-center transition hover:border-primary hover:bg-primary/5"
              >
                <span className="text-sm font-semibold text-ink">
                  Choose a sermon recording
                </span>

                <span className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
                  Select an MP3, M4A, WAV, MP4, or WebM file.
                  Transcription starts immediately after upload.
                </span>

                {mediaFile ? (
                  <span className="mt-4 rounded-2xl bg-panel-2 px-4 py-2 text-sm font-medium text-ink">
                    {mediaFile.name}
                  </span>
                ) : null}
              </label>

              {upload ? (
                <MediaUploader
                  sermonId={upload.sermonId}
                  file={upload.file}
                  onComplete={() => onUploadComplete?.()}
                  onCancel={() => onUploadCancel?.()}
                  note="Keep this page open while your recording uploads. Files are stored on your After Sunday server — see Settings → Storage for the location."
                />
              ) : null}

              <input
                id="mediaFile"
                ref={mediaFileInputRef}
                type="file"
                accept=".mp3,.m4a,.wav,.mp4,.webm,audio/*,video/*"
                onChange={(event) => {
                  const pickedFile =
                    event.target.files?.[0] ?? null;
                  setMediaFile(pickedFile);
                  setDragDropNotice(null);

                  // Same auto-fill + immediate-upload as the drop path.
                  if (pickedFile) {
                    handleFileDropped(pickedFile);
                  }
                }}
                className="sr-only"
                required={!isUploadInProgress && values.sourceType === "upload"}
              />

              <p className="mt-2 text-xs leading-5 text-ink-soft">
                Tip: drag a recording anywhere on this page.
                Upload and transcription start immediately so
                you can fill out the rest while it runs.
              </p>

              {dragDropNotice ? (
                <p
                  role="status"
                  className={cn(
                    "mt-2 text-xs font-medium leading-5",
                    dragDropNotice.tone === "success"
                      ? "text-mint"
                      : "text-red-400"
                  )}
                >
                  {dragDropNotice.text}
                </p>
              ) : null}
            </div>
          ) : null}

          {values.sourceType === "youtube" ? (
            <div>
              <label
                htmlFor="youtubeUrl"
                className="block text-sm font-semibold text-ink"
              >
                YouTube video URL
              </label>

              <input
                id="youtubeUrl"
                type="url"
                value={values.youtubeUrl ?? ""}
                onChange={(event) =>
                  updateField("youtubeUrl", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                placeholder="https://www.youtube.com/watch?v=..."
                required={values.sourceType === "youtube"}
              />

              <p className="mt-2 text-xs leading-5 text-ink-soft">
                We&apos;ll pull the title and date from the video, then fetch
                the transcript automatically.
              </p>

              {youtubePreview.loading ? (
                <p
                  role="status"
                  className="mt-3 text-xs font-medium text-primary"
                >
                  Loading video details…
                </p>
              ) : null}

              {youtubePreview.error ? (
                <p
                  role="status"
                  className="mt-3 text-xs font-medium text-red-400"
                >
                  {youtubePreview.error}
                </p>
              ) : null}

              {youtubePreview.data ? (
                <div className="mt-4 flex gap-4 rounded-2xl border border-edge bg-panel-2 p-4">
                  {youtubePreview.data.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={youtubePreview.data.thumbnailUrl}
                      alt=""
                      className="h-20 w-32 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {youtubePreview.data.title}
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {[
                        youtubePreview.data.channelName,
                        youtubePreview.data.uploadDate,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {youtubePreview.data.description ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-soft">
                        {youtubePreview.data.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
<div className="border-t border-edge pt-6">
  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <label
      htmlFor="transcript"
      className="block text-sm font-semibold text-ink"
    >
      {values.sourceType === "transcript"
        ? "Sermon transcript"
        : "Already have a transcript?"}
    </label>

    {values.sourceType !== "transcript" ? (
      <span className="text-xs font-medium text-ink-soft">
        Optional
      </span>
    ) : null}
  </div>

  <p className="mt-2 text-sm leading-6 text-ink-soft">
    {values.sourceType === "transcript"
      ? "Paste the completed sermon transcript below."
      : isTranscribing || isEditTranscribing
        ? "Your recording is being transcribed now. The text will appear here automatically."
        : "Paste an existing transcript to skip automatic transcription. You can review and edit it after creating the sermon."}
  </p>

  {isTranscribing ? (
    <div className="relative mt-3">
      <div className="min-h-64 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm leading-6 text-ink-soft outline-none" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl bg-panel/90 px-5 py-3 shadow-sm backdrop-blur-sm">
          <svg
            className="h-5 w-5 animate-spin text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium text-primary">
            Transcribing your recording…
          </span>
        </div>
      </div>
    </div>
  ) : (
    <>
      <textarea
        id="transcript"
        value={displayedTranscript}
        onChange={(event) => {
          setTranscriptEdited(true);
          // When the user edits the auto-transcript, write it into values
          // (which may have been autoTranscript-derived until now).
          updateField("transcript", event.target.value);
        }}
        readOnly={isEditTranscribing}
        className={cn(
          "mt-3 min-h-64 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-primary",
          autoTranscript
            ? "border-primary ring-1 ring-mint/40"
            : "",
          isEditTranscribing &&
            "cursor-not-allowed bg-panel text-ink-soft",
        )}
        placeholder={
          values.sourceType === "transcript"
            ? "Paste the sermon transcript here…"
            : "Optional: paste an existing transcript here…"
        }
        required={values.sourceType === "transcript"}
      />

      {isEditTranscribing ? (
        <TranscribingIndicator className="mt-3" />
      ) : null}
    </>
  )}

  <div className="mt-2 flex flex-col gap-1 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
    <p>
      {autoTranscript
        ? "Your recording has been transcribed. Review and edit as needed."
        : isTranscribing || isEditTranscribing
          ? "Transcription is running — it will appear above when ready."
          : values.sourceType === "transcript"
            ? "A transcript is required for this source."
            : "When provided, After Sunday will use this transcript instead of creating a new one."}
    </p>

    <p className="shrink-0">
      {
        displayedTranscript
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      }{" "}
      words
    </p>
  </div>

  {autoTranscript ? (
    <p
      role="status"
      className="mt-2 text-xs font-medium text-mint"
    >
      Transcription complete! You can view and edit the full
      text above, then explore the AI Draft in the workspace.
    </p>
  ) : null}
</div>

        </div>
      </Card>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={isEdit ? `/app/sermons/${sermon!.id}` : "/app/sermons"}
          className="inline-flex items-center justify-center rounded-full border border-edge bg-panel-2 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-panel"
        >
          Cancel
        </Link>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "Saving..."
              : isUploadInProgress
                ? "Saving..."
                : "Creating..."
            : isEdit
              ? "Save Changes"
              : isUploadInProgress
                ? "Save & Continue"
                : "Create Sermon"}
        </Button>
      </div>
      </form>

      {isDraggingFile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
        >
          <div
            role="status"
            className="w-full max-w-md rounded-3xl border-2 border-dashed border-primary/60 bg-panel p-10 text-center shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <span
                className="h-5 w-5 rotate-45 rounded-[4px] bg-ink"
                aria-hidden="true"
              />
            </div>

            <p className="mt-6 text-xl font-semibold text-ink">
              Drop to add your recording
            </p>

            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Release the file anywhere on this page and it will be
              attached as the sermon recording.
            </p>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
              MP3 · M4A · WAV · MP4 · WebM
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
