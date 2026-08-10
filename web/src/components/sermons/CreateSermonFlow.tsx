"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SermonForm } from "@/components/sermons/SermonForm";
import { MediaUploader } from "@/components/sermons/MediaUploader";
import { createSermon } from "@/lib/api/sermons";
import { CreateSermonInput } from "@/types/sermon";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

type Flow =
  | { stage: "form" }
  | { stage: "uploading"; sermonId: string; file: File };

export function CreateSermonFlow() {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>({ stage: "form" });

  async function handleCreateSermon(
    values: CreateSermonInput,
    mediaFile: File | null,
  ) {
    try {
      const sermon = await createSermon(values);
      const sermonId = sermon.id;

      // For upload sources: create the row first, then upload the file.
      if (values.sourceType === "upload" && mediaFile) {
        setFlow({ stage: "uploading", sermonId, file: mediaFile });
        return;
      }

      router.push(`/app/sermons/${sermonId}`);
    } catch (error) {
      alert(errorMessage(error));
    }
  }

  function handleUploadCancel() {
    setFlow({ stage: "form" });
  }

  if (flow.stage === "uploading") {
    return (
      <MediaUploader
        sermonId={flow.sermonId}
        file={flow.file}
        onComplete={() => router.push(`/app/sermons/${flow.sermonId}`)}
        onCancel={handleUploadCancel}
        note="Your recording is being saved. You can see the progress above."
      />
    );
  }

  return <SermonForm onSubmit={handleCreateSermon} />;
}
