"use client";

import { useRouter } from "next/navigation";

import { SermonForm } from "@/components/sermons/SermonForm";
import {
  CreateSermonInput,
  Sermon,
  TranscriptionStatus,
} from "@/types/sermon";

const SERMON_STORAGE_KEY = "after-sunday:demo-sermon";

export function CreateSermonFlow() {
  const router = useRouter();

  async function handleCreateSermon(
    values: CreateSermonInput,
    mediaFile: File | null
  ) {
    const hasTranscript = Boolean(values.transcript?.trim());

    let transcriptStatus: TranscriptionStatus;

    if (hasTranscript) {
      transcriptStatus = "ready";
    } else if (values.sourceType === "youtube") {
      transcriptStatus = "queued";
    } else if (values.sourceType === "upload") {
      transcriptStatus = "processing";
    } else {
      transcriptStatus = "not_started";
    }

    const sermon: Sermon = {
      id: "demo",
      title: values.title,
      preacher: values.preacher || null,
      scriptureReference: values.scriptureReference || null,
      preachedAt: values.preachedAt || null,

      sourceType: values.sourceType,
      sourceUrl:
        values.sourceType === "youtube"
          ? values.youtubeUrl || null
          : null,
      mediaFileName:
        values.sourceType === "upload"
          ? mediaFile?.name || null
          : null,

      transcript: values.transcript?.trim() || null,
      transcriptStatus,

    followUpSubject: null,
    followUpBody: null,
      aiDraftStatus: "not_started",
      emailStatus: "not_started",
    };

    sessionStorage.setItem(
      SERMON_STORAGE_KEY,
      JSON.stringify(sermon)
    );

    router.push("/app/sermons/demo");
  }

  return <SermonForm onSubmit={handleCreateSermon} />;
}