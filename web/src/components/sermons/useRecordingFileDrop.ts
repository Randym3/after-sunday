"use client";

import { useEffect, useState } from "react";

const ACCEPTED_RECORDING_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".wav",
  ".mp4",
  ".webm",
];

export function isAcceptedRecordingFile(file: File) {
  const extension =
    file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";

  return (
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    ACCEPTED_RECORDING_EXTENSIONS.includes(extension)
  );
}

interface UseRecordingFileDropOptions {
  /** Called with the first dropped file whenever a file is released anywhere on the page. */
  onFileDropped: (file: File) => void;
}

/**
 * Tracks whether a file is being dragged anywhere over the page and reports
 * the dropped file. Only reacts to real file drags (not text or links).
 */
export function useRecordingFileDrop({
  onFileDropped,
}: UseRecordingFileDropOptions) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes(
        "Files"
      );
    }

    function handleDragEnter(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      setIsDraggingFile(true);
    }

    function handleDragOver(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    }

    function handleDragLeave(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();

      // Moving between elements (including the overlay's own background and
      // card) fires dragleave with a relatedTarget set. Only hide when the
      // drag actually leaves the window; otherwise every element boundary
      // would briefly hide and re-show the overlay, causing a flicker.
      if (event.relatedTarget === null) {
        setIsDraggingFile(false);
      }
    }

    function handleDrop(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }

      event.preventDefault();
      setIsDraggingFile(false);

      const file = event.dataTransfer?.files?.[0];

      if (file) {
        onFileDropped(file);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDraggingFile(false);
      }
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onFileDropped]);

  return { isDraggingFile };
}
