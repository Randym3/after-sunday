"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { SermonForm } from "@/components/sermons/SermonForm";
import { createSermon, updateSermon } from "@/lib/api/sermons";
import { Sermon } from "@/types/sermon";
import { CreateSermonInput } from "@/types/sermon";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

type Flow =
  | { stage: "form" }
  | { stage: "uploading"; sermonId: string; file: File }
  | {
      stage: "transcribing";
      sermonId: string;
      transcript: string | null;
    };

export function CreateSermonFlow() {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>({ stage: "form" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startTranscriptionPolling = useCallback((sermonId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const { getSermon } = await import("@/lib/api/sermons");
        const sermon: Sermon = await getSermon(sermonId);

        if (sermon.transcriptStatus === "ready" && sermon.transcript) {
          if (pollRef.current) clearInterval(pollRef.current);
          setFlow({
            stage: "transcribing",
            sermonId,
            transcript: sermon.transcript,
          });
        } else if (sermon.transcriptStatus === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setFlow({
            stage: "transcribing",
            sermonId,
            transcript: null,
          });
        }
      } catch {
        // API not available yet — keep polling.
      }
    }, 2000);
  }, []);

  /**
   * Called by SermonForm the moment a recording file is dropped (or picked).
   * Creates the sermon row immediately and starts the upload so transcription
   * runs in parallel while the user fills out the rest of the form.
   */
  async function handleFileDrop(file: File) {
    try {
      // Derive a working title from the filename (same logic as auto-fill).
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const titleFromFile = baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

      const sermon = await createSermon({
        title: titleFromFile || "Untitled Sermon",
        sourceType: "upload",
      });

      setFlow({ stage: "uploading", sermonId: sermon.id, file });
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  /** Called when the form is submitted with details. */
  async function handleSaveDetails(values: CreateSermonInput) {
    if (flow.stage !== "form") {
      // There's already a sermon row — update it and navigate.
      try {
        await updateSermon(flow.sermonId, values);
        router.push(`/app/sermons/${flow.sermonId}`);
      } catch (error) {
        alert(errorMessage(error));
      }
      return;
    }

    // No file was dropped — create a new sermon (non-upload source).
    try {
      const sermon = await createSermon(values);
      router.push(`/app/sermons/${sermon.id}`);
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  function handleUploadCancel() {
    setFlow({ stage: "form" });
  }

  return (
    <SermonForm
      onSubmit={handleSaveDetails}
      onFileDrop={handleFileDrop}
      upload={flow.stage === "uploading" ? flow : null}
      onUploadComplete={() => {
        if (flow.stage === "uploading") {
          setFlow({
            stage: "transcribing",
            sermonId: flow.sermonId,
            transcript: null,
          });
          startTranscriptionPolling(flow.sermonId);
        }
      }}
      onUploadCancel={handleUploadCancel}
      transcribingTranscript={
        flow.stage === "transcribing" ? flow.transcript : undefined
      }
      isUploadInProgress={flow.stage !== "form"}
    />
  );
}
