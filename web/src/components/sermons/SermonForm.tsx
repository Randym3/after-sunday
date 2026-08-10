"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  isAcceptedRecordingFile,
  useRecordingFileDrop,
} from "@/components/sermons/useRecordingFileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { listMembers } from "@/lib/api/members";
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
    mediaFile: File | null
  ) => void | Promise<void>;
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
      "Add a sermon from your church’s YouTube channel or provide a video URL.",
  },
  {
    value: "transcript",
    title: "Paste transcript",
    description:
      "Use an existing transcript and skip the transcription step.",
  },
];

export function SermonForm({ sermon, onSubmit }: SermonFormProps) {
  const isEdit = Boolean(sermon);
  const hasExistingMedia =
    isEdit &&
    sermon?.sourceType === "upload" &&
    !!sermon?.mediaStorageKey;
  const [showSourceEditor, setShowSourceEditor] =
    useState(!hasExistingMedia);
  const [mediaBlobUrl, setMediaBlobUrl] = useState<
    string | null
  >(null);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch uploaded media as a blob URL so <video>/<audio> can play it
  // with auth (plain <video src> can't send a Bearer header).
  useEffect(() => {
    if (!hasExistingMedia || !sermon) {
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
          `${API_BASE}/sermons/${sermon.id}/media`,
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
  }, [hasExistingMedia, sermon]);

  const [values, setValues] = useState<CreateSermonInput>(() => ({
    title: sermon?.title ?? "",
    preacher: sermon?.preacher ?? "",
    scriptureReference: sermon?.scriptureReference ?? "",
    preachedAt: sermon?.preachedAt ?? "",
    sourceType: (sermon?.sourceType as SermonSourceType) ?? "upload",
    youtubeUrl: sermon?.sourceUrl ?? "",
    transcript: sermon?.transcript ?? "",
  }));

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [preacherMode, setPreacherMode] = useState<
    "directory" | "manual"
  >("directory");

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
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  function handleFileDropped(file: File) {
    if (!isAcceptedRecordingFile(file)) {
      setDragDropNotice({
        text: "That file type isn’t supported. Use an MP3, M4A, WAV, MP4, or WebM recording.",
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

    setValues((currentValues) => ({
      ...currentValues,
      sourceType: "upload",
    }));
    setDragDropNotice({
      text: `Recording added — ${file.name}`,
      tone: "success",
    });
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

  function validateSubmission() {
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
      transcript: values.transcript?.trim() || undefined,
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
            <h2 className="text-lg font-semibold text-[#102015]">
              Sermon details
            </h2>

            <p className="mt-1 text-sm leading-6 text-stone-600">
              Add the basic information church staff will use to
              identify this sermon.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="title"
                className="block text-sm font-medium text-stone-800"
              >
                Sermon title
              </label>

              <input
                id="title"
                value={values.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
                placeholder="The Good Shepherd"
                required
              />
            </div>

            <div>
              <label
                htmlFor="preacher"
                className="block text-sm font-medium text-stone-800"
              >
                Preacher
              </label>

              {preacherMode === "directory" &&
              membersLoaded &&
              members.length > 0 ? (
                <select
                  id="preacher"
                  value={values.preacher}
                  onChange={(event) =>
                    updateField("preacher", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
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
                  className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
                  placeholder={
                    preacherMode === "manual"
                      ? "Guest preacher name"
                      : "Pastor John"
                  }
                />
              )}

              <button
                type="button"
                onClick={() =>
                  setPreacherMode((mode) =>
                    mode === "directory" ? "manual" : "directory"
                  )
                }
                className="mt-2 text-xs font-medium text-[#012f11] underline underline-offset-2 transition hover:text-[#102015]"
              >
                {preacherMode === "directory"
                  ? "Not in the directory? Enter a name"
                  : "Choose from directory"}
              </button>
            </div>

            <div>
              <label
                htmlFor="scriptureReference"
                className="block text-sm font-medium text-stone-800"
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
                className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
                placeholder="Psalm 23"
              />
            </div>

            <div>
              <label
                htmlFor="preachedAt"
                className="block text-sm font-medium text-stone-800"
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
                className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
              />
            </div>
          </div>
        </div>
      </Card>

      {hasExistingMedia && !showSourceEditor ? (
        <Card>
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[#102015]">
                Uploaded recording
              </h2>
            </div>

            {/* File info — compact row */}
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2h5l5 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><polyline points="11,2 11,7 16,7"/></svg>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">
                  {sermon?.mediaFileName ?? "Recording"}
                </p>

                <p className="text-xs text-stone-500">
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
              <div className="max-w-sm overflow-hidden rounded-xl bg-stone-900">
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
              <div className="flex h-12 items-center justify-center rounded-2xl bg-stone-100 text-xs text-stone-400">
                Preview unavailable
              </div>
            ) : (
              <div className="flex h-12 items-center justify-center rounded-2xl bg-stone-100 text-xs text-stone-400">
                Loading preview\u2026
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowSourceEditor(true)}
              className="text-sm font-medium text-[#012f11] underline underline-offset-2 transition hover:text-[#102015]"
            >
              Change source
            </button>
          </div>
        </Card>
      ) : (
      <Card>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#102015]">
                Sermon source
              </h2>

              <p className="mt-1 text-sm leading-6 text-stone-600">
                Choose how you would like to add the sermon to After
                Sunday.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSourceEditor(false)}
              className="-mr-1 rounded-full p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
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
                        ? "border-[#012f11] bg-green-50 shadow-sm"
                        : "border-[#ddd8c8] bg-white hover:border-stone-400"
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
                        <p className="font-semibold text-[#102015]">
                          {option.title}
                        </p>

                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {option.description}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 rounded-full border",
                          isSelected
                            ? "border-[5px] border-[#012f11]"
                            : "border-stone-400"
                        )}
                        aria-hidden="true"
                      />
                    </div>

                    {option.badge ? (
                      <span className="mt-4 inline-flex rounded-full bg-lime-100 px-3 py-1 text-xs font-medium text-green-950">
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
                className="block text-sm font-medium text-stone-800"
              >
                Audio or video recording
              </label>

              <label
                htmlFor="mediaFile"
                className="mt-2 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[#c9c3b2] bg-white px-6 py-8 text-center transition hover:border-[#012f11] hover:bg-green-50/40"
              >
                <span className="text-sm font-semibold text-[#102015]">
                  Choose a sermon recording
                </span>

                <span className="mt-2 max-w-md text-sm leading-6 text-stone-600">
                  Select an MP3, M4A, WAV, MP4, or WebM file.
                  After Sunday will transcribe it once the backend is
                  connected.
                </span>

                {mediaFile ? (
                  <span className="mt-4 rounded-2xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-800">
                    {mediaFile.name}
                  </span>
                ) : null}
              </label>

              <input
                id="mediaFile"
                ref={mediaFileInputRef}
                type="file"
                accept=".mp3,.m4a,.wav,.mp4,.webm,audio/*,video/*"
                onChange={(event) => {
                  setMediaFile(event.target.files?.[0] ?? null);
                  setDragDropNotice(null);
                }}
                className="sr-only"
                required={values.sourceType === "upload"}
              />

              <p className="mt-2 text-xs leading-5 text-stone-500">
                Tip: you can also drag an audio or video recording
                anywhere on this page to add it. The file is only
                stored in browser state for now; direct storage
                upload will be added with the API.
              </p>

              {dragDropNotice ? (
                <p
                  role="status"
                  className={cn(
                    "mt-2 text-xs font-medium leading-5",
                    dragDropNotice.tone === "success"
                      ? "text-green-800"
                      : "text-red-700"
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
                className="block text-sm font-medium text-stone-800"
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
                className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
                placeholder="https://www.youtube.com/watch?v=..."
                required={values.sourceType === "youtube"}
              />

              <p className="mt-2 text-xs leading-5 text-stone-500">
                For now, this records the sermon source. YouTube
                caption importing and connected channels will be
                implemented later.
              </p>
            </div>
          ) : null}
<div className="border-t border-[#ddd8c8] pt-6">
  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <label
      htmlFor="transcript"
      className="block text-sm font-medium text-stone-800"
    >
      {values.sourceType === "transcript"
        ? "Sermon transcript"
        : "Already have a transcript?"}
    </label>

    {values.sourceType !== "transcript" ? (
      <span className="text-xs font-medium text-stone-500">
        Optional
      </span>
    ) : null}
  </div>

  <p className="mt-2 text-sm leading-6 text-stone-600">
    {values.sourceType === "transcript"
      ? "Paste the completed sermon transcript below."
      : "Paste an existing transcript to skip automatic transcription. You can review and edit it after creating the sermon."}
  </p>

  <textarea
    id="transcript"
    value={values.transcript ?? ""}
    onChange={(event) =>
      updateField("transcript", event.target.value)
    }
    className="mt-3 min-h-64 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#012f11]"
    placeholder={
      values.sourceType === "transcript"
        ? "Paste the sermon transcript here..."
        : "Optional: paste an existing transcript here..."
    }
    required={values.sourceType === "transcript"}
  />

  <div className="mt-2 flex flex-col gap-1 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
    <p>
      {values.sourceType === "transcript"
        ? "A transcript is required for this source."
        : "When provided, After Sunday will use this transcript instead of creating a new one."}
    </p>

    <p className="shrink-0">
      {
        (values.transcript ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      }{" "}
      words
    </p>
  </div>
</div>

        </div>
      </Card>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={isEdit ? `/app/sermons/${sermon!.id}` : "/app/sermons"}
          className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-[#fffdf7] px-5 py-2.5 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
        >
          Cancel
        </Link>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "Saving..."
              : "Creating..."
            : isEdit
              ? "Save Changes"
              : "Create Sermon"}
        </Button>
      </div>
      </form>

      {isDraggingFile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#012f11]/95 p-6"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
        >
          <div
            role="status"
            className="w-full max-w-md rounded-3xl border-2 border-dashed border-lime-300/70 bg-[#fffdf7] p-10 text-center shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#012f11]">
              <span
                className="h-5 w-5 rotate-45 rounded-[4px] bg-lime-300"
                aria-hidden="true"
              />
            </div>

            <p className="mt-6 text-xl font-semibold text-[#102015]">
              Drop to add your recording
            </p>

            <p className="mt-2 text-sm leading-6 text-stone-600">
              Release the file anywhere on this page and it will be
              attached as the sermon recording.
            </p>

            <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              MP3 · M4A · WAV · MP4 · WebM
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}