"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import {
  CreateSermonInput,
  SermonSourceType,
} from "@/types/sermon";

interface SermonFormProps {
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

export function SermonForm({ onSubmit }: SermonFormProps) {
  const [values, setValues] = useState<CreateSermonInput>({
    title: "",
    preacher: "",
    scriptureReference: "",
    preachedAt: "",
    sourceType: "upload",
    youtubeUrl: "",
    transcript: "",
  });

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (values.sourceType === "upload" && !mediaFile) {
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

              <input
                id="preacher"
                value={values.preacher}
                onChange={(event) =>
                  updateField("preacher", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
                placeholder="Pastor John"
              />
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

      <Card>
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-[#102015]">
              Sermon source
            </h2>

            <p className="mt-1 text-sm leading-6 text-stone-600">
              Choose how you would like to add the sermon to After
              Sunday.
            </p>
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
                type="file"
                accept=".mp3,.m4a,.wav,.mp4,.webm,audio/*,video/*"
                onChange={(event) =>
                  setMediaFile(event.target.files?.[0] ?? null)
                }
                className="sr-only"
                required={values.sourceType === "upload"}
              />

              <p className="mt-2 text-xs leading-5 text-stone-500">
                The file is only stored in browser state for now.
                Direct storage upload will be added with the API.
              </p>
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

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary">
          Cancel
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Sermon"}
        </Button>
      </div>
    </form>
  );
}